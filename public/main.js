// ARK AURORA — embarkation hall. three.js viewer for the Blender/Cycles bake.
//
// How a frame is made (kept deliberately cheap, so moving characters can be added later):
//   1. Lighting is path-traced into linear-HDR atlases (blender/bake.py) and drawn unlit: no realtime lights.
//      The orrery chandelier turns, so its light is baked separately at three rotation phases and blended here.
//   2. The polished floor gets a live planar reflection: the scene is rendered once more from the mirrored camera
//      at reduced size. Anything that moves reflects automatically.
//   3. One HDR scene pass, a small bloom chain and a single full-screen grading/tone-mapping pass (js/post.js).
//   4. The internal resolution follows the frame rate (Governor).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Post, Governor } from './js/post.js';
import { createScreens, tminus } from './js/screens.js';
import { createHologram } from './js/hologram.js';
import { createRouteMap } from './js/routemap.js';

const Q = new URLSearchParams(location.search);
const SKIP = new Set((Q.get('skip') || '').split(','));       // profiling switches: mirror, bloom, holo, dust, shaft
const num = (k, d) => (Q.has(k) && !Number.isNaN(parseFloat(Q.get(k))) ? parseFloat(Q.get(k)) : d);
function fail(msg) {
  const l = document.getElementById('loader');
  l.querySelector('.label').textContent = msg; l.querySelector('.bar').style.display = 'none';
  l.querySelector('.mark').style.animation = 'none';
}
addEventListener('error', (e) => fail('ERROR: ' + (e.message || 'failed to start')));
addEventListener('unhandledrejection', (e) => fail('ERROR: ' + (e.reason?.message || e.reason || 'failed to load')));

const canvas = document.getElementById('scene');
let renderer;
// The canvas itself needs no depth buffer or MSAA (the scene is drawn into our own HDR target) - except in WebKit,
// which presented a black page from a non-antialiased canvas in testing, so Safari keeps an antialiased one.
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrom(e|ium)|Edg\//.test(navigator.userAgent);
const CANVAS_AA = Q.has('aa') ? Q.get('aa') === '1' : WEBKIT;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: CANVAS_AA, alpha: Q.get('alpha') !== '0', depth: Q.get('depth') === '1', stencil: false, powerPreference: 'high-performance' });
} catch (e) {
  fail('THIS BROWSER CANNOT START WEBGL 2 — ENABLE HARDWARE ACCELERATION');
  throw e;
}
renderer.toneMapping = THREE.NoToneMapping;          // tone mapping happens once, in the final post pass
renderer.info.autoReset = false;
const gl = renderer.getContext();
const HDR_OK = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
const RT_TYPE = HDR_OK ? THREE.HalfFloatType : THREE.UnsignedByteType;
const DSCALE = HDR_OK ? 1 : 0.01;                    // distances stored in alpha must fit 0..1 without float targets

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010204);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 3000);
const B = (v) => new THREE.Vector3(v[0], v[2], -v[1]);          // Blender (x, y, z) -> three (x, z, -y)

