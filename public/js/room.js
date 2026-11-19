// One room. Every room is a folder, assets/<id>/, holding the same three things from blender/bake.py:
//   scene.json (cameras, doors, what the room contains), room.glb (geometry) and tex/ (path-traced lighting).
// loadRoom() builds the scene from them and returns what main.js needs to show it, walk around it and throw it away.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SKIP, num, B, V, VERT, DIST, DSCALE, ADD, GLOW, uTime, uPx, uMirror, cloud, dispose } from './kit.js';
import { createScreens } from './screens.js';
import { createHologram } from './hologram.js';
import { createRouteMap } from './routemap.js';

const pickMat = new THREE.MeshBasicMaterial({ visible: false });
const CH_GAIN = num('chandgain', 0.5), CH_SPEED = (2 * Math.PI) / num('chandperiod', 48);
const CH_FIXED = Number.isNaN(num('chand', NaN)) ? null : num('chand', 0) * Math.PI / 180;      // ?chand=<degrees> stops the orrery there

/**
 * @param text  this room's entry in content.json
 * @param env   { camera, mirror, maxAniso, onProgress }: the shared camera, the floor-mirror target and its uniforms
 */
export async function loadRoom(id, text, { camera, mirror, maxAniso, onProgress }) {
  // ---------------------------------------------------------------- loading
  const base = `assets/${id}`, manager = new THREE.LoadingManager();
  manager.onProgress = (_url, n, total) => onProgress(n / total);
  const images = new THREE.TextureLoader(manager), bitmaps = typeof createImageBitmap === 'function' && [false, true].map((flip) =>
    new THREE.ImageBitmapLoader(manager).setOptions({ imageOrientation: flip ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  // HDR-encoded bakes (decoded in the shaders). Images are decoded off the main thread into ImageBitmaps where the
  // browser can, so a texture is never uploaded half-decoded and loading does not stall the page.
  function bakeTex(name, aniso = 4, flip = false) {
    const url = `${base}/tex/${name}.webp`;
    let t;
    if (bitmaps) { t = new THREE.Texture(); t.flipY = false; bitmaps[+flip].load(url, (bmp) => { t.image = bmp; t.needsUpdate = true; }); }
    else { t = images.load(url); t.flipY = flip; }
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = Math.min(aniso, maxAniso);
    return t;
  }
  const [info, gltf] = await Promise.all([fetch(`${base}/scene.json`).then((r) => r.json()), new GLTFLoader(manager).loadAsync(`${base}/room.glb`)]);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x010204);
  const CAM = B(info.cam), TGT = B(info.tgt), SUN = B(info.sun || [0, 1, 0.2]).normalize(), PORTAL = B(info.portal || [0, 1e4, 0]);
  const floors = [], hidden = [];                                  // not drawn into the mirror image: the floor itself; glass and dust

  // ---------------------------------------------------------------- materials
  const DEC = `vec3 dec(vec4 t){ return t.rgb*t.rgb*${info.hdr_range.toFixed(1)}; }`;       // inverse of bake.py save_encoded
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
  const uChand = { value: V(1 / 3, 1 / 3, 1 / 3) }, PHASES = (info.chand?.phases || []).map((d) => d * Math.PI / 180);
  const LAYERED = new Set(PHASES.length === 3 ? info.chand.layered : []);
  const layerUniforms = (grp) => (LAYERED.has(grp) ? Object.fromEntries(PHASES.map((_, i) => [`l${i}`, { value: bakeTex(`${grp}_c${i}`, 1) }])) : {});
  const layerGLSL = (grp, into) => (LAYERED.has(grp)
    ? `${into} += max(dec(texture2D(l0, vUv))*uChand.x + dec(texture2D(l1, vUv))*uChand.y + dec(texture2D(l2, vUv))*uChand.z, 0.0)*${CH_GAIN.toFixed(3)};` : '');
  const PARS = `uniform sampler2D map, l0, l1, l2; uniform vec3 uChand; uniform float uMirror; varying vec2 vUv; varying vec3 vW; ${DEC}`;
  const bakedMat = (map, grp, gain = 1) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uMirror, uGain: { value: gain }, uChand, ...layerUniforms(grp) }, side: THREE.DoubleSide, vertexShader: VERT,
    fragmentShader: `${PARS} uniform float uGain;
      void main(){ vec3 c = dec(texture2D(map, vUv)); ${layerGLSL(grp, 'c')} gl_FragColor = vec4(c*uGain, 1.0); ${DIST} }`,
  });
  // ---- polished floor: baked diffuse light + the live planar reflection that main.js renders into mirror.rt
  const F0 = ((info.floor.ior - 1) / (info.floor.ior + 1)) ** 2, ROUGH = (info.floor.rough[0] + info.floor.rough[1]) / 2;
  const floorMat = (map, grp) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, tRefl: { value: mirror.rt.texture }, uMirrorVP: { value: mirror.vp }, uSize: { value: mirror.size }, uPxR: mirror.pxPerRad,
      uMinLod: mirror.minLod, uAlpha: { value: ROUGH * ROUGH }, uTile: { value: info.floor.tile }, uF0: { value: F0 }, uMirror, uChand, ...layerUniforms(grp) },
    vertexShader: VERT,
    fragmentShader: `${PARS}
      uniform sampler2D tRefl; uniform mat4 uMirrorVP; uniform vec2 uSize; uniform float uPxR, uAlpha, uTile, uF0, uMinLod;
      void main(){
        vec3 diffuse = dec(texture2D(map, vUv)); ${layerGLSL(grp, 'diffuse')}
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
  // Frameless glass balustrade. Additive: what glass adds to the view is reflection, strongest at grazing angles,
  // plus the green-white glint of its polished edges (top edge and the joints between 2 m panels).
  const glassMat = new THREE.ShaderMaterial({
    ...GLOW, side: THREE.DoubleSide, vertexShader: VERT,
    fragmentShader: `varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float F = 0.04 + 0.96*pow(1.0 - abs(v.x), 5.0);                             // Fresnel; the panes face +-X
        float h = clamp((vW.y - 4.7)/0.93, 0.0, 1.0);
        vec3 refl = mix(vec3(0.10, 0.11, 0.13), vec3(0.30, 0.40, 0.50), h)*0.35;    // it mirrors the dim hall below, the lit roof above
        float j = abs(fract(vW.z/2.0 + 0.5) - 0.5)*2.0, fw = fwidth(vW.z/2.0)*2.0;  // panel joints every 2 m
        float joint = 1.0 - smoothstep(0.004, 0.004 + fw, j);
        float top = smoothstep(0.975, 0.99, vUv.y);
        gl_FragColor = vec4(refl*F + vec3(0.55, 0.9, 0.8)*(joint*0.10 + top*0.22), 1.0);
      }`,
  });

  // ---------------------------------------------------------------- scene graph
  const screens = createScreens(text.screens, Math.min(8, maxAniso), num('screens', 0.9));
  const screenMeshes = [], movers = [], pivots = {}, SPIN = info.chand?.spin || {};
  scene.add(gltf.scene);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const u = o.userData;
    if (u.grp?.startsWith('floor')) { o.material = floorMat(bakeTex(u.grp, 2), u.grp); floors.push(o); }
    else if (u.grp) o.material = bakedMat(bakeTex(u.grp, 4), u.grp);
    else if (u.em === 'static') o.material = stripMat;
    else if (u.em) {                                    // the orrery's lamps (baked far brighter than they are shown)
      const { color: c, strength } = info.em[u.em], k = Math.min(strength, 7);
      o.material = flatMat(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
    } else if (u.fx === 'screen') {                     // scene.json lists the screens in the order content.json describes them
      o.material = screens.materials[Math.max(0, (info.screens || []).indexOf(u.name)) % screens.materials.length]; screenMeshes.push(o);
    } else if (u.fx === 'glass') { o.material = glassMat; o.renderOrder = 5; hidden.push(o); }
    o.frustumCulled = false; o.matrixAutoUpdate = false; o.updateMatrix();
    if (SPIN[u.grp] ?? SPIN[u.em]) movers.push(o);
  });
  // the orrery: rings tagged +1 and -1 turn in opposite directions about the vertical axis through the dais
  for (const o of movers) {
    const turn = SPIN[o.userData.grp] ?? SPIN[o.userData.em];
    if (!pivots[turn]) { pivots[turn] = new THREE.Group(); pivots[turn].position.set(info.chand.pivot[0], 0, -info.chand.pivot[1]); scene.add(pivots[turn]); pivots[turn].updateMatrixWorld(); }
    pivots[turn].attach(o); o.updateMatrix();
  }

  // ---- outside: Earth at sunrise (NASA Blue Marble + Black Marble imagery) rendered in Cycles; effectively at infinity
  let backdrop, shaft;
  if (info.portal) {
    const D = 900, dir = PORTAL.clone().sub(CAM).normalize(), size = 2 * D * Math.tan(THREE.MathUtils.degToRad((info.backdrop_fov || 80) / 2));
    backdrop = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bakedMat(bakeTex('backdrop', 4, true), null, num('earth', 0.75)));
    backdrop.position.copy(CAM).addScaledVector(dir, D); backdrop.lookAt(CAM); backdrop.frustumCulled = false; backdrop.userData.offset = dir.multiplyScalar(D);
    // The sun, just above Earth's horizon: the focal point of the whole composition. Drawn at infinity for whichever
    // camera is rendering, so it also appears, stretched into a glare path, in the floor.
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      ...GLOW, uniforms: { uDir: { value: SUN }, uSize: { value: 0.16 }, uGain: { value: num('sun', 1.0) }, uMirror },
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
    sun.frustumCulled = false; sun.renderOrder = 1; scene.add(backdrop, sun);
  }
  // ---- thunderstorms flickering in the clouds on Earth's night side. Points on the globe (taken from the Cycles scene)
  // are projected to infinity, like the backdrop itself.
  if (info.earth && !SKIP.has('storms')) {
    const C = B(info.earth.c), U = B(info.earth.u).normalize(), pos = [], seed = [];
    const across = V().crossVectors(U, SUN).normalize(), sunward = SUN.clone().addScaledVector(U, -SUN.dot(U)).normalize(), jit = () => (Math.random() - 0.5) * 0.035;
    for (const [a, b, n] of [[-0.09, -0.16, 7], [0.07, -0.21, 6], [-0.2, -0.1, 5], [0.16, -0.13, 6], [0.0, -0.27, 5]]) {      // b < 0: on the night side
      for (let i = 0; i < n; i++) {
        const p = U.clone().addScaledVector(across, a + jit()).addScaledVector(sunward, b + jit()).normalize().multiplyScalar(info.earth.r * 1.002).add(C).sub(CAM).setLength(870);
        pos.push(p.x, p.y, p.z); seed.push(a * 91.7 + b * 37.3 + Math.random() * 0.3);
      }
    }
    const storms = cloud(pos, new THREE.ShaderMaterial({
      ...GLOW, uniforms: { uTime, uPx },
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
    }), { seed });
    storms.renderOrder = 1; scene.add(storms);
  }
  // ---- sunbeam: the hall's air is faintly hazy, so the light entering through the portal is visible. Single
  // scattering integrated analytically per pixel: (length of the view ray inside the beam) x (phase function).
  // The camera stands inside the beam, so this mostly reads as glare gathering around the sun.
  if (info.portal_r && !SKIP.has('shaft')) {
    const A = SUN.clone().negate(), R = info.portal_r * 0.86, L = 44, seg = 48, pos = [], idx = [];
    for (let i = 0; i < seg; i++) {
      const a = i / seg * 6.2832, p = V(PORTAL.x + Math.cos(a) * R, PORTAL.y + Math.sin(a) * R, PORTAL.z), n = (i + 1) % seg;
      pos.push(p.x, p.y, p.z, p.x + A.x * L, p.y + A.y * L, p.z + A.z * L);
      idx.push(i * 2, n * 2, i * 2 + 1, n * 2, n * 2 + 1, i * 2 + 1, seg * 2, i * 2, n * 2, seg * 2 + 1, n * 2 + 1, i * 2 + 1);      // side wall + both end caps
    }
    pos.push(PORTAL.x, PORTAL.y, PORTAL.z, PORTAL.x + A.x * L, PORTAL.y + A.y * L, PORTAL.z + A.z * L);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    shaft = new THREE.Mesh(g, new THREE.ShaderMaterial({
      ...GLOW, depthTest: false, side: THREE.DoubleSide, uniforms: { uC: { value: PORTAL }, uA: { value: A }, uR: { value: R }, uK: { value: num('haze', 0.4) } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uC, uA; uniform float uR, uK; varying vec3 vW;
        void main(){
          // the volume is convex and the camera stands inside it, so every view ray crosses its surface exactly once
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
    shaft.frustumCulled = false; shaft.renderOrder = 4; scene.add(shaft);
  }
  // ---- drifting dust; motes inside the sunbeam catch the light
  if (!SKIP.has('dust')) {
    const N = 1200, rnd = Math.random, pos = Array.from({ length: N }, () => [(rnd() - 0.5) * 13, rnd() * 9 + 0.2, 4 - rnd() * 30]).flat();
    const dust = cloud(pos, new THREE.ShaderMaterial({
      ...GLOW, uniforms: { uTime, uPx, uSun: { value: SUN }, uPortal: { value: PORTAL }, uPR: { value: (info.portal_r || 1) * 0.86 } },
      vertexShader: `attribute float seed; uniform float uTime, uPx, uPR; uniform vec3 uSun, uPortal; varying vec3 vC;
        void main(){ vec3 p = position; float t = uTime*0.12;
          p.x += sin(t + seed)*0.5; p.y += sin(t*0.7 + seed*1.7)*0.4; p.z += cos(t*0.9 + seed*0.6)*0.5;
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          float px = (0.010 + 0.008*fract(seed))*uPx/max(-mv.z, 0.01); gl_PointSize = max(px, 1.6);
          vec3 q = p - uPortal; float along = -dot(q, uSun), off = length(q + uSun*along);
          float lit = (1.0 - smoothstep(uPR*0.8, uPR, off))*step(0.0, along);
          vC = mix(vec3(0.75,0.88,1.0)*0.1, vec3(1.0,0.82,0.62)*1.3, lit)*(0.25 + 0.5*fract(seed*7.3))*smoothstep(0.6, 3.0, -mv.z)*min(1.0, px*px/2.56); }`,
      fragmentShader: `varying vec3 vC; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(vC*a*a, 1.0); }`,
    }), { seed: Array.from({ length: N }, () => rnd() * 100) });
    scene.add(dust); hidden.push(dust);
  }
  const hologram = info.holo && !SKIP.has('holo')
    ? await createHologram({ scene, position: B(info.holo).add(V(0, 0.1, 0)), sunDir: SUN, text: text.hologram, base, radius: 0.74, gain: num('holo', 2.0) }) : null;
  const routeMap = info.map ? createRouteMap({ scene, center: B(info.map.c), stops: text.stations, radius: info.map.r, gain: num('map', 1.6) }) : null;

  // ---------------------------------------------------------------- interactables
  // Each has a pick mesh and a pose (where the camera stands, what it looks at); main.js glides the camera there.
  const picks = [], tanV = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), middle = CAM.clone().lerp(TGT, 0.5);
  const pickMesh = (geometry, parent, position) => { const m = new THREE.Mesh(geometry, pickMat); m.position.copy(position); parent.add(m); return m; };
  scene.updateMatrixWorld(true);
  // a flat display: stand square in front of it, filling the view
  for (const o of text.screens.inspect === false ? [] : screenMeshes) {
    const p = o.geometry.attributes.position, ix = o.geometry.index, v = [0, 1, 2, 3].map((i) => V().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    const c = v.reduce((a, b) => a.add(b), V()).multiplyScalar(0.25), tri = [0, 1, 2].map((i) => v[ix ? ix.getX(i) : i]);
    const n = V().crossVectors(tri[1].clone().sub(tri[0]), tri[2].clone().sub(tri[0])).normalize();
    if (n.dot(middle.clone().sub(c).setY(0)) < 0) n.negate();                // the side that faces into the room
    const along = V().crossVectors(V(0, 1, 0), n).normalize(), span = (f) => Math.max(...v.map(f)) - Math.min(...v.map(f));
    const w = span((q) => q.dot(along)), h = span((q) => q.y);
    picks.push({ mesh: o, pose: () => ({ pos: c.clone().addScaledVector(n, Math.max(h / 2 / tanV(), w / 2 / (tanV() * camera.aspect)) * 1.12), tgt: c }) });
  }
  // Holograms open up instead: the camera only comes closer, along its own line of sight, while the display grows
  // and unfolds its detail layer.
  function addHolo(parent, local, r, dist, lift, target) {
    const mesh = pickMesh(new THREE.SphereGeometry(r, 12, 8), parent, local);
    picks.push({ mesh, onFocus: target.setExpanded, pose: () => {
      const c = mesh.getWorldPosition(V()); c.y += lift;
      const d = CAM.clone().sub(c); d.y *= 0.35;
      return { pos: c.clone().addScaledVector(d.normalize(), dist / Math.min(1, camera.aspect / 1.5)), tgt: c };
    } });
  }
  for (const s of routeMap?.stations || []) addHolo(s.grp, V(0, 0.42, 0), 0.48, 2.9, 0.3, s);
  if (hologram) addHolo(scene, hologram.root.position, 1.0, 5.6, 0.55, hologram);
  // exhibits and other round-ish things: frame a sphere of radius r from the direction scene.json gives
  for (const f of info.focus || []) {
    const mesh = pickMesh(new THREE.SphereGeometry(f.r * 0.8, 12, 8), scene, B(f.c)), d = B(f.dir).normalize();
    picks.push({ mesh, pose: () => ({ pos: mesh.position.clone().addScaledVector(d, f.r / Math.min(tanV(), tanV() * camera.aspect) * 1.25), tgt: mesh.position }) });
  }
  // doors: walk up to it; main.js then goes through to door.to (another room's id; '' = sealed)
  for (const door of info.doors || []) {
    const c = B(door.c), n = B(door.n).normalize(), mesh = pickMesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), scene, c);
    picks.push({ mesh, door, pose: () => ({ pos: c.clone().addScaledVector(n, 4.2 / Math.min(1, camera.aspect / 1.2)).setY(c.y + 0.5), tgt: c.clone().setY(c.y + 0.25) }) });
  }

  await new Promise((done) => (manager.itemsLoaded === manager.itemsTotal ? done() : (manager.onLoad = done)));   // textures queued above
  return {
    id, info, scene, picks, floors, hidden, CAM, TGT,
    CLOSE: B(info.close || [0, 17.2, 2.15]), CLOSE_TGT: B(info.close_tgt || [0, 26, 2.6]), arc: info.holo ? 0.9 : 0.25,     // arc: how high the pull-back lifts over the middle
    exposure: num('exp', info.exposure || 0.85),
    /** Per frame, after the camera has been placed. */
    update(t) {
      backdrop?.position.copy(camera.position).add(backdrop.userData.offset);          // Earth is at infinity: no parallax
      // orrery: turn the rings and blend the three baked light phases for the current angle
      const phi = CH_FIXED ?? t * CH_SPEED;
      for (const turn in pivots) pivots[turn].rotation.y = phi * turn;
      if (PHASES.length === 3) uChand.value.set(...PHASES.map((p) => (1 + 2 * Math.cos(phi - p)) / 3));
      hologram?.update(t); routeMap?.update(t); screens.update();
    },
    dispose: () => dispose(scene),
  };
}
