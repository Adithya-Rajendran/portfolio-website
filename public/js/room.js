// One room. Every room is a folder, assets/<id>/, holding the same three things from blender/bake.py:
//   scene.json (cameras, doors, what the room contains), room.glb (geometry) and tex/ (path-traced lighting).
// loadRoom() builds the scene from them and returns what main.js needs to show it, walk around it and throw it away.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Q, SKIP, num, B, V, VERT, DIST, DSCALE, ADD, GLOW, uTime, uPx, uMirror, cloud, dispose } from './kit.js';
import { createScreens } from './screens.js';
import { createHologram } from './hologram.js';
import { createRouteMap } from './routemap.js';
import { createDrone } from './drone.js';
import { createReader } from './reader.js';
import { createComms } from './comms.js';
import { probePars, chartPars, chartParsLive, chartReflection, probeEnvironment, liveSpecPars } from './reflections.js';
import { windowShadow, receiveWindowSun } from './sunlight.js';

const pickMat = new THREE.MeshBasicMaterial({ visible: false });
const _m3 = new THREE.Matrix3(), _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion();
let ktx2;                                                           // one transcoder (and its workers) for every room
const CH_GAIN = num('chandgain', 1), EARTH = num('earth', 1), CH_SPEED = (2 * Math.PI) / num('chandperiod', 48);
// The station spins, so the sky turns in the windows. ?roll=<seconds per turn> overrides the room's own period (0 stops it);
// ?rollat=<degrees> holds one angle.
const ROLL = num('roll', 0), ROLL_AT = num('rollat', NaN), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CH_FIXED = Number.isNaN(num('chand', NaN)) ? null : num('chand', 0) * Math.PI / 180;      // ?chand=<degrees> stops the orrery there

/**
 * @param text  this room's entry in content.json
 * @param env   { renderer, camera, mirror, maxAniso, onProgress }: the shared renderer and camera, the floor-mirror target and its uniforms;
 *              display: content.json "display", the words the visitor's display uses to say what a pick is and what a click on it does
 */