// ---------------------------------------------------------------- loading
const manager = new THREE.LoadingManager();
manager.onProgress = (_u, n, total) => {
  const p = Math.round((n / total) * 100);
  document.getElementById('progress').style.width = p + '%';
  const el = document.getElementById('pct'); if (el) el.textContent = p;
};
const texLoader = new THREE.TextureLoader(manager);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
const BITMAPS = typeof createImageBitmap === 'function' && Q.get('bitmap') !== '0';
const bmpLoader = (flip) => new THREE.ImageBitmapLoader(manager).setOptions({ imageOrientation: flip ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
const bmpPlain = BITMAPS && bmpLoader(false), bmpFlipped = BITMAPS && bmpLoader(true);
// HDR-encoded bakes (decoded in the shaders). Images are decoded off the main thread into ImageBitmaps, so a
// texture is never uploaded half-decoded and loading does not stall the page.
function bakeTex(name, aniso = 4, flip = false) {
  const url = `${BASE}/tex/${name}.webp`;
  let t;
  if (BITMAPS) { t = new THREE.Texture(); (flip ? bmpFlipped : bmpPlain).load(url, (bmp) => { t.image = bmp; t.needsUpdate = true; }); t.flipY = false; }
  else { t = texLoader.load(url); t.flipY = flip; }
  t.colorSpace = THREE.NoColorSpace; t.anisotropy = Math.min(Q.has('aniso') ? num('aniso', 1) : aniso, MAX_ANISO);
  if (Q.get('mips') === '0') { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
// Every room is a folder with the same three things: scene.json, lobby.glb and tex/ (the lobby keeps the root).
const ROOM = document.body.dataset.room || Q.get('room') || 'lobby';
const BASE = ROOM === 'lobby' ? 'assets' : `assets/${ROOM}`;
const info = await (await fetch(`${BASE}/scene.json`)).json();
const gltf = await new GLTFLoader(manager).loadAsync(`${BASE}/lobby.glb`);

const HAS_PORTAL = !!info.portal;                                 // window to the outside: backdrop, sun, sunbeam
const CAM = B(info.cam), TGT = B(info.tgt), HOLO = B(info.holo || [0, 0, 0]), PORTAL = B(info.portal || [0, 1e4, 0]), SUN = B(info.sun || [0, 1, 0.2]).normalize();
const uTime = { value: 0 }, uPx = { value: 1000 };                 // uPx: pixels per world unit at distance 1 (for point sprites)

// ---------------------------------------------------------------- materials
const DEC = `vec3 dec(vec4 t){ return t.rgb*t.rgb*${info.hdr_range.toFixed(1)}; }`;       // inverse of bake.py save_encoded
const VERT = `varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
// Opaque surfaces write their distance from the camera into alpha while the mirror image is rendered. That tells
// the floor how far away a reflected object is (-> how blurred its reflection is) without a depth texture.
const uMirror = { value: 0 };
const DIST = `gl_FragColor.a = uMirror > 0.5 ? distance(vW, cameraPosition)*${DSCALE.toFixed(2)} : 1.0;`;
// additive blending that leaves that alpha channel untouched
const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
// all static light strips: a single mesh whose vertex colours hold the radiance to show (see bake.py)
const stripMat = new THREE.ShaderMaterial({
  uniforms: { uMirror, uRange: { value: info.em_range || 8 } }, side: THREE.DoubleSide, vertexColors: true,
  vertexShader: `uniform float uRange; varying vec3 vC; varying vec3 vW;
    void main(){ vC = color.rgb*uRange; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform float uMirror; varying vec3 vC; varying vec3 vW; void main(){ gl_FragColor = vec4(vC, 1.0); ${DIST} }`,
});
const flatMat = (color) => new THREE.ShaderMaterial({
  uniforms: { color: { value: color }, uMirror }, side: THREE.DoubleSide, vertexShader: VERT,
  fragmentShader: `uniform vec3 color; uniform float uMirror; varying vec3 vW; void main(){ gl_FragColor = vec4(color, 1.0); ${DIST} }`,
});

// Chandelier light layers: L(phi) = sum_i w_i(phi) * L_i with w_i = (1 + 2 cos(phi - phi_i)) / 3  (exact for the
// first harmonic of the rotation, and it reproduces each baked phase exactly).
const uChand = { value: new THREE.Vector3(1 / 3, 1 / 3, 1 / 3) };
const LAYERED = new Set(Q.has('nolayers') ? [] : info.chand?.layered || []), PHASES = (info.chand?.phases || []).map((d) => d * Math.PI / 180);
const layerUniforms = (grp) => Object.fromEntries(PHASES.map((_, i) => [`l${i}`, { value: bakeTex(`${grp}_c${i}`, 1) }]));
const LAYER_PARS = `uniform sampler2D l0, l1, l2; uniform vec3 uChand;`;
const CH_GAIN = num('chandgain', 0.5), BASE_GAIN = num('base', 1.0);      // ?base=0 shows the chandelier's light alone
const LAYER_ADD = `max(dec(texture2D(l0, vUv))*uChand.x + dec(texture2D(l1, vUv))*uChand.y + dec(texture2D(l2, vUv))*uChand.z, 0.0)*${CH_GAIN.toFixed(3)}`;
const bakedMat = (map, { gain = 1, grp = null } = {}) => {
  const layered = LAYERED.has(grp) && PHASES.length === 3;
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uMirror, uGain: { value: gain }, uChand, ...(layered ? layerUniforms(grp) : {}) }, side: THREE.DoubleSide,
    vertexShader: VERT,
    fragmentShader: `uniform sampler2D map; uniform float uGain, uMirror; varying vec2 vUv; varying vec3 vW; ${DEC} ${layered ? LAYER_PARS : ''}
      void main(){ vec3 c = dec(texture2D(map, vUv))${layered ? `*${BASE_GAIN.toFixed(3)}` : ''}; ${layered ? `c += ${LAYER_ADD};` : ''}
        gl_FragColor = vec4(c*uGain, 1.0); ${DIST} }`,
  });
};

// ---- polished stone floor: baked diffuse light + live planar reflection
const REFL_SCALE = num('refl', 0.66);
const uMinLod = { value: 0 };
const refl = {
  cam: new THREE.PerspectiveCamera(),
  rt: new THREE.WebGLRenderTarget(4, 4, { type: RT_TYPE, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
    samples: 4 }),                                    // MSAA: thin light strips must not alias in the mirror image
  vp: new THREE.Matrix4(), size: new THREE.Vector2(4, 4), pxPerRad: { value: 500 }, floors: [], hidden: [],
};
const F0 = ((info.floor.ior - 1) / (info.floor.ior + 1)) ** 2;
const ROUGH = (info.floor.rough[0] + info.floor.rough[1]) / 2;     // one roughness for the whole floor
const floorMat = (map, grp) => {
  const layered = LAYERED.has(grp) && PHASES.length === 3;
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, tRefl: { value: refl.rt.texture }, uMirrorVP: { value: refl.vp }, uSize: { value: refl.size }, uPxR: refl.pxPerRad,
      uAlpha: { value: ROUGH * ROUGH }, uMinLod, uTile: { value: info.floor.tile }, uF0: { value: F0 }, uChand, ...(layered ? layerUniforms(grp) : {}) },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D map, tRefl; uniform mat4 uMirrorVP; uniform vec2 uSize; uniform float uPxR, uAlpha, uTile, uF0, uMinLod;
      varying vec2 vUv; varying vec3 vW; ${DEC} ${layered ? LAYER_PARS : ''}
      void main(){
        vec3 diffuse = dec(texture2D(map, vUv))*${BASE_GAIN.toFixed(3)}; ${layered ? `diffuse += ${LAYER_ADD};` : ''}
        vec3 V = normalize(cameraPosition - vW);
        float cosT = clamp(V.y, 0.0, 1.0);
        // joints between slabs: matte grout, no mirror reflection (faded out once thinner than a pixel)
        vec2 f = fract(vW.xz/uTile); vec2 dl = min(f, 1.0 - f)*uTile; float d = min(dl.x, dl.y), fw = fwidth(d);
        float joint = (1.0 - smoothstep(0.0035, 0.0035 + fw*1.2, d))*clamp(0.012/max(fw, 1e-5), 0.0, 1.0);
        // mirror image, looked up by projecting this point with the mirrored camera
        vec4 clip = uMirrorVP*vec4(vW, 1.0);
        vec2 uv = clip.xy/clip.w*0.5 + 0.5;
        float df = distance(vW, cameraPosition), dobj = textureLod(tRefl, uv, 2.0).a*${(1 / DSCALE).toFixed(1)};
        float travel = clamp(1.0 - df/max(dobj, df), 0.0, 1.0);          // share of the reflected path that lies beyond the floor
        // Width of the specular lobe in pixels: grows with the distance to the reflected object (contact hardening).
        // A micro-facet tilt turns the reflected ray by 2*alpha along the view direction but only 2*alpha*cos(theta)
        // sideways, so reflections smear into vertical streaks at grazing angles: 9 taps along that streak, with the
        // mip level matched to the tap spacing (which also provides the sideways blur).
        float rv = 2.0*uAlpha*travel*uPxR;
        vec3 R;
        if (rv < 0.75) R = textureLod(tRefl, uv, uMinLod).rgb;
        else {
          float lod = max(log2(max(rv*0.25, 1.0)), uMinLod); R = vec3(0.0);
          for (int i = -4; i <= 4; i++) { float t = float(i)*0.25; R += textureLod(tRefl, uv + vec2(0.0, t*rv/uSize.y), lod).rgb*exp(-2.5*t*t); }
          R *= 0.93/2.8262;
          // a real specular lobe has long tails (GGX): invisible for ordinary objects, but they are what stretches
          // the sun into a glare path across a polished floor
          // (tap footprints are chosen to tile: +-[1,3] rv at 4x the texel size, +-[3,7] rv at 8x)
          vec2 o1 = vec2(0.0, 2.0*rv/uSize.y), o2 = vec2(0.0, 5.0*rv/uSize.y);
          R += (textureLod(tRefl, uv + o1, lod + 2.0).rgb + textureLod(tRefl, uv - o1, lod + 2.0).rgb)*0.022
             + (textureLod(tRefl, uv + o2, lod + 3.0).rgb + textureLod(tRefl, uv - o2, lod + 3.0).rgb)*0.013;
        }
        float F = uF0 + (1.0 - uF0)*pow(1.0 - cosT, 5.0);
        gl_FragColor = vec4(diffuse*(1.0 - F)*(1.0 - 0.5*joint) + R*F*(1.0 - 0.9*joint), 1.0);
      }`,
  });
};

// Frameless glass balustrade. Additive: what glass adds to the view is reflection, strongest at grazing angles,
// plus the green-white glint of its polished edges (top edge and the joints between 2 m panels).
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, ...ADD, vertexShader: VERT,
  fragmentShader: `varying vec3 vW; varying vec2 vUv;
    void main(){
      vec3 v = normalize(cameraPosition - vW);
      float F = 0.04 + 0.96*pow(1.0 - abs(v.x), 5.0);                             // Fresnel; the panes face +-X
      float h = clamp((vW.y - 4.7)/0.93, 0.0, 1.0);
      vec3 refl = mix(vec3(0.10, 0.11, 0.13), vec3(0.30, 0.40, 0.50), h)*0.35;    // it mirrors the dim hall below, the lit roof above
      float j = abs(fract(vW.z/2.0 + 0.5) - 0.5)*2.0, fw = fwidth(vW.z/2.0)*2.0;  // panel joints every 2 m
      float joint = 1.0 - smoothstep(0.004, 0.004 + fw, j);
      float top = smoothstep(0.975, 0.99, vUv.y);
      vec3 col = refl*F + vec3(0.55, 0.9, 0.8)*(joint*0.10 + top*0.22);
      gl_FragColor = vec4(col, 1.0);
    }`,
});

// ---------------------------------------------------------------- scene graph
const screens = createScreens({ room: ROOM, VERT, DIST, uMirror, anisotropy: Math.min(8, MAX_ANISO), gain: num('screens', 0.9) });
const root = gltf.scene; scene.add(root);
const SPIN = info.chand?.spin || {}, movers = [];
let nScreen = 0; const screenMeshes = [];
root.traverse((o) => {
  if (!o.isMesh) return;
  const u = o.userData;
  if (u.grp) {
    if (u.grp.startsWith('floor')) { o.material = floorMat(bakeTex(u.grp, 2), u.grp); refl.floors.push(o); }
    else o.material = bakedMat(bakeTex(u.grp, 4), { grp: u.grp });
  } else if (u.em === 'static') o.material = stripMat;
  else if (u.em) {                                    // the orrery's lamps (baked far brighter than they are shown)
    const { color: c, strength: s } = info.em[u.em], k = Math.min(s, 7);
    o.material = flatMat(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
  } else if (u.fx === 'screen') o.material = screens.material(nScreen++);

  if (u.fx === 'screen') screenMeshes.push(o);
  if (u.fx === 'glass') { o.material = glassMat; o.renderOrder = 5; refl.hidden.push(o); }
  o.frustumCulled = false; o.matrixAutoUpdate = false; o.updateMatrix();
  const s = SPIN[u.grp] ?? SPIN[u.em]; if (s) movers.push([o, s]);
});
// the orrery: rings tagged +1 and -1 turn in opposite directions about the vertical axis through the dais
const pivots = {};
if (info.chand) for (const [o, s] of movers) {
  const p = (pivots[s] ??= (() => { const g = new THREE.Group(); g.position.set(info.chand.pivot[0], 0, -info.chand.pivot[1]); scene.add(g); g.updateMatrixWorld(); return g; })());
  p.attach(o); o.updateMatrix();
}

// ---- outside: Earth at sunrise (NASA Blue Marble + Black Marble imagery) rendered in Cycles; effectively at infinity
let backdrop;
if (HAS_PORTAL) {
  const D = 900, fov = info.backdrop_fov || 80;        // the field of view blender/backdrop.py rendered
  const dir = PORTAL.clone().sub(CAM).normalize(), size = 2 * D * Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const t = bakeTex('backdrop', 4, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bakedMat(t, { gain: num('earth', 0.75) }));
  m.position.copy(CAM).addScaledVector(dir, D); m.lookAt(CAM); m.frustumCulled = false;
  scene.add(m); backdrop = { m, off: dir.clone().multiplyScalar(D) };
}
// ---- thunderstorms flickering in the clouds on Earth's night side. Points on the globe (taken from the Cycles scene)
// are projected to infinity, like the backdrop itself.
if (info.earth && !SKIP.has('storms')) {
  const C = B(info.earth.c), U = B(info.earth.u).normalize(), R = info.earth.r, pos = [], seed = [];
  const t1 = new THREE.Vector3().crossVectors(U, SUN).normalize(), t2 = SUN.clone().addScaledVector(U, -SUN.dot(U)).normalize();   // across / towards the sun
  const cell = (a, b, n) => { for (let i = 0; i < n; i++) {
    const p = U.clone().addScaledVector(t1, a + (Math.random() - 0.5) * 0.035).addScaledVector(t2, b + (Math.random() - 0.5) * 0.035).normalize().multiplyScalar(R * 1.002).add(C).sub(CAM);
    p.setLength(870); pos.push(p.x, p.y, p.z); seed.push(a * 91.7 + b * 37.3 + Math.random() * 0.3); } };
  cell(-0.09, -0.16, 7); cell(0.07, -0.21, 6); cell(-0.2, -0.1, 5); cell(0.16, -0.13, 6); cell(0.0, -0.27, 5);   // b < 0: on the night side
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  const storms = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD, uniforms: { uTime, uPx },
    vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vA;
      float h(float n){ return fract(sin(n*91.345)*47453.5); }
      void main(){
        vec4 mv = viewMatrix*vec4(cameraPosition + position, 1.0); gl_Position = projectionMatrix*mv;
        float cellId = floor(seed), slot = floor(uTime*1.7 + h(cellId)*9.0);            // each storm cell fires in bursts
        float burst = step(0.72, h(slot*0.37 + cellId));
        float f = fract(uTime*1.7 + h(cellId)*9.0);
        float flick = step(0.5, h(floor(uTime*24.0) + seed*13.0))*exp(-f*5.0);          // a few strokes, dying away
        vA = burst*flick*step(0.35, h(slot + seed*7.0));
        gl_PointSize = (0.012 + 0.02*h(seed*3.1))*uPx; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.62, 0.72, 1.0)*vA*1.6*smoothstep(0.5, 0.0, d), 1.0); }`,
  }));
  storms.frustumCulled = false; storms.renderOrder = 1; scene.add(storms);
}
// ---- the sun, just above Earth's horizon inside the portal: the focal point of the whole composition.
// Drawn at infinity for whichever camera is rendering (so it also appears, stretched into a glare path, in the floor).
if (HAS_PORTAL) {
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD, uniforms: { uDir: { value: SUN }, uSize: { value: 0.16 }, uGain: { value: num('sun', 1.0) }, uMirror },
    vertexShader: `uniform vec3 uDir; uniform float uSize; varying vec2 vP;
      void main(){ vP = position.xy; vec3 c = mat3(viewMatrix)*uDir*860.0;       // just in front of the backdrop plane
        gl_Position = projectionMatrix*vec4(c + vec3(position.xy*uSize*860.0, 0.0), 1.0); }`,
    fragmentShader: `uniform float uGain, uMirror; varying vec2 vP;
      void main(){ float r = length(vP), a = atan(vP.y, vP.x);
        // the photosphere is thousands of times brighter than anything indoors. Seen directly that only needs to be
        // "far above white"; seen in the floor its true strength is what survives the Fresnel loss and the blur.
        float disc = smoothstep(0.034, 0.024, r)*mix(70.0, 2600.0, uMirror);
        float halo = 2.2*exp(-r*20.0) + 0.3*exp(-r*5.0);                        // glare in the optics / window
        float spikes = pow(abs(cos(a*3.0 + 0.4)), 60.0)*exp(-r*7.0)*0.5;         // faint six-point diffraction star
        vec3 col = vec3(1.0, 0.86, 0.68)*(disc + halo + spikes)*(1.0 - smoothstep(0.85, 1.0, r));
        gl_FragColor = vec4(col*uGain, 1.0); }`,
  }));
  sun.frustumCulled = false; sun.renderOrder = 1; scene.add(sun);
}
// ---- sunbeam: the hall's air is faintly hazy, so the light entering through the portal is visible. Single
// scattering integrated analytically per pixel: (length of the view ray inside the beam) x (phase function).
// The camera stands inside the beam, so this mostly reads as glare gathering around the sun.
if (HAS_PORTAL && info.portal_r) {
  const A = SUN.clone().negate(), R = info.portal_r * 0.86, L = 44, seg = 48, pos = [], idx = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * 6.2832, p = new THREE.Vector3(PORTAL.x + Math.cos(a) * R, PORTAL.y + Math.sin(a) * R, PORTAL.z);
    pos.push(p.x, p.y, p.z, p.x + A.x * L, p.y + A.y * L, p.z + A.z * L);
    const n = (i + 1) % seg; idx.push(i * 2, n * 2, i * 2 + 1, n * 2, n * 2 + 1, i * 2 + 1);
  }
  pos.push(PORTAL.x, PORTAL.y, PORTAL.z, PORTAL.x + A.x * L, PORTAL.y + A.y * L, PORTAL.z + A.z * L);      // end caps
  for (let i = 0; i < seg; i++) { const n = (i + 1) % seg; idx.push(seg * 2, i * 2, n * 2, seg * 2 + 1, n * 2 + 1, i * 2 + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const shaft = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, ...ADD,
    uniforms: { uC: { value: PORTAL }, uA: { value: A }, uR: { value: R }, uTime, uK: { value: num('haze', 0.4) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uC, uA; uniform float uR, uTime, uK; varying vec3 vW;
      void main(){
        // one sample per pixel: the far (exit) surface of the beam volume, whichever way its triangles are wound
        vec3 o = cameraPosition, d = normalize(vW - o);
        // project the ray along the light direction onto the portal plane: the beam is where that lands inside the opening
        vec3 A0 = o + uA*((uC.z - o.z)/uA.z) - uC, B = d - uA*(d.z/uA.z);
        float qa = dot(B.xy, B.xy), qb = dot(A0.xy, B.xy), qc = dot(A0.xy, A0.xy) - uR*uR, disc = qb*qb - qa*qc;
        if (disc <= 0.0 || qa < 1e-8) discard;
        float s = sqrt(disc), t0 = max((-qb - s)/qa, 0.0), t1 = (-qb + s)/qa;
        if (d.z < -1e-5) t1 = min(t1, (uC.z - o.z)/d.z);                         // stop at the window
        if (d.y < -1e-5) t1 = min(t1, -o.y/d.y); else if (o.y < 0.0 && d.y > 1e-5) t0 = max(t0, -o.y/d.y);   // and at the floor
        float len = max(t1 - t0, 0.0);
        float mu = dot(uA, -d), gg = 0.6;                                        // Henyey-Greenstein: strong forward scattering
        float phase = (1.0 - gg*gg)/(12.566*pow(max(1.0 + gg*gg - 2.0*gg*mu, 1e-3), 1.5));
        gl_FragColor = vec4(vec3(1.0, 0.84, 0.66)*(0.0075*uK*len*phase), 1.0);
      }`,
  }));
  // the volume is convex and the camera stands inside it, so every view ray crosses its surface exactly once
  shaft.frustumCulled = false; shaft.renderOrder = 4; scene.add(shaft); refl.shaft = shaft;
}
// ---- drifting dust; motes inside the sunbeam catch the light
const dust = (() => {
  const N = 1200, p = new Float32Array(N * 3), s = new Float32Array(N);
  for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - 0.5) * 13; p[i * 3 + 1] = Math.random() * 9 + 0.2; p[i * 3 + 2] = 4 - Math.random() * 30; s[i] = Math.random() * 100; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD, uniforms: { uTime, uPx, uSun: { value: SUN }, uPortal: { value: PORTAL }, uPR: { value: (info.portal_r || 1) * 0.86 } },
    vertexShader: `attribute float seed; uniform float uTime, uPx, uPR; uniform vec3 uSun, uPortal; varying vec3 vC;
      void main(){ vec3 p = position; float t = uTime*0.12;
        p.x += sin(t + seed)*0.5; p.y += sin(t*0.7 + seed*1.7)*0.4; p.z += cos(t*0.9 + seed*0.6)*0.5;
        vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
        float px = (0.010 + 0.008*fract(seed))*uPx/max(-mv.z, 0.01); gl_PointSize = max(px, 1.6);
        vec3 q = p - uPortal; float along = -dot(q, uSun), off = length(q + uSun*along);
        float lit = (1.0 - smoothstep(uPR*0.8, uPR, off))*step(0.0, along);
        vC = mix(vec3(0.75,0.88,1.0)*0.1, vec3(1.0,0.82,0.62)*1.3, lit)*(0.25 + 0.5*fract(seed*7.3))*smoothstep(0.6, 3.0, -mv.z)*min(1.0, px*px/2.56); }`,
    fragmentShader: `varying vec3 vC; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC*a*a, 1.0); }`,
  }));
  m.frustumCulled = false; scene.add(m); refl.hidden.push(m); return m;
})();