export async function loadRoom(id, text, { renderer, camera, mirror, maxAniso, onProgress, onLink, onShown, clearance, want, words, display: D }) {
  // ---------------------------------------------------------------- loading
  const base = `assets/${id}`; let info, arrived = 0;
  // The bakes are KTX2 files (tools/pack.py): they stay block-compressed on the GPU and bring their own mipmaps. The
  // pixels are HDR-encoded and decoded in the shaders. Returns the uniform now; the texture drops into it when it arrives,
  // and once it is on the GPU the copy in RAM is let go.
  ktx2 ??= new KTX2Loader().setTranscoderPath('vendor/jsm/libs/basis/').detectSupport(renderer);
  const pending = []; let textureError;
  function bakeTex(name, aniso = 4, panorama = false) {
    const u = { value: null }, got = () => onProgress(++arrived / pending.length);
    pending.push(new Promise((done) => ktx2.load(`${base}/tex/${name}.ktx2?v=${info.v || 0}`, (t) => { if (panorama) t.wrapS = THREE.RepeatWrapping; t.anisotropy = Math.min(aniso, maxAniso); t.onUpdate = () => { for (const m of t.mipmaps) m.data = null; }; u.value = t; done(); }, undefined, (e) => { textureError ??= new Error(`Cannot load ${id}/${name}.ktx2`, {cause:e}); done(); })).then(got));
    return u;
  }
  // scene.json is always re-checked with the server; it names the bake (info.v), and every other file is asked for by
  // that name, so a browser can never mix an old texture into a new bake.
  info = await fetch(`${base}/scene.json`, { cache: 'no-cache' }).then((r) => r.json());
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`${base}/room.glb?v=${info.v || 0}`);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x010204);
  const CAM = B(info.cam), TGT = B(info.tgt), SUN = B(info.sun || [0, 1, 0.2]).normalize(), sunNow = SUN.clone(), PORTAL = B(info.portal || [0, 1e4, 0]);
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
  const layerUniforms = (grp) => (LAYERED.has(grp) ? { lc: bakeTex(`${grp}_c`, 1) } : {});       // one array texture, a layer per phase
  const layerGLSL = (grp, into) => (LAYERED.has(grp)
    ? `${into} += max(dec(texture(lc, vec3(vUv, 0.0)))*uChand.x + dec(texture(lc, vec3(vUv, 1.0)))*uChand.y + dec(texture(lc, vec3(vUv, 2.0)))*uChand.z, 0.0)*${CH_GAIN.toFixed(3)};` : '');
  // ---- a spinning room (info.spin). The light from outside turns with the sky:
  //   sky layers: Earth-light and bounced sunlight, baked at N angles; the two nearest are cross-faded
  //   direct sun: shadowed diffuse, plus the polished material's directional GGX lobe. A depth map that
  //   prepass() renders from the sun through the window every frame.
  const SPUN = info.spin, LIT = new Set(SPUN?.layered || []), NSKY = SPUN?.phases || 0, SH = num('shadow', 2048);
  // Sun-space, not screen-space. Keep about 20 m outside the window and 50 m into the
  // compartment. Bias follows a shadow texel in metres, not a fixed 17 cm gap at every contact.
  const shadowHalf = SPUN?.half || (info.portal_r || 5) + 1.2, shadowTexel = 2*shadowHalf/Math.max(1,SH);
  const shadow = SPUN && { rt: new THREE.WebGLRenderTarget(SH, SH, { format: THREE.RedFormat, depthTexture: new THREE.DepthTexture(SH, SH), generateMipmaps: false }),
    cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 40, 110), mat: new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }) };
  const uSunVP = { value: new THREE.Matrix4() }, uSunDir = { value: sunNow }, uSky = { value: V(0, 1, 0) },       // uSky: the two baked angles either side of the sky's, and the mix
    uSunE = { value: V(...(SPUN?.sun_e || [0, 0, 0])).multiplyScalar(num('sunlight', 1) / Math.PI) };
  const litUniforms = (grp) => {
    if (!LIT.has(grp)) return {};
    return { tAlb: bakeTex(`${grp}_a`, 4), sk: bakeTex(`${grp}_s`, 1), tShadow: { value: shadow.rt.depthTexture }, uSunVP, uSunDir, uSunE, uSky };
  };
  // LIVE: a bake with nothing view-dependent in it (blender/bake.py 'finish'); every reflection is drawn here.
  const LIVE = !!info.finish && !SKIP.has('live');
  const probe = info.probe, polished = new Set(LIVE ? [] : probe?.groups || []), finished = new Set(LIVE ? info.finish.groups : []);
  const chart = probe && info.map && !SKIP.has('chartreflection') ? chartReflection(B(info.map.c),info.map.r,mirror) : null;
  let probeU;
  if (probe) {
    const a = B(probe.bounds.min), b = B(probe.bounds.max);
    probeU = {tRoomSpec:bakeTex('probe_c',1,true), uProbePos:{value:probe.probes ? probe.probes.map((p) => B(p.origin)) : B(probe.origin)},
      uBoxLo:{value:a.clone().min(b)}, uBoxHi:{value:a.clone().max(b)}, uProbeRange:{value:probe.range}, uSpecGain:{value:num('spec',1)}};
  }
  // The window's sky, for reflected rays leaving the room: the same backdrop texture as the window, turned with it.
  const skyTex = info.portal ? bakeTex('backdrop', 4) : null;
  const skyU = LIVE && skyTex && !SKIP.has('skyrefl') ? { tSky: skyTex, uSkyM: { value: new THREE.Matrix3() }, uSkyHalf: { value: Math.tan(THREE.MathUtils.degToRad((info.backdrop_fov || 80) / 2)) },
    uSkyGain: { value: EARTH }, uSkyLod: { value: 0 } } : null;
  // Things that turn (the orrery): rendered into a small cube each frame, seen in reflections on a sphere around them.
  const LIVE_LAYER = 6, liveRT = LIVE && info.chand?.center && !SKIP.has('liverefl') ? new THREE.WebGLCubeRenderTarget(num('livecube', 128), { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }) : null;
  const liveBlank = liveRT && new THREE.WebGLCubeRenderTarget(1);
  const liveU = liveRT && { tLive: { value: liveRT.texture }, uLiveEye: { value: B([info.chand.center[0], info.chand.center[1], 2.4]) }, uLiveC: { value: B(info.chand.center) },
    uLiveR: { value: num('liver', 2.6) }, uLiveLod: { value: 0 } };
  // The lamps' own highlights (their light is in the bake; a lamp itself is invisible to the probes).
  const LAMPS = LIVE && !SKIP.has('lamps') ? (info.lights || []).slice(0, 16) : [];
  const lampU = LAMPS.length ? { uLP: { value: LAMPS.map((l) => B(l.pos)) }, uLI: { value: LAMPS.map((l) => V(...l.intensity)) },
    uLD: { value: LAMPS.map((l) => (l.dir ? B(l.dir) : V())) }, uLS: { value: LAMPS.map((l) => V(l.radius, l.dir ? l.cos : -2, l.dir ? l.smooth : 0)) } } : {};
  const livePars = LIVE && probe ? liveSpecPars({ probes: probe.probes?.length || 1, sky: !!skyU, live: !!liveU, lights: LAMPS.length }) : '';
  const visibility = windowShadow(shadowTexel,SH);
  const litGLSL = (grp, into) => (LIT.has(grp) ? `
      ${into} += mix(dec(texture(sk, vec3(vUv, uSky.x))), dec(texture(sk, vec3(vUv, uSky.y))), uSky.z)*${num('sky', 1).toFixed(3)};
      { vec3 n = normalize(vN); float ndl = dot(n, uSunDir);
        float open=windowVisibility(vW,n,ndl);
        if (open > 0.) {
          vec4 a = texture2D(tAlb, vUv);
          ${into} += (a.rgb*a.rgb${polished.has(grp) ? ' + sunSpec(n,normalize(cameraPosition-vW),uSunDir)' : ''})*uSunE*(ndl*open);
        } }` : '');
  const vert = (grp) => (LIT.has(grp) || polished.has(grp) ? `varying vec2 vUv; varying vec3 vW,vN; ${polished.has(grp) ? 'varying vec4 vFinish;' : ''}
    void main(){ vUv = uv; vN = (vec4(normalMatrix*normal,0.)*viewMatrix).xyz;
      ${polished.has(grp) ? 'vFinish = color;' : ''} vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }` : VERT);
  const PARS = `uniform sampler2D map, tAlb, tShadow; uniform highp sampler2DArray lc, sk; uniform vec3 uChand, uSunDir, uSunE, uSky; uniform mat4 uSunVP; uniform float uMirror;
    varying vec2 vUv; varying vec3 vW, vN; ${DEC} ${visibility}`;
  const bakedMat = (map, grp, gain = 1) => (finished.has(grp) ? liveMat(map, grp, gain) : new THREE.ShaderMaterial({
    uniforms: { map, uMirror, uGain: { value: gain }, uChand, ...layerUniforms(grp), ...litUniforms(grp), ...(polished.has(grp) ? {...probeU,...chart?.uniforms} : {}) },
    side: THREE.DoubleSide, vertexColors: polished.has(grp), vertexShader: vert(grp),
    fragmentShader: `${PARS} uniform float uGain; ${polished.has(grp) ? probePars + (chart ? chartPars : '') : ''}
      void main(){ vec3 c = dec(texture2D(map, vUv)); ${layerGLSL(grp, 'c')} ${litGLSL(grp, 'c')}
        ${polished.has(grp) ? 'vec3 N = normalize(vN), V = normalize(cameraPosition-vW); c += roomSpec(vW,dot(N,V) < 0. ? -N : N,V);' : ''}
        ${polished.has(grp) && chart ? 'c += chartLight(vW,N,V);' : ''}
        gl_FragColor = vec4(c*uGain, 1.0); ${DIST} }`,
  }));
  // Every baked surface of a LIVE room. The atlas is what leaves it diffusely, evaluated looking straight down onto
  // it; at this pixel's angle the specular layers (base and coat) take more of the light, so the diffuse is reduced
  // by the ratio of their reflectances, before their reflections are added for this eye.
  const LUM = 'vec3(.2126,.7152,.0722)';
  const FINISH_VIEW = num('finishview', 0);         // QA: 1 roughness, 2 occlusion, 3 lamp visibility, 4 reflectance scale, 5 coat, 6 diffuse kept, 7 window sun, 8 normal
  const liveMat = (map, grp, gain) => new THREE.ShaderMaterial({
    uniforms: { map, tFin: bakeTex(`${grp}_f`, 2), uMirror, uGain: { value: gain }, uChand, ...layerUniforms(grp), ...litUniforms(grp), ...probeU, ...skyU, ...liveU, ...lampU, ...chart?.uniforms },
    side: THREE.DoubleSide, vertexColors: true,
    vertexShader: `attribute vec2 uv1; varying vec2 vUv, vCoat; varying vec3 vW, vN; varying vec4 vSpec;
      void main(){ vUv = uv; vCoat = uv1; vSpec = color; vN = (vec4(normalMatrix*normal,0.)*viewMatrix).xyz;
        vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `${PARS} uniform float uGain; uniform sampler2D tFin; varying vec2 vCoat; varying vec4 vSpec;
      ${livePars} ${chart ? chartParsLive : ''}
      void main(){
        vec3 c = dec(texture2D(map, vUv)); ${layerGLSL(grp, 'c')}
        ${LIT.has(grp) ? `c += mix(dec(texture(sk, vec3(vUv, uSky.x))), dec(texture(sk, vec3(vUv, uSky.y))), uSky.z)*${num('sky', 1).toFixed(3)};` : ''}
        c *= ${num('baked', 1).toFixed(3)};                  // QA: ?baked=0 leaves only the live terms
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N, V) < 0.) N = -N;
        float nv = clamp(dot(N, V), 1e-3, 1.);
        vec4 fin = texture2D(tFin, vUv);                    // roughness, occlusion, lamp visibility, reflectance/2
        float rough = clamp(fin.r, .045, 1.), coatW = vSpec.a, coatR = clamp(vCoat.x, .045, 1.);
        vec3 F0 = vSpec.rgb*(2.*fin.a);
        vec2 ab = envAB(rough, nv), ab1 = envAB(rough, 1.), cb = envAB(coatR, nv), cb1 = envAB(coatR, 1.);
        vec3 E = F0*ab.x + ab.y; float Ec = coatW*(.04*cb.x + cb.y);
        float keep = (1. - dot(E, ${LUM}))/max(.05, 1. - dot(F0*ab1.x + ab1.y, ${LUM}))*(1. - Ec)/max(.05, 1. - coatW*(.04*cb1.x + cb1.y));
        c *= keep;
        vec3 R = reflect(-V, N);
        const float ENV = ${num('env', 1).toFixed(3)};    // QA: ?env=0 drops the room/sky/live environment
        Env env = envSetup(vW, R);
        vec3 spec = envLobe(env, vW, R, rough)*E*specOcc(fin.g, nv, rough)*ENV;
        ${LAMPS.length ? 'spec += lampLobe(vW, N, V, F0, rough)*fin.b;' : ''}
        ${chart ? 'spec += chartLive(vW, N, V, E, rough);' : ''}
        ${LIT.has(grp) ? `float ndl = dot(N, uSunDir), open = windowVisibility(vW, N, ndl);
        if (open > 0.) { vec4 a = texture2D(tAlb, vUv); c += a.rgb*a.rgb*keep*uSunE*(ndl*open);
          spec += ggx(N, V, uSunDir, F0, max(rough*rough, .002))*uSunE*(3.14159265*open); }` : 'float open = 0.;'}
        if (coatW > .005) {                                 // a clear coat: a sharp second lobe over all of that
          spec = spec*(1. - Ec) + envLobe(env, vW, R, coatR)*Ec*specOcc(fin.g, nv, coatR)*ENV;
          ${LAMPS.length ? 'spec += lampLobe(vW, N, V, vec3(.04), coatR)*(coatW*fin.b);' : ''}
          ${LIT.has(grp) ? 'if (open > 0.) spec += ggx(N, V, uSunDir, vec3(.04), max(coatR*coatR, .002))*uSunE*(3.14159265*open*coatW);' : ''}
        }
        gl_FragColor = vec4((c + spec*uSpecGain)*uGain, 1.0);
        ${FINISH_VIEW === 8 ? 'gl_FragColor = vec4(N*.5 + .5, 1.);' : FINISH_VIEW ? `gl_FragColor = vec4(vec3(${['fin.r', 'fin.g', 'fin.b', 'fin.a*2.', 'vSpec.a', 'keep', 'open'][FINISH_VIEW - 1]}), 1.);` : ''} ${DIST} }`,
  });
  // ---- polished floor: baked diffuse light + the live planar reflection that main.js renders into mirror.rt
  const F0 = ((info.floor.ior - 1) / (info.floor.ior + 1)) ** 2, ROUGH = (info.floor.rough[0] + info.floor.rough[1]) / 2;
  const floorMat = (map, grp) => new THREE.ShaderMaterial({
    uniforms: { map, tRefl: { value: mirror.rt.texture }, uMirrorVP: { value: mirror.vp }, uSize: { value: mirror.size }, uPxR: mirror.pxPerRad,
      uMinLod: mirror.minLod, uAlpha: { value: ROUGH * ROUGH }, uTile: { value: info.floor.tile }, uF0: { value: F0 }, uFloorRefl: {value:num('floorrefl',1)}, uMirror, uChand, ...layerUniforms(grp), ...litUniforms(grp),
      ...(LIVE ? { ...probeU, ...skyU, ...liveU, ...lampU } : {}) },
    vertexShader: vert(grp),
    fragmentShader: `${PARS}
      uniform sampler2D tRefl; uniform mat4 uMirrorVP; uniform vec2 uSize; uniform float uPxR, uAlpha, uTile, uF0, uMinLod, uFloorRefl;
      ${LIVE ? livePars : ''}
      void main(){
        vec3 diffuse = dec(texture2D(map, vUv)); ${layerGLSL(grp, 'diffuse')} ${litGLSL(grp, 'diffuse')}
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
        gl_FragColor = vec4(diffuse*(1.0 - F)*(1.0 - 0.5*joint) + R*F*uFloorRefl*(1.0 - 0.9*joint), 1.0);
        ${LIVE && LIT.has(grp) ? `{   // the sun's glare: GGX for this eye, widened for the 0.9 degree disc (Karis), shadowed like the sunlight
          float ndl = uSunDir.y, open = windowVisibility(vW, vec3(0., 1., 0.), ndl);
          if (open > 0.) {
            float a = uAlpha, aw = a + .0039, a2 = aw*aw, nv = max(V.y, 1e-3); vec3 H = normalize(uSunDir + V);
            float d = H.y*H.y*(a2 - 1.) + 1., vis = .5/max(1e-4, ndl*sqrt(nv*nv*(1. - a2) + a2) + nv*sqrt(ndl*ndl*(1. - a2) + a2));
            float Fs = uF0 + (1. - uF0)*pow(1. - clamp(dot(V, H), 0., 1.), 5.);
            gl_FragColor.rgb += uSunE*(Fs*a2*vis/(d*d)*ndl*(a*a/(aw*aw))*open*uFloorRefl*(1. - 0.9*joint));
          } }` : ''}
        ${LIVE && LAMPS.length ? 'gl_FragColor.rgb += lampLobe(vW, vec3(0., 1., 0.), V, vec3(uF0), sqrt(uAlpha))*uFloorRefl*(1. - 0.9*joint);   // lamps have no geometry to mirror' : ''}
      }`,
  });
  // Frameless glass balustrade. Additive: what glass adds to the view is reflection, strongest at grazing angles,
  // plus the green-white glint of its polished edges (top edge and the joints between 2 m panels).
  const glassMat = LIVE ? new THREE.ShaderMaterial({
    ...GLOW, uniforms: { ...probeU, ...skyU, ...liveU, ...lampU, uMirror }, side: THREE.DoubleSide, vertexShader: VERT,
    fragmentShader: `varying vec3 vW; varying vec2 vUv; uniform float uMirror; ${livePars}
      void main(){
        vec3 v = normalize(cameraPosition - vW), n = vec3(v.x < 0. ? -1. : 1., 0., 0.);   // the panes face +-X
        vec2 ab = envAB(.065, clamp(abs(v.x), 1e-3, 1.));
        float j = abs(fract(vW.z/2.0 + 0.5) - 0.5)*2.0, fw = fwidth(vW.z/2.0)*2.0, joint = 1.0 - smoothstep(0.004, 0.004 + fw, j);
        float top = smoothstep(0.975, 0.99, vUv.y);
        gl_FragColor = vec4(envAlong(vW, reflect(-v, n), .065)*(vec3(.041,.044,.043)*ab.x + ab.y)*uSpecGain + vec3(0.55, 0.9, 0.8)*(joint*0.10 + top*0.22), 1.0);
      }`,
  }) : new THREE.ShaderMaterial({
    ...GLOW, uniforms:probeU || {}, side: THREE.DoubleSide, vertexShader: VERT,
    fragmentShader: `varying vec3 vW; varying vec2 vUv;
      ${probe ? probePars.replace('varying vec4 vFinish;', 'const vec4 vFinish=vec4(.041,.044,.043,.065);') : ''}
      void main(){
        vec3 v = normalize(cameraPosition - vW);
        float F = 0.04 + 0.96*pow(1.0 - abs(v.x), 5.0);                             // Fresnel; the panes face +-X
        float h = clamp((vW.y - 4.7)/0.93, 0.0, 1.0);
        vec3 refl = mix(vec3(0.10, 0.11, 0.13), vec3(0.30, 0.40, 0.50), h)*0.35;    // it mirrors the dim hall below, the lit roof above
        float j = abs(fract(vW.z/2.0 + 0.5) - 0.5)*2.0, fw = fwidth(vW.z/2.0)*2.0;  // panel joints every 2 m
        float joint = 1.0 - smoothstep(0.004, 0.004 + fw, j);
        float top = smoothstep(0.975, 0.99, vUv.y);
        gl_FragColor = vec4(${probe ? 'roomSpec(vW,vec3(v.x<0.?-1.:1.,0.,0.),v)' : 'refl*F'} + vec3(0.55, 0.9, 0.8)*(joint*0.10 + top*0.22), 1.0);
      }`,
  });

  // ---------------------------------------------------------------- scene graph
  // the Library's volumes are the posts; its shelves hold as many as the room has places, and the terminal lists them
  const volumes = info.drone ? (text.volumes || []).slice(0, info.drone.slots.length) : [];
  { // ... and always the one this page's address asks for, in the last place if it is older than those
    const asked = info.drone && want && !volumes.some((v) => v.slug === want) && text.volumes.find((v) => v.slug === want);
    if (asked) volumes[volumes.length - 1] = asked;
  }
  const shelf = text.screens.list.find((x) => x.layout === 'catalogue'); if (shelf) Object.assign(shelf, { volumes, selected: -1, rev: 0 });
  const screens = createScreens(text.screens, renderer, Math.min(8, maxAniso), num('screens', 0.9));
  const screenMeshes = [], movers = [], pivots = {}, SPIN = info.chand?.spin || {};
  scene.add(gltf.scene);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const u = o.userData = { ...o.parent.userData, ...o.userData }          // tools/pack.py leaves each mesh in a child of its named node;
    if (polished.has(u.grp) && o.geometry.getAttribute('color')?.itemSize !== 4) throw new Error(`${id}/${u.grp}: missing packed specular colour/roughness`);
    if (u.grp?.startsWith('floor')) { o.material = floorMat(bakeTex(u.grp, 2), u.grp); floors.push(o); }
    else if (u.grp) o.material = bakedMat(bakeTex(u.grp, 4), u.grp);
    else if (u.em === 'static') o.material = stripMat;
    else if (u.em) {                                    // the orrery's lamps, as bright as the strips may be (bake.py EM_RANGE)
      const { color: c, strength } = info.em[u.em], k = Math.min(strength, info.em_range || 8);
      o.material = flatMat(new THREE.Color(c[0] * k, c[1] * k, c[2] * k));
    } else if (u.fx === 'screen') {                     // scene.json lists the screens in the order content.json describes them
      o.userData.screen = Math.max(0, (info.screens || []).indexOf(u.name)) % screens.materials.length;        // which entry of the room's screens it shows
      o.material = screens.materials[o.userData.screen]; screenMeshes.push(o);
    } else if (u.fx === 'glass') { o.material = glassMat; o.renderOrder = 5; hidden.push(o); }
    o.frustumCulled = false; o.matrixAutoUpdate = false; o.updateMatrix();
    if (u.grp) o.layers.enable(1);                      // layer 1: what casts a shadow in the sunlight
    if (SPIN[u.grp] ?? SPIN[u.em]) movers.push(o);
  });
  // Depth pre-pass: the baked surfaces overlap about twice per pixel and theirs is the expensive shader, so each is
  // first drawn depth-only (same vertex code, so the same depths; renderOrder -1 puts these first) and its real material
  // then shades only what is seen. Children of the meshes, so they follow the orrery and hide with the floor; drawn in
  // the same render() as everything else, since a separate pass would cost another MSAA resolve.
  if (!SKIP.has('zpre')) {
    const zMat = [THREE.FrontSide, THREE.DoubleSide].map((side) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: 'void main(){}', colorWrite: false, side }));
    const baked = []; gltf.scene.traverse((o) => { if (o.isMesh && o.userData.grp) baked.push(o); });
    for (const o of baked) { const z = new THREE.Mesh(o.geometry, zMat[+(o.material.side === THREE.DoubleSide)]); z.renderOrder = -1; z.frustumCulled = false; o.add(z); }
  }
  // the orrery: rings tagged +1 and -1 turn in opposite directions about the vertical axis through the dais
  for (const o of movers) {
    const turn = SPIN[o.userData.grp] ?? SPIN[o.userData.em];
    if (!pivots[turn]) { pivots[turn] = new THREE.Group(); pivots[turn].position.set(info.chand.pivot[0], 0, -info.chand.pivot[1]); scene.add(pivots[turn]); pivots[turn].updateMatrixWorld(); }
    pivots[turn].attach(o); o.updateMatrix();
  }
  let liveCam = null;
  if (liveRT) {                                         // from below the orrery, where nearly every reflector sees it from
    liveCam = new THREE.CubeCamera(0.05, 80, liveRT); liveCam.position.copy(liveU.uLiveEye.value);
    for (const c of liveCam.children) c.layers.set(LIVE_LAYER);
    for (const o of movers) o.layers.enable(LIVE_LAYER);
    scene.add(liveCam);
  }

  // ---- outside: Earth at sunrise (NASA Blue Marble + Black Marble imagery) rendered in Cycles; effectively at infinity
  let backdrop, shaft; const sky = new THREE.Group(), AXIS = SPUN ? B(SPUN.axis).normalize() : PORTAL.clone().sub(CAM).normalize(); scene.add(sky);       // orientation only; infinity is evaluated separately for each rendering camera
  if (info.portal) {
    const D = 900, dir = AXIS.clone(), size = 2 * D * Math.tan(THREE.MathUtils.degToRad((info.backdrop_fov || 80) / 2));
    backdrop = new THREE.Mesh(new THREE.PlaneGeometry(size, size), bakedMat(skyTex, null, EARTH));
    // The main camera, mirror and drone cubemap have different origins. Centre infinity
    // on the active eye in the shader, like the sun and storm sprites; never leak parallax.
    backdrop.material.vertexShader = `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv;
      vec3 ray=(modelMatrix*vec4(position,1.)).xyz; vW=cameraPosition+ray;
      gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*ray,1.); }`;
    backdrop.position.copy(dir).multiplyScalar(D); backdrop.lookAt(0, 0, 0); backdrop.frustumCulled = false;
    // The sun, just above Earth's horizon: the focal point of the whole composition. Drawn at infinity for whichever
    // camera is rendering, so it also appears, stretched into a glare path, in the floor.
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      ...GLOW, uniforms: { uDir: { value: sunNow }, uSize: { value: 0.16 }, uGain: { value: num('sun', 1.0) }, uMirror },
      vertexShader: `uniform vec3 uDir; uniform float uSize; varying vec2 vP;
        void main(){ vP = position.xy; vec3 c = mat3(viewMatrix)*uDir*860.0;       // just in front of the backdrop plane
          gl_Position = projectionMatrix*vec4(c + vec3(position.xy*uSize*860.0, 0.0), 1.0); }`,
      fragmentShader: `uniform float uGain, uMirror; varying vec2 vP;
        void main(){ ${LIVE ? 'if (uMirror > 0.5) discard;   // the floor draws its own glare of the sun (room.js floorMat)' : ''}
          float r = length(vP), a = atan(vP.y, vP.x);
          // the photosphere is thousands of times brighter than anything indoors. Seen directly that only needs to be
          // "far above white"; seen in the floor its true strength is what survives the Fresnel loss and the blur.
          float disc = smoothstep(0.034, 0.024, r)*mix(70.0, 2600.0, uMirror);
          float halo = 2.2*exp(-r*20.0) + 0.3*exp(-r*5.0);                        // glare in the optics / window
          float spikes = pow(abs(cos(a*3.0 + 0.4)), 60.0)*exp(-r*7.0)*0.5;         // faint six-point diffraction star
          vec3 col = vec3(1.0, 0.86, 0.68)*(disc + halo + spikes)*(1.0 - smoothstep(0.85, 1.0, r));
          gl_FragColor = vec4(col*uGain, 1.0); }`,
    }));
    sun.frustumCulled = false; sun.renderOrder = 1; sky.add(backdrop); scene.add(sun);
    backdrop.updateMatrix();
    if (skyU) {                                         // rows: the plane's right, up and the direction it lies in
      const e = backdrop.matrix.elements, ax = (i) => V(e[i], e[i + 1], e[i + 2]).normalize(), along = backdrop.position.clone().normalize();
      skyU.frame = new THREE.Matrix3().set(...ax(0).toArray(), ...ax(4).toArray(), ...along.toArray());
    }
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
          vec4 mv = viewMatrix*vec4(cameraPosition + mat3(modelMatrix)*position, 1.0); gl_Position = projectionMatrix*mv;
          float cellId = floor(seed), slot = floor(uTime*1.7 + h(cellId)*9.0);            // each storm cell fires in bursts
          float burst = step(0.72, h(slot*0.37 + cellId));
          float f = fract(uTime*1.7 + h(cellId)*9.0);
          float flick = step(0.5, h(floor(uTime*24.0) + seed*13.0))*exp(-f*5.0);          // a few strokes, dying away
          vA = burst*flick*step(0.35, h(slot + seed*7.0));
          gl_PointSize = (0.012 + 0.02*h(seed*3.1))*uPx; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.62, 0.72, 1.0)*vA*1.6*smoothstep(0.5, 0.0, d), 1.0); }`,
    }), { seed });
    storms.renderOrder = 1; sky.add(storms);
  }
  // ---- sunbeam: the hall's air is faintly hazy, so the light entering through the portal is visible. Single
  // scattering integrated analytically per pixel: (length of the view ray inside the beam) x (phase function).
  // The camera stands inside the beam, so this mostly reads as glare gathering around the sun.
  if (info.portal_r && !SKIP.has('shaft')) {
    // Drawn on the inside of a box the size of the hall; the beam itself is found analytically along each view ray.
    const R = info.portal_r * 0.86, lo = V(-10.5, 0, PORTAL.z), hi = V(10.5, 12.8, -(info.y0 ?? -7));
    const g = new THREE.BoxGeometry(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z); g.translate((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2);
    shaft = new THREE.Mesh(g, new THREE.ShaderMaterial({
      ...GLOW, depthTest: false, side: THREE.BackSide, uniforms: { uC: { value: PORTAL }, uS: { value: sunNow }, uR: { value: R }, uK: { value: num('haze', 0.4) }, uLo: { value: lo }, uHi: { value: hi } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uC, uS, uLo, uHi; uniform float uR, uK; varying vec3 vW;
        void main(){
          vec3 o = cameraPosition, d = normalize(vW - o), uA = -uS;
          // project the ray along the light direction onto the portal plane: the beam is where that lands inside the opening
          vec3 A0 = o + uA*((uC.z - o.z)/uA.z) - uC, B = d - uA*(d.z/uA.z);
          float qa = dot(B.xy, B.xy), qb = dot(A0.xy, B.xy), qc = dot(A0.xy, A0.xy) - uR*uR, disc = qb*qb - qa*qc;
          if (disc <= 0.0 || qa < 1e-8) discard;
          float s = sqrt(disc), t0 = max((-qb - s)/qa, 0.0), t1 = (-qb + s)/qa;
          vec3 inv = 1.0/(d + vec3(1e-6)), ta = (uLo - o)*inv, tb = (uHi - o)*inv, mn = min(ta, tb), mx = max(ta, tb);     // only inside the hall
          t0 = max(t0, max(mn.x, max(mn.y, mn.z))); t1 = min(t1, min(mx.x, min(mx.y, mx.z)));
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
      ...GLOW, uniforms: { uTime, uPx, uSun: { value: sunNow }, uPortal: { value: PORTAL }, uPR: { value: (info.portal_r || 1) * 0.86 } },
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
    ? await createHologram({ scene, position: B(info.holo).add(V(0, 0.1, 0)), sunDir: SUN, text: text.hologram, base, ver: `?v=${info.v || 0}`, radius: 0.74, gain: num('holo', 2.0) }) : null;
  const drone = info.drone ? createDrone({ scene, dock: B(info.drone.dock), deliver: B(info.drone.deliver), slots: info.drone.slots.map(B), volumes }) : null;
  if (drone && probe && shadow && !SKIP.has('sunlight')) receiveWindowSun(drone.root,{uSunVP,uSunDir,uSunE,tShadow:{value:shadow.rt.depthTexture}},visibility);
  const routeMap = info.map && text.stations.length ? createRouteMap({ scene, center: B(info.map.c), stops: text.stations, radius: info.map.r, gain: num('map', 1.6) }) : null;
  // the signal room's terminal: a field over the plinth, and its drone (lit by the room and the window sun like the Library's)
  const comms = info.comms ? createComms({ scene, center: B(info.comms.c), facing: B(info.comms.facing).setY(0).normalize(), text: text.comms, window: PORTAL, out: AXIS }) : null;
  if (comms && probe && shadow && !SKIP.has('sunlight')) receiveWindowSun(comms.drone,{uSunVP,uSunDir,uSunE,tShadow:{value:shadow.rt.depthTexture}},visibility);

  // ---------------------------------------------------------------- interactables
  // Each has a pick mesh and a pose (where the camera stands, what it looks at); main.js glides the camera there.
  // the Library: asking for a volume marks it on the terminal's screen and sends the drone
  const call = (i) => {
    if (waiting && waiting.i !== i) { waiting.done(null); waiting = null; }      // asked for something else, or sent home: nobody is waiting to read the other one any more
    if (shelf) { shelf.selected = i ?? -1; shelf.rev++; }
    if (still && i != null) drone.bring(i); else drone.fetch(i);                 // reduced motion: no flight across the room
  };
  // Things that can be read (js/reader.js): a volume lying open, a placard, an exhibit, a stop on the route map. The pick
  // that shows one offers it while it has the visitor's attention; READ then scans it and stands its article over it.
  const reader = words ? createReader({ scene, camera, text: { ...words, mark: text.nav }, onLink, onShown, clearance }) : null;
  if (reader) hidden.push(reader.root);                              // light addressed to the visitor: not in the floor's mirror image
  const upright = (n) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(n, V(), V(0, 1, 0)));     // a plane's turn so that it faces along n
  const toCam = (p) => CAM.clone().sub(p).setY(0).normalize();
  /** Make a pick offer a source (a function, asked every frame: the source or null). */
  function offers(pick, source, backLabel) {             // backLabel: what the way back from the reading to this pick is called
    if (!reader) return pick;
    const own = pick.onFocus;
    return Object.assign(pick, { source, returnLabel: backLabel, enter: () => (reader.available() ? reading : null), enterLabel: words.read,
      onFocus: (on, next) => { own?.(on, next); if (on) reader.offer(source, pick); else if (!next?.reads) reader.offer(null); } });
  }
  /** Something read with nothing of its own in the room: a frame in the air a few steps in front of the room's camera.
   *  There is nothing to scan, so the display receives it (js/opening/receive.js), and no READ is offered under it. */
  function afloat(url) {
    const f = CAM.clone().sub(TGT).setY(0).normalize(), foot = CAM.clone().addScaledVector(f, -2.4).setY(1.0);
    return { url, how: 'receive', foot: () => foot, facing: f, span: 0.5, sheet: { parent: null, position: foot.clone().setY(1.2), quaternion: upright(f), size: [0.5, 0.32] } };
  }
  const bookSources = [];                                            // the Library: the volume lying open
  const bookSource = () => { const i = drone.open(); if (i < 0) return null;
    return (bookSources[i] ??= { url: volumes[i].url, foot: () => drone.book().getWorldPosition(V()), facing: B(info.terminal.pos).sub(B(info.drone.deliver)).setY(0).normalize(), span: drone.size[0],
      sheet: { parent: drone.book(), position: V(0, 0.046, 0), quaternion: new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), size: drone.size, top: true } }); };
  let terminal = null, reading = null, waiting = null;
  const picks = [], tanV = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), middle = CAM.clone().lerp(TGT, 0.5);
  const pickMesh = (geometry, parent, position) => { const m = new THREE.Mesh(geometry, pickMat); m.position.copy(position); parent.add(m); return m; };
  // What the visitor's display calls each pick (js/hud.js shows it when the pointer rests on one, and in the bar while it is in focus),
  // and what a click on it does. Something that can be read is READ; anything else is looked at.
  const named = (pick, name, verb) => Object.assign(pick, { name: String(name || '').toUpperCase(), verb });
  const looks = (src) => (src ? D.read : D.inspect);
  // a round thing's outline for the display: a square about its sphere, square to the view; or, for what lies flat (a table
  // and what is on it: content.json "flat"), the circle it lies in, with a hand's breadth above it
  const _x = V(), _y = V(), RING = Array.from({ length: 12 }, (_, i) => V(Math.cos(i * Math.PI / 6), 0, Math.sin(i * Math.PI / 6)));
  const ball = (mesh, r, flat) => () => { const c = mesh.getWorldPosition(V());
    if (flat) return [...RING.map((u) => c.clone().addScaledVector(u, r)), c.clone().setY(c.y + 0.25 * r)];
    _x.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(r); _y.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(r);
    return [c.clone().add(_x).add(_y), c.clone().add(_x).sub(_y), c.clone().sub(_x).add(_y), c.clone().sub(_x).sub(_y)]; };
  scene.updateMatrixWorld(true);
  // a flat display: stand square in front of it, filling the view
  for (const o of text.screens.inspect === false ? [] : screenMeshes) {
    const p = o.geometry.attributes.position, ix = o.geometry.index, v = [0, 1, 2, 3].map((i) => V().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
    const c = v.reduce((a, b) => a.add(b), V()).multiplyScalar(0.25), tri = [0, 1, 2].map((i) => v[ix ? ix.getX(i) : i]);
    const n = V().crossVectors(tri[1].clone().sub(tri[0]), tri[2].clone().sub(tri[0])).normalize();
    if (n.dot(middle.clone().sub(c).setY(0)) < 0) n.negate();                // the side that faces into the room
    const along = V().crossVectors(V(0, 1, 0), n).normalize(), span = (f) => Math.max(...v.map(f)) - Math.min(...v.map(f));
    const w = span((q) => q.dot(along)), h = span((q) => q.y);
    // the catalogue terminal: stand back far enough to watch the drone; each volume is a choice (main.js lists them)
    if (drone && o.userData.name === info.terminal.screen) picks.push(terminal = offers({ mesh: o, list: true, name: D.catalogue, verb: D.choose, cue: text.cue, pose: () => {
        // on an upright screen the view is wide and the book small: stand nearer to where the drone presents it
        const at = B(info.drone.deliver), k = THREE.MathUtils.clamp(camera.aspect / 1.1, 0.5, 1);
        return { pos: at.clone().lerp(B(info.terminal.pos), k), tgt: B(info.terminal.tgt).lerp(at.clone().setY(at.y - 0.3), 1 - k) };
      },
      options: volumes.map((v, i) => [v.title, () => call(i), `${v.date}  ·  ${v.minutes} min`]), current: () => shelf?.selected ?? -1,
      left: () => call(null), onFocus: (on, next) => on || next?.reads || call(null) }, bookSource, words?.backToCatalogue));
    else {
      // a placard: what it names can be read, standing at its foot
      const entry = text.screens.list[o.userData.screen], nh = n.clone().setY(0).normalize();
      const src = entry?.url && { url: entry.url, foot: () => c.clone().addScaledVector(nh, 0.3).setY(c.y - h / 2), facing: nh, span: 0.6, sheet: { parent: null, position: c.clone().addScaledVector(n, 0.012), quaternion: upright(n), size: [w, h] } };
      const pick = { mesh: o, pose: () => ({ pos: c.clone().addScaledVector(n, Math.max(h / 2 / tanV(), w / 2 / (tanV() * camera.aspect)) * 1.12), tgt: c }) };
      named(pick, entry?.name || entry?.title, looks(src));
      picks.push(src ? offers(pick, () => src) : pick);
    }
  }
  // Holograms open up instead: the camera only comes closer, along its own line of sight, while the display grows
  // and unfolds its detail layer.
  // station: { i, at } for a stop on the route map, which turns: it is looked at and read where it stands at the front (at:
  // where its group is then), wherever the map happens to be; its outline for the display follows it round.
  function addHolo(parent, local, r, dist, lift, target, url, name, station) {
    const mesh = pickMesh(new THREE.SphereGeometry(r, 12, 8), parent, local), at = station ? station.at.clone().add(local) : mesh.getWorldPosition(V()), f = toCam(at);
    // (a stop is not scanned: its own sheet opens up into the reading, js/opening/unfold.js)
    const src = url && { url, ...(station && target.page && { how: 'unfold', station: target }), foot: () => at.clone().addScaledVector(f, 0.6).setY(at.y - 0.25), facing: f, span: 0.6, sheet: { parent: null, position: at.clone().addScaledVector(f, 0.2), quaternion: upright(f), size: [1.2, 1.0] } };
    const pick = { mesh, station: station?.i, onFocus: target.setExpanded, name, verb: url ? D.read : D.open, bounds: ball(mesh, r), pose: () => {
      const c = station ? at.clone() : mesh.getWorldPosition(V()); c.y += lift;
      const d = CAM.clone().sub(c); d.y *= 0.35;
      const far = CAM.distanceTo(c) * 0.95;                // on an upright screen it stands further back, but never behind the room's own camera (that is outside the wall)
      return { pos: c.clone().addScaledVector(d.normalize(), Math.min(far, dist / Math.min(1, camera.aspect / 1.5))), tgt: c };
    } };
    picks.push(src ? offers(pick, () => src) : pick);
  }
  routeMap?.face(CAM);                                                // the map's front: toward the room's camera
  (routeMap?.stations || []).forEach((s, i) => { const st = text.stations[i]; addHolo(s.grp, V(0, 0.42, 0), 0.48, 2.9, 0.3, s, st?.url, [st?.title, st?.sub].filter(Boolean).join(' · ').toUpperCase(), { i, at: routeMap.home(i) }); });        // a stop on the line: what was done there
  if (hologram) addHolo(scene, hologram.root.position, 1.0, 5.6, 0.55, hologram, null, text.hologram.panel.title.toUpperCase());
  // exhibits and other round-ish things: frame a sphere of radius r from the direction scene.json gives
  (info.focus || []).forEach((f, i) => {
    // Where the bake says what stands there (scene.json "boxes": the books on the Lounge's table), the display works on
    // those things themselves: its lock goes round them, its scan crosses them (js/opening/scan.js), and the reading stands
    // over them. Their footprint, seen from where the reader stands, is the flat sheet the glyph hangs under.
    const bodies = (f.boxes || []).map((b) => ({ position: B(b.c), quaternion: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), b.turn || 0), size: [b.size[0], b.size[2], b.size[1]], reads: !!b.reads }));
    const corners = bodies.flatMap((b) => [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => V(x * b.size[0], y * b.size[1], z * b.size[2]).multiplyScalar(0.5).applyQuaternion(b.quaternion).add(b.position)))));
    // what is pressed: the box that holds those things (so a click lands where the lock is), or a ball round the exhibit
    const hull = corners.length ? new THREE.Box3().setFromPoints(corners).expandByScalar(0.03) : null;
    const mesh = pickMesh(hull ? new THREE.BoxGeometry(...hull.getSize(V()).toArray()).translate(...hull.getCenter(V()).sub(B(f.c)).toArray()) : new THREE.SphereGeometry(f.r * 0.8, 12, 8), scene, B(f.c));
    const d = B(f.dir).normalize(), dh = d.clone().setY(0).normalize(), c = mesh.position;
    const what = text.exhibits?.[i], lift = THREE.MathUtils.clamp(c.y - f.r * 0.45, 0.75, 1.25);                  // content.json "exhibits": what each stands for
    const among = () => {
      const side = V().crossVectors(V(0, 1, 0), dh).normalize(), ext = (fn) => corners.reduce(([lo, hi], p) => [Math.min(lo, fn(p)), Math.max(hi, fn(p))], [Infinity, -Infinity]);
      const [a0, a1] = ext((p) => p.dot(side)), [b0, b1] = ext((p) => p.dot(dh)), [y0, y1] = ext((p) => p.y), mid = side.clone().multiplyScalar((a0 + a1) / 2).addScaledVector(dh, (b0 + b1) / 2).setY((y0 + y1) / 2);
      return { url: what.url, bodies, foot: () => mid, facing: dh, span: THREE.MathUtils.clamp((a1 - a0) * 1.25, 0.6, 1.2),      // (span: the things, side by side, fit the strip under the frame)
        sheet: { parent: null, position: mid.clone().setY(y0), quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, dh.clone().negate(), V(0, 1, 0))), size: [a1 - a0, b1 - b0] } };
    };
    const src = what?.url && (bodies.length ? among() : { url: what.url, foot: () => c.clone().addScaledVector(dh, f.r * 0.75).setY(lift), facing: dh, span: 0.6,
      sheet: { parent: null, position: c.clone().addScaledVector(dh, f.r * 0.5), quaternion: upright(dh), size: [f.r * 1.3, f.r * 1.3] } });
    const pick = { mesh, cta: !!what?.cta, bounds: bodies.length ? () => corners : ball(mesh, f.r * 0.8, what?.flat), pose: () => ({ pos: c.clone().addScaledVector(d, f.r / Math.min(tanV(), tanV() * camera.aspect) * 1.25), tgt: c }) };
    named(pick, what?.name || D.exhibit, looks(src));                                                     // its name: the project's (js/site.js), or content.json's
    picks.push(src ? offers(pick, () => src) : pick);
  });
  // the contact field: stand square in front of it and hold still, it is read (steady). What can be pressed on it takes its own
  // clicks; a click on its surface goes to the field (main.js). It is written on only if the site has somewhere to send that.
  if (comms) picks.push({ cta: true, steady: true, mesh: comms.hit, name: text.comms.title.toUpperCase(), verb: comms.mode === 'links' ? D.open : D.write, onFocus: (on) => comms.setExpanded(on, camera),
    click: comms.click, cursor: comms.cursor, typing: comms.typing, pose: () => {
    const c = comms.hit.getWorldPosition(V()), n = V(0, 0, 1).transformDirection(comms.hit.matrixWorld), { size: [w, h], beside } = comms.frame();
    const d = Math.max(h / 2 / tanV(), (w / 2 + (beside ? 0.35 : 0)) / (tanV() * camera.aspect)) * (beside ? 1.32 : 1.06);   // landscape: field and drone; upright: the field fills the width
    return { pos: c.clone().addScaledVector(n, d), tgt: beside ? c.clone().add(V(0.12, -0.04, 0)) : c };
  } });
  // reading: its pick is the READ glyph, there only while something is offered. Aside from the tour; BACK leads to what offered it.
  if (reader) picks.push(reading = { mesh: reader.hit, reads: true, aside: true, name: '', verb: '', steady: true, live: reader.available, pose: reader.pose, typing: () => reader.state() !== 'closed', calm: reader.settled,
    back: reader.offeredBy, get backLabel() { return reader.offeredBy()?.returnLabel; }, url: reader.url, title: reader.title,
    onFocus: (on, next) => { if (on) return reader.read(); const by = reader.offeredBy(); reader.close(); if (!by || next !== by) { reader.offer(null); by?.left?.(); } } });      // (offered by nothing in the room: there is nothing to go back to, and no READ is left behind)
  // doors: walk up to it; main.js then goes through to door.to (another room's id; '' = sealed)
  for (const door of info.doors || []) {
    const c = B(door.c), n = B(door.n).normalize(), mesh = pickMesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), scene, c);
    const along = V(-n.z, 0, n.x).normalize().multiplyScalar(1.2), top = c.clone().setY(c.y + 1.7), foot = c.clone().setY(Math.max(0, c.y - 1.7));     // for the display: the doorway in its wall, from the floor up
    const verb = door.stops ? D.stops.replace('{n}', door.stops.length) : door.to ? D.enter : D.sealed;
    picks.push({ mesh, door, name: door.label.toUpperCase(), verb, bounds: () => [top.clone().add(along), top.clone().sub(along), foot.clone().add(along), foot.clone().sub(along)], pose: () => ({ pos: c.clone().addScaledVector(n, 4.2 / Math.min(1, camera.aspect / 1.2)).setY(c.y + 0.5), tgt: c.clone().setY(c.y + 0.25) }) });
  }

  let frames = 0;
  const PERIOD = Q.has('roll') ? ROLL : (SPUN?.period || 0), rollAt = (t) => (Number.isNaN(ROLL_AT) ? (PERIOD && !still ? t * 2 * Math.PI / PERIOD : 0) : ROLL_AT * Math.PI / 180);
  await Promise.all(pending);
  if (textureError) throw textureError;                             // do not lift the cover on a partial bake
  if (drone && probe) drone.setEnv((drone.lit=probeEnvironment(renderer,probeU,probe)).texture);
  const commsLit = comms && probe ? probeEnvironment(renderer, probeU, probe) : null; if (commsLit) comms.setEnv(commsLit.texture);
  let last = 0;
  return {
    id, info, scene, picks, floors, hidden, CAM, TGT, chart, reader, terminal, volumes,
    /** The route map's turn (js/routemap.js), in the room that has one; null elsewhere. */
    turn: routeMap?.turn ?? null,
    /** Can the article at this URL be read here? (In the Library only a volume on the shelves.) */
    reads: (url) => !!reader && !!url && (!drone || volumes.some((v) => v.url === url.split('#')[0])),
    heldVolume: () => drone?.open() ?? -1,
    /** Have the article at a URL opened for reading: resolves with the pick to focus when it can be read (null: it cannot be, here).
     *  In the Library the volume must first lie open: the drone fetches it (fly), or it is simply there (a page that opens on an article). */
    read(url, fly) {
      if (!reader) return Promise.resolve(null);
      const path = url.split('#')[0];
      if (drone) {
        const i = volumes.findIndex((v) => v.url === path); if (i < 0) return Promise.resolve(null);
        waiting?.done(null); waiting = null; reader.offer(bookSource, terminal);
        if (url.includes('#')) reader.scrollTo(url.split('#')[1]);      // an address that names a place in the volume: it opens there
        if (drone.open() !== i) { if (fly) call(i); else { if (shelf) { shelf.selected = i; shelf.rev++; } drone.bring(i); } }
        return new Promise((done) => { waiting = { i, done }; });
      }
      const by = picks.find((p) => p.source?.()?.url.split('#')[0] === path && (p.source().url === url || !url.includes('#'))) ?? picks.find((p) => p.source?.()?.url.split('#')[0] === path) ?? null;
      const src = by && by.source().url === url ? by.source() : { ...(by?.source() ?? afloat(url)), url };
      const stop = by?.station ?? picks.find((p) => p.station != null && p.source?.()?.url === url)?.station;
      if (stop != null) routeMap.turn.to(stop, !fly);                   // a stop on the route map is read at the front: the map turns to it (a page opened on it: it is there)
      reader.offer(() => src, by); return Promise.resolve(reading);
    },
    CLOSE: B(info.close || [0, 17.2, 2.15]), CLOSE_TGT: B(info.close_tgt || [0, 26, 2.6]), arc: info.holo ? 0.9 : 0.25,     // arc: how high the pull-back lifts over the middle
    exposure: num('exp', info.exposure || 0.85),
    /** Per frame, before anything else is drawn: the sun's shadow map, looking in through the window. */
    prepass: shadow && ((renderer) => {
      const c = shadow.cam, h = shadowHalf;
      c.left = c.bottom = -h; c.right = c.top = h; c.updateProjectionMatrix();
      c.position.copy(PORTAL).addScaledVector(sunNow, 60); c.up.set(1, 0, 0); c.lookAt(PORTAL); c.updateMatrixWorld();
      uSunVP.value.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
      c.layers.set(1); scene.overrideMaterial = shadow.mat;
      renderer.autoClearColor = false; renderer.setRenderTarget(shadow.rt); renderer.render(scene, c); renderer.autoClearColor = true;
      scene.overrideMaterial = null;
    }),
    /** Per frame, after the camera has been placed. */
    update(t) {
      const roll = rollAt(t);
      sky.quaternion.setFromAxisAngle(AXIS, roll); sunNow.copy(SUN).applyQuaternion(sky.quaternion);
      if (skyU?.frame) skyU.uSkyM.value.copy(skyU.frame).multiply(_m3.setFromMatrix4(_m4.makeRotationFromQuaternion(_q.copy(sky.quaternion).invert())));
      if (NSKY) { const x = ((roll / (2 * Math.PI)) % 1 + 1) % 1 * NSKY, i = Math.floor(x) % NSKY; uSky.value.set(i, (i + 1) % NSKY, x - Math.floor(x)); }
      // orrery: turn the rings and blend the three baked light phases for the current angle
      const phi = CH_FIXED ?? t * CH_SPEED;
      for (const turn in pivots) pivots[turn].rotation.y = phi * turn;
      if (PHASES.length === 3) uChand.value.set(...PHASES.map((p) => (1 + 2 * Math.cos(phi - p)) / 3));
      hologram?.update(t); routeMap?.update(t); drone?.update(t); reader?.update(t);
      if (waiting && drone.open() === waiting.i && reader.available()) { waiting.done(reading); waiting = null; }
      comms?.update(t, Math.min(0.1, t - last)); last = t; screens.update();
      // Backward compatibility for bake masters that predate the sun-free room probe.
      if (drone && !drone.lit && ++frames > 3) {
        const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType }), eye = new THREE.CubeCamera(0.05, 100, cube), pmrem = new THREE.PMREMGenerator(renderer);
        eye.position.copy(B(info.drone.deliver)); drone.root.visible = false; eye.update(renderer, scene); drone.root.visible = true;
        drone.setEnv((drone.lit = pmrem.fromCubemap(cube.texture)).texture); cube.dispose(); pmrem.dispose();
      }
    },
    /** Per frame, before the mirror and the view: what turns, as the reflections will see it. */
    capture: liveRT && ((renderer) => {
      const bg = scene.background, clear = renderer.getClearAlpha(), u = liveU.tLive;
      scene.background = null; renderer.setClearAlpha(0); u.value = liveBlank.texture;      // no sampling of the target being drawn
      liveCam.update(renderer, scene);
      scene.background = bg; renderer.setClearAlpha(clear); u.value = liveRT.texture;
    }),
    dispose: () => { reader?.dispose(); waiting?.done(null); drone?.lit?.dispose?.(); commsLit?.dispose(); comms?.dispose(); chart?.dispose(); liveRT?.dispose(); liveBlank?.dispose(); dispose(scene); screens.dispose(); shadow?.rt.dispose(); shadow?.mat.dispose(); },
  };
}