HOLO.y += 0.1;
const hologram = info.holo ? await createHologram({ scene, position: HOLO, sunDir: SUN, ADD, uTime, uPx, radius: 0.74, gain: num('holo', 2.0) }) : null;
if (hologram && SKIP.has('holo')) hologram.root.visible = false;
const routeMap = info.map ? createRouteMap({ scene, center: B(info.map.c), radius: info.map.r, ADD, uTime, uPx, gain: num('map', 1.6) }) : null;
if (SKIP.has('dust')) dust.visible = false;
if (refl.shaft && SKIP.has('shaft')) refl.shaft.visible = false;

// ---------------------------------------------------------------- post + dynamic resolution
const post = new Post(renderer, { hdr: HDR_OK, packed: !!gl.getExtension('EXT_color_buffer_float') && Q.get('fmt') !== 'rgba16', msaa: 4, look: { exposure: num('exp', info.exposure || 0.85), contrast: num('contrast', 1.3), saturation: num('sat', 1.08),
  bloom: num('bloom', 0.05), vignette: num('vig', 0.45), grain: num('grain', 0.045) } });
const gov = new Governor({ min: 0.5, max: 1, pinned: Q.has('scale') ? num('scale', 1) : null });
// Quality tiers. 0: 4x MSAA on the scene and on the mirror image (cheap on discrete GPUs, ~45% of the frame on an
// Intel HD 630). 1: no MSAA; edges are smoothed in the final pass (FXAA) and the mirror image is rendered a little
// larger and read one mip level down instead. The governor drops to tier 1 before it cuts resolution hard.
let tier = -1, reflScale = REFL_SCALE;
const TIER_PINNED = Q.has('tier') || Q.has('msaa');
function setTier(t) {
  if (t === tier) return; tier = t;
  post.setMSAA(t ? 0 : 4); post.setFXAA(!!t);
  refl.rt.samples = t ? 0 : 4; refl.rt.dispose();
  reflScale = t ? Math.min(1, REFL_SCALE * 1.3) : REFL_SCALE; uMinLod.value = t ? 0.8 : 0;
}
setTier(Q.has('tier') ? num('tier', 0) : num('msaa', 4) ? 0 : 1);
const MAX_DPR = num('dpr', 2);
function applyScale() {
  const W = canvas.width, H = canvas.height, s = gov.scale, tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  post.setSize(W * s, H * s);
  const rw = Math.max(8, Math.round(W * s * reflScale)), rh = Math.max(8, Math.round(H * s * reflScale));
  refl.rt.setSize(rw, rh); refl.size.set(rw, rh); refl.pxPerRad.value = rh / (2 * tanHalf);
  uPx.value = post.scene.height / (2 * tanHalf);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR)); renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the horizontal framing of the 16:9 hero shot on narrower screens
  const base = Math.tan(THREE.MathUtils.degToRad(info.fov / 2));
  camera.fov = Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(base * Math.max(1, (16 / 9) / camera.aspect))));
  camera.updateProjectionMatrix();
  applyScale();
}
addEventListener('resize', resize); resize();

// mirror the camera in the floor plane (y = 0) and render what the floor sees
const _rot = new THREE.Matrix4(), _p = new THREE.Vector3(), _t = new THREE.Vector3();
function renderMirror() {
  const c = refl.cam;
  camera.updateMatrixWorld();
  _rot.extractRotation(camera.matrixWorld); _p.setFromMatrixPosition(camera.matrixWorld);
  _t.set(0, 0, -1).applyMatrix4(_rot).add(_p);
  c.position.set(_p.x, -_p.y, _p.z);
  c.up.set(0, 1, 0).applyMatrix4(_rot); c.up.y *= -1;
  c.lookAt(_t.x, -_t.y, _t.z);
  c.fov = camera.fov; c.aspect = camera.aspect; c.near = camera.near; c.far = camera.far;
  c.updateProjectionMatrix(); c.updateMatrixWorld();
  refl.vp.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  for (const o of refl.floors) o.visible = false; for (const o of refl.hidden) o.visible = false;
  uMirror.value = 1; renderer.setRenderTarget(refl.rt); renderer.render(scene, c); uMirror.value = 0;
  for (const o of refl.floors) o.visible = true; for (const o of refl.hidden) o.visible = true;
}
function draw(t) {
  renderer.info.reset();
  if (!SKIP.has('mirror')) renderMirror();
  renderer.setRenderTarget(post.scene); renderer.render(scene, camera);
  post.render(t, SKIP.has('bloom'));
}
// Safety net: if nothing reached the canvas (seen with multisampled float targets on some drivers), drop MSAA.
function blank() {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
  for (let i = 1; i < 8; i++) for (let k = 1; k < 8; k++) {
    gl.readPixels((w * i) >> 3, (h * k) >> 3, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (px[0] + px[1] + px[2] > 24) return false;
  }
  return true;
}
function selfTest() {
  draw(0);
  if (blank() && tier === 0) { setTier(1); applyScale(); draw(0); }
}

const DEBUG = Q.has('debug'), series = [];
function probe() {                      // mean brightness of a 6x6 grid, read right after drawing (flicker detection)
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let s = 0;
  for (let i = 1; i < 7; i++) for (let k = 1; k < 7; k++) { gl.readPixels((w * i / 7) | 0, (h * k / 7) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); s += px[0] + px[1] + px[2]; }
  series.push(Math.round(s / 108)); if (series.length > 400) series.shift();
}

// ---------------------------------------------------------------- camera
// Two shots: "close" stands at the window, "hero" is the wide view the bake was made for. The page opens on the
// close shot, holds, then pulls back through the hall. Around either, the pointer adds gentle parallax.
const mouse = new THREE.Vector2(), smooth = new THREE.Vector2();
addEventListener('pointermove', (e) => mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));
addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  mouse.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1));
});
const CLOSE = B(info.close || [0, 17.2, 2.15]), CLOSE_T = B(info.close_tgt || [0, 26, 2.6]), _hero = new THREE.Vector3(), _close = new THREE.Vector3(), _look = new THREE.Vector3();
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOLD = num('hold', 1.2), TRAVEL = num('travel', 5.5);       // opening shot: a short beat, then the pull-back
const SHOT = { hero: 0, close: 1 }[Q.get('shot')] ?? parseFloat(Q.get('shot'));
let view = Q.has('shot') ? SHOT : still ? 0 : 1, viewTarget = view, navTouched = Q.has('shot') || still, intro = 0;
document.querySelectorAll('nav a[data-view]').forEach((a) => a.addEventListener('click', () => { navTouched = true; viewTarget = +a.dataset.view; }));

// ---------------------------------------------------------------- inspect: click anything interactive for a closer look
// Each interactable has a pick mesh and a pose (where the camera stands, what it looks at). The camera glides from
// wherever it is to that pose; Back / Esc / a click on nothing returns it to the room's own camera.
const picks = [], pickMat = new THREE.MeshBasicMaterial({ visible: false });
const tanV = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
function addPoint(center, r, dir, parent = scene, local = null) {            // something round-ish: frame a sphere of radius r from direction dir
  const m = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 12, 8), pickMat); m.position.copy(local || center); parent.add(m);
  picks.push({ mesh: m, pose: () => { const c = m.getWorldPosition(new THREE.Vector3()), d = (typeof dir === 'function' ? dir(c) : dir).clone().normalize();
    const dist = r / Math.min(tanV(), tanV() * camera.aspect) * 1.25; return { pos: c.clone().addScaledVector(d, dist), tgt: c }; } });
}
scene.updateMatrixWorld(true);
const HUB = ROOM === 'lobby';                                                // in the Atrium only the hologram and the doors are interactive
for (const o of HUB ? [] : screenMeshes) {                                    // a flat display: stand square in front of it, filling the view
  const p = o.geometry.attributes.position, v = [0, 1, 2, 3].map((i) => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  const c = v.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
  const ix = o.geometry.index, tri = [0, 1, 2].map((i) => v[ix ? ix.getX(i) : i]);
  const n = new THREE.Vector3().crossVectors(tri[1].clone().sub(tri[0]), tri[2].clone().sub(tri[0])).normalize();
  const inward = Math.abs(c.x) > 0.5 || Math.abs(c.z) > 0.5 ? new THREE.Vector3(-c.x, 0, ROOM === 'experience' ? -c.z : 0) : CAM.clone().sub(c);
  if (n.dot(inward) < 0) n.negate();
  const t = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize(), ext = (f) => Math.max(...v.map(f)) - Math.min(...v.map(f));
  const w = ext((q) => q.dot(t)), h = ext((q) => q.y);
  picks.push({ mesh: o, pose: () => ({ pos: c.clone().addScaledVector(n, Math.max(h / 2 / tanV(), w / 2 / (tanV() * camera.aspect)) * 1.12), tgt: c }) });
}
// Holograms open up instead: the camera only comes closer, along its own line of sight, while the display grows
// and unfolds its detail layer.
function addHolo(parent, local, r, dist, lift, target) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), pickMat); m.position.copy(local); parent.add(m);
  picks.push({ mesh: m, onFocus: (v) => target.setExpanded(v), pose: () => { const c = m.getWorldPosition(new THREE.Vector3()); c.y += lift;
    const d = CAM.clone().sub(c); d.y *= 0.35; d.normalize(); return { pos: c.clone().addScaledVector(d, dist / Math.min(1, camera.aspect / 1.5)), tgt: c }; } });
}
if (routeMap) for (const s of routeMap.stations) addHolo(s.grp, new THREE.Vector3(0, 0.42, 0), 0.48, 2.9, 0.3, s);
if (hologram) addHolo(scene, hologram.root.position.clone(), 1.0, 5.6, 0.55, hologram);
for (const f of info.focus || []) addPoint(B(f.c), f.r, B(f.dir));
// Doors: walk up to it, then go through (to another room's page). A sealed door only shows its notice.
for (const d of info.doors || []) {
  const c = B(d.c), n = B(d.n).normalize(), m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), pickMat); m.position.copy(c); scene.add(m);
  picks.push({ mesh: m, door: d, pose: () => ({ pos: c.clone().addScaledVector(n, 4.2 / Math.min(1, camera.aspect / 1.2)).setY(c.y + 0.5), tgt: c.clone().setY(c.y + 0.25) }) });
}
const focus = { to: null, f: 1, from: { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }, cur: { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }, dest: new THREE.Vector3() };
const hudEl = document.getElementById('hud'), bar = document.createElement('div'); bar.id = 'inspectbar'; bar.hidden = true;
bar.innerHTML = '<button id="back">←  BACK</button><button id="prev" aria-label="Previous">‹</button><span id="count"></span><button id="next" aria-label="Next">›</button><button id="enter" hidden></button>';
document.body.appendChild(bar);
const backBtn = bar.querySelector('#back'), countEl = bar.querySelector('#count'), enterBtn = bar.querySelector('#enter');
const fade = document.createElement('div'); fade.id = 'fade'; document.body.appendChild(fade);
let leaving = null;
function travel(href, delay = 0) { if (!href || leaving) return; leaving = setTimeout(() => { fade.classList.add('on'); setTimeout(() => (location.href = href), 550); }, delay); }
enterBtn.addEventListener('click', () => travel(focus.pick?.door?.to));
addEventListener('pageshow', () => { fade.classList.remove('on'); leaving = null; });
// the tour order: a sweep across the room from left to right as seen from the room camera
let tour = null;
function tourOrder() {
  if (!tour) { scene.updateMatrixWorld(true); const b = new THREE.Box3(), c = new THREE.Vector3();
    tour = picks.map((p) => { b.setFromObject(p.mesh).getCenter(c); return [Math.atan2(c.x - CAM.x, -(c.z - CAM.z)), p]; }).sort((a, z) => a[0] - z[0]).map((a) => a[1]); }
  return tour;
}
function step(d) { const t = tourOrder(), i = t.indexOf(focus.pick); setFocus(t[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + t.length) % t.length]); }
function setFocus(pick) {
  if ((pick || null) === focus.pick) return;
  focus.pick?.onFocus?.(false); pick?.onFocus?.(true);
  focus.pick = pick || null; focus.to = pick ? pick.pose() : null; focus.f = 0;
  focus.from.pos.copy(focus.cur.pos); focus.from.tgt.copy(focus.cur.tgt);
  if (pick) { navTouched = true; viewTarget = Math.round(view); }           // stop the opening move; it would fight the close-up
  hudEl.classList.toggle('inspecting', !!pick); bar.hidden = !pick;
  if (pick) countEl.textContent = `${tourOrder().indexOf(pick) + 1} / ${picks.length}`;
  clearTimeout(leaving); leaving = null;
  const d = pick?.door; enterBtn.hidden = !d; if (d) { enterBtn.textContent = d.to ? `ENTER ${d.label}  →` : `${d.label}  ·  NOT YET OPEN`; enterBtn.disabled = !d.to; }
}
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(picks.map((p) => p.mesh), false)[0];
  return hit ? picks.find((p) => p.mesh === hit.object) : null;
}
let downAt = null;
addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
addEventListener('click', (e) => {
  if (e.target.closest('nav, #inspectbar, a, button')) return;
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  const pk = pickAt(e); if (Q.has('debug')) console.log('pick', picks.indexOf(pk), e.clientX, e.clientY, focus.pick ? 1 : 0);
  setFocus(pk);
  if (pk?.door?.to) travel(pk.door.to, 1500);                               // clicked a door: walk up to it, then through
});
backBtn.addEventListener('click', () => setFocus(null));
bar.querySelector('#prev').addEventListener('click', () => step(-1)); bar.querySelector('#next').addEventListener('click', () => step(1));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setFocus(null);
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
});
addEventListener('resize', () => { if (focus.pick) focus.to = focus.pick.pose(); });
let hoverT = 0;
addEventListener('pointermove', (e) => { const now = performance.now(); if (now - hoverT < 60) return; hoverT = now; canvas.style.cursor = pickAt(e) ? 'pointer' : ''; });
{ const hint = document.querySelector('footer .hint'); if (hint) hint.innerHTML = hint.innerHTML.replace('MOVE TO LOOK AROUND', 'MOVE TO LOOK AROUND  ·  CLICK TO INSPECT  ·  ← → TO TOUR'); }
if (Q.has('focus')) setTimeout(() => setFocus(picks[num('focus', 0)]), 300);

const CH_SPEED = (2 * Math.PI) / num('chandperiod', 48), CH_FIXED = Q.has('chand') ? num('chand', 0) * Math.PI / 180 : null;
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = (uTime.value += dt);
  if (gov.update(dt * 1000)) {
    if (tier === 0 && !TIER_PINNED && gov.scale < 0.72) { setTier(1); gov.scale = 1; gov.cool = 6; }     // cheaper AA before lower resolution
    applyScale();
  }

  if (t > HOLD && !navTouched) viewTarget = 0;
  view += THREE.MathUtils.clamp(viewTarget - view, -dt / TRAVEL, dt / TRAVEL);
  intro = Q.has('shot') ? 1 : Math.max(intro, 1 - view);
  const e = view * view * view * (view * (view * 6 - 15) + 10);          // smootherstep: 0 = hero, 1 = close
  smooth.lerp(mouse, 1 - Math.exp(-dt * 2.5));
  const par = 1 - 0.75 * e;                                               // less parallax in the tight shot
  _hero.set(CAM.x + smooth.x * 1.0 * par + Math.sin(t * 0.17) * 0.12, CAM.y - smooth.y * 0.22 * par + Math.sin(t * 0.23) * 0.04, CAM.z);
  _close.set(CLOSE.x + smooth.x * 0.5 + Math.sin(t * 0.17) * 0.06, CLOSE.y - smooth.y * 0.15 + Math.sin(t * 0.23) * 0.03, CLOSE.z - Math.min(t, 8) * 0.06);
  camera.position.lerpVectors(_hero, _close, e);
  camera.position.y += Math.sin(Math.PI * e) * (info.holo ? 0.9 : 0.25);  // arc over the hologram on the way
  _look.set(TGT.x + smooth.x * 0.8, TGT.y - smooth.y * 0.55, TGT.z).lerp(_p.set(CLOSE_T.x + smooth.x * 0.6, CLOSE_T.y - smooth.y * 0.4, CLOSE_T.z), e);
  // inspect: glide from where the camera was to the close-up (or back to the room camera computed above)
  focus.f = Math.min(1, focus.f + dt / 1.4); const fe = focus.f * focus.f * (3 - 2 * focus.f);
  if (focus.to) { focus.dest.copy(focus.to.pos); focus.dest.x += smooth.x * 0.1; focus.dest.y -= smooth.y * 0.06; camera.position.lerpVectors(focus.from.pos, focus.dest, fe); _look.lerpVectors(focus.from.tgt, focus.to.tgt, fe); }
  else if (focus.f < 1) { camera.position.lerpVectors(focus.from.pos, camera.position, fe); _look.lerpVectors(focus.from.tgt, _look, fe); }
  focus.cur.pos.copy(camera.position); focus.cur.tgt.copy(_look);
  camera.lookAt(_look);
  if (backdrop) backdrop.m.position.copy(camera.position).add(backdrop.off);            // Earth is at infinity: no parallax

  // orrery: turn the rings and blend the three baked light phases for the current angle
  const phi = CH_FIXED ?? t * CH_SPEED;
  for (const s in pivots) pivots[s].rotation.y = phi * s;
  if (PHASES.length === 3) uChand.value.set(...PHASES.map((p) => (1 + 2 * Math.cos(phi - p)) / 3));

  hologram?.update(t); routeMap?.update(t);
  if (!Q.has('noscreens')) screens.update();
  draw(t);
  if (DEBUG) probe();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- HUD
const clockEl = document.getElementById('clock');
if (clockEl) setInterval(() => { clockEl.textContent = tminus(); }, 500);

function start() {
  document.getElementById('loader').classList.add('done');
  document.getElementById('hud').classList.remove('hidden');
  camera.position.copy(CAM); camera.lookAt(TGT); selfTest();
  clock.start(); frame();
}
// textures were queued while building the scene; wait for them
if (manager.itemsLoaded === manager.itemsTotal) start(); else manager.onLoad = start;
window.__lobby = { picks, setFocus, step, series, renderer, scene, camera, post, gov, ready: () => intro,
  mode: () => ({ hdr: HDR_OK, tier, msaa: post.msaa, scale: +gov.scale.toFixed(2), size: `${post.scene.width}x${post.scene.height}`, mirror: `${refl.size.x}x${refl.size.y}` }) };
