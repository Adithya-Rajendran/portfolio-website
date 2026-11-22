// One local, path-traced radiance probe per room. Only polished batches use it; their Cycles
// lightmaps omit first-hit glossy (no double highlight). The floor has its own live planar pass.
// Position, roughness and linear F0 come from the actual material/geometry, not the object name.
import * as THREE from 'three';
import {uPx} from './kit.js';

export const probePars = `
  uniform highp sampler2DArray tRoomSpec;
  uniform vec3 uProbePos, uBoxLo, uBoxHi;
  uniform float uProbeRange, uSpecGain;
  varying vec4 vFinish;
  // Split-sum GGX environment BRDF (Lazarov's fit). Rough metal does not acquire
  // a white mirror rim simply because the eye is grazing its surface.
  vec3 envWeight(float r, float nv) {
    vec4 p = r*vec4(-1.,-.0275,-.572,.022) + vec4(1.,.0425,1.04,-.04);
    float a004 = min(p.x*p.x, exp2(-9.28*nv))*p.x + p.y;
    vec2 ab = vec2(-1.04,1.04)*a004 + p.zw;
    return max(vFinish.rgb*ab.x + ab.y, vec3(0.))*uSpecGain;
  }
  vec3 roomSpec(vec3 W, vec3 N, vec3 V) {
    vec3 ray = reflect(-V, N);
    // Intersect the reflected ray with this compartment's bounds first. The ceiling light
    // then slides over a brass rail as you pass it instead of sticking to the camera.
    vec3 at = clamp(W, uBoxLo + 0.002, uBoxHi - 0.002);
    vec3 reach = mix(at - uBoxLo, uBoxHi - at, step(vec3(0.), ray)) / max(abs(ray), vec3(1.e-5));
    vec3 lookup = normalize(at + ray*min(reach.x, min(reach.y, reach.z)) - uProbePos);
    vec2 uv = vec2(fract(.5 + atan(lookup.x, -lookup.z)*0.15915494309), acos(clamp(lookup.y,-1.,1.))*0.31830988618);
    float r = clamp(vFinish.a, .045, 1.), k = r*4., i = floor(k);
    vec3 a = textureLod(tRoomSpec, vec3(uv, i), 0.).rgb, b = textureLod(tRoomSpec, vec3(uv,min(i+1.,4.)), 0.).rgb;
    vec3 env = mix(a*a, b*b, k-i)*uProbeRange;
    return env*envWeight(r,clamp(dot(N,V),0.,1.));
  }
  vec3 sunSpec(vec3 N, vec3 V, vec3 L) {
    float nl = max(dot(N,L),0.), nv = max(dot(N,V),.001);
    vec3 H = normalize(L+V); float nh = max(dot(N,H),0.);
    float a2 = pow(max(vFinish.a,.085),4.);
    float d = nh*nh*(a2-1.)+1.;
    float vis = .5/max(.0001, nl*sqrt(nv*nv*(1.-a2)+a2) + nv*sqrt(nl*nl*(1.-a2)+a2));
    vec3 f = vFinish.rgb + (1.-vFinish.rgb)*pow(1.-clamp(dot(V,H),0.,1.),5.);
    return f*(a2*vis/max(1.e-9,d*d))*uSpecGain;  // multiplied by shadowed NoL * irradiance / pi by the caller
  }`;

// ---------------------------------------------------------------- live reflections on every baked surface
// The bake holds only the light leaving each surface diffusely (blender/bake.py). Everything that depends on the
// eye is evaluated here, per pixel, for the camera that is drawing (the mirror cameras included):
//   room   the Cycles probes nearest the pixel, the reflected ray box-projected onto the room shell, by roughness
//   sky    where a probe saw out of the room, the rolling sky along the reflected ray (it is at infinity)
//   live   things that move (the orrery): a small cube rendered each frame, met on a sphere around them
//   lamps  analytic GGX highlights of each point/spot lamp (sphere lights), times the baked lamp visibility
//   sun    shadowed GGX highlight of the window sun (room.js)
// A clear coat is a second, sharper lobe on top. Specular occlusion comes from the baked ambient occlusion.
export function liveSpecPars({ probes, sky, live, lights }) {
  const P = Math.max(1, probes), NL = lights;
  return `
  #define PROBES ${P}
  uniform highp sampler2DArray tRoomSpec; uniform vec3 uProbePos[PROBES], uBoxLo, uBoxHi; uniform float uProbeRange, uSpecGain;
  ${sky ? 'uniform sampler2D tSky; uniform mat3 uSkyM; uniform float uSkyHalf, uSkyGain, uSkyLod;' : ''}
  ${live ? 'uniform samplerCube tLive; uniform vec3 uLiveEye, uLiveC; uniform float uLiveR, uLiveLod;' : ''}
  ${NL ? `uniform vec3 uLP[${NL}], uLI[${NL}], uLD[${NL}], uLS[${NL}];` : ''}
  // Split-sum GGX environment BRDF (Karis' fit of the DFG integral): reflectance = F0*x + y.
  vec2 envAB(float r, float nv) {
    vec4 p = r*vec4(-1.,-.0275,-.572,.022) + vec4(1.,.0425,1.04,-.04);
    float a004 = min(p.x*p.x, exp2(-9.28*nv))*p.x + p.y;
    return vec2(-1.04,1.04)*a004 + p.zw;
  }
  // Lagarde & de Rousiers: how much of a lobe of this roughness escapes a surface with this ambient occlusion.
  float specOcc(float ao, float nv, float r) { return clamp(pow(nv + ao, exp2(-16.*r - 1.)) - 1. + ao, 0., 1.); }
  vec2 panoUV(vec3 d) { return vec2(fract(.5 + atan(d.x, -d.z)*0.15915494309), acos(clamp(d.y,-1.,1.))*0.31830988618); }
  // One array layer per probe, its mip chain holding the roughness levels (tools/pack.py): one trilinear fetch.
  vec4 probeAt(int i, vec3 hit, float level) {
    vec4 a = textureLod(tRoomSpec, vec3(panoUV(normalize(hit - uProbePos[i])), float(i)), level); a.rgb *= a.rgb; return a;
  }
  ${sky ? `vec3 skyAlong(vec3 R, float rough) {        // the backdrop plane, turned with the station's roll
    vec3 d = uSkyM*R; if (d.z <= .02) return vec3(0.);
    vec2 uv = d.xy/(d.z*uSkyHalf)*.5 + .5;
    if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return vec3(0.);
    vec3 t = textureLod(tSky, uv, uSkyLod + log2(max(rough*rough*2048., 1.))).rgb; return t*t*${(8).toFixed(1)}*uSkyGain; }` : ''}
  ${live ? `vec4 liveAlong(vec3 W, vec3 R, float rough) {   // premultiplied: what moves, in front of the room
    // The cube is seen from below the orrery, as nearly every reflector sees it. A surface above its centre would see
    // the unlit tops of the rings instead, so it gets no overlay (the probe omits the orrery: nothing is frozen).
    float below = smoothstep(uLiveC.y + .5, uLiveC.y - 1.5, W.y); if (below <= 0.) return vec4(0.);
    vec3 oc = W - uLiveC; float b = dot(oc, R), h = b*b - dot(oc, oc) + uLiveR*uLiveR;
    if (h <= 0.) return vec4(0.);
    h = sqrt(h); float t0 = -b - h, t1 = -b + h; if (t1 <= 0.) return vec4(0.);
    float lod = uLiveLod + rough*5.;
    vec4 far = textureLod(tLive, W + R*t1 - uLiveEye, lod);
    if (t0 <= 0.) return far*below;
    vec4 near = textureLod(tLive, W + R*t0 - uLiveEye, lod);
    return (near + far*(1. - near.a))*below; }` : ''}
  // Where the reflected ray meets the room shell, and the two probes nearest the surface (shared by both lobes).
  // Weights fall off with distance; at the swap of the 2nd and 3rd nearest both are equal, so nothing jumps.
  struct Env { vec3 hit; int i0, i1; float w1; };
  Env envSetup(vec3 W, vec3 R) {
    Env e; vec3 at = clamp(W, uBoxLo + .002, uBoxHi - .002);
    vec3 reach = mix(at - uBoxLo, uBoxHi - at, step(vec3(0.), R))/max(abs(R), vec3(1e-5));
    e.hit = at + R*min(reach.x, min(reach.y, reach.z));
    float d0 = 1e9, d1 = 1e9; e.i0 = 0; e.i1 = 0;
    for (int i = 0; i < PROBES; i++) { vec3 d = W - uProbePos[i]; float q = dot(d, d);
      if (q < d0) { d1 = d0; e.i1 = e.i0; d0 = q; e.i0 = i; } else if (q < d1) { d1 = q; e.i1 = i; } }
    float a = 1./((1. + d0)*(1. + d0)), b = PROBES > 1 ? 1./((1. + d1)*(1. + d1)) : 0.;
    e.w1 = uMirror > .5 ? 0. : b/(a + b);              // the mirror image is small and blurred: the nearest probe
    return e;
  }
  // Radiance arriving along R at W, for a lobe of this roughness.
  vec3 envLobe(Env e, vec3 W, vec3 R, float rough) {
    float level = clamp(rough, 0., 1.)*4.;
    vec4 env = probeAt(e.i0, e.hit, level);
    if (e.w1 > .002) env = mix(env, probeAt(e.i1, e.hit, level), e.w1);
    vec3 c = env.rgb*uProbeRange;
    ${sky ? 'c += (1. - env.a)*skyAlong(R, rough);' : ''}
    ${live ? 'vec4 m = liveAlong(W, R, rough); c = c*(1. - m.a) + m.rgb;' : ''}
    return c;
  }
  vec3 envAlong(vec3 W, vec3 R, float rough) { return envLobe(envSetup(W, R), W, R, rough); }
  // GGX for one light direction: D*Vis*F*NoL. 'a' is alpha (roughness squared), possibly widened for an area.
  vec3 ggx(vec3 N, vec3 V, vec3 L, vec3 F0, float a) {
    float nl = max(dot(N, L), 0.), nv = max(dot(N, V), 1e-3); vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.);
    float a2 = a*a, d = nh*nh*(a2 - 1.) + 1.;
    float vis = .5/max(1e-4, nl*sqrt(nv*nv*(1. - a2) + a2) + nv*sqrt(nl*nl*(1. - a2) + a2));
    vec3 F = F0 + (1. - F0)*pow(1. - clamp(dot(V, H), 0., 1.), 5.);
    return F*(a2*vis/max(1e-9, 3.14159265*d*d))*nl;
  }
  ${NL ? `// Each lamp is a sphere of uLS.x metres (Karis' representative point and normalisation); uLS.y/z: spot cone
  // cosine and its soft edge (y < -1.5: a point lamp). Intensity in W/sr, as Cycles uses it.
  vec3 lampLobe(vec3 W, vec3 N, vec3 V, vec3 F0, float rough) {
    vec3 sum = vec3(0.), R = reflect(-V, N); float a = max(rough*rough, .002);
    for (int i = 0; i < ${NL}; i++) {
      vec3 Lv = uLP[i] - W; float d2 = dot(Lv, Lv), d = sqrt(d2); vec3 L0 = Lv/d;
      float cone = 1.;
      if (uLS[i].y > -1.5) { float c = dot(-L0, uLD[i]) - uLS[i].y; cone = c <= 0. ? 0. : uLS[i].z > 0. ? smoothstep(0., uLS[i].z, c) : 1.; }
      if (cone <= 0. || dot(N, L0) <= 0.) continue;
      vec3 toRay = dot(Lv, R)*R - Lv; vec3 L = normalize(Lv + toRay*clamp(uLS[i].x/max(length(toRay), 1e-4), 0., 1.));
      float aw = clamp(a + uLS[i].x/(2.*d), 0., 1.);
      sum += ggx(N, V, L, F0, aw)*(a*a/(aw*aw))*uLI[i]*(cone/d2);
    }
    return sum; }` : ''}
`;
}

// Feed the sun-free Cycles radiance to Three's standard PBR materials (the Library drone
// and its book). A single decode and PMREM while the room is covered, not six room draws
// using a floor reflection captured from the wrong eye. Three measures longitude from +X.
export function probeEnvironment(renderer, u, probe) {
  const raw = new THREE.WebGLRenderTarget(probe.width,probe.height,{type:THREE.HalfFloatType,depthBuffer:false});
  raw.texture.mapping=THREE.EquirectangularReflectionMapping; raw.texture.wrapS=THREE.RepeatWrapping;
  const sc=new THREE.Scene(), mat=new THREE.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 p; void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform highp sampler2DArray tRoomSpec; uniform float uProbeRange; varying vec2 p;
      void main(){vec3 a=textureLod(tRoomSpec,vec3(fract(p.x+.25),1.-p.y,0.),0.).rgb;gl_FragColor=vec4(a*a*uProbeRange,1.);}`});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat); plane.frustumCulled=false; sc.add(plane);
  const prev=renderer.getRenderTarget(), pm=new THREE.PMREMGenerator(renderer);
  try { renderer.setRenderTarget(raw); renderer.render(sc,new THREE.Camera()); renderer.setRenderTarget(prev);
    return pm.fromEquirectangular(raw.texture);
  } finally { renderer.setRenderTarget(prev); pm.dispose(); plane.geometry.dispose(); mat.dispose(); raw.dispose(); }
}

// Reflect an eye across a horizontal plane. A point on that plane projects to its own
// image; world points above it reflect at exactly the same depth as their virtual image below it.
const direction = new THREE.Vector3(), up = new THREE.Vector3();
export function reflectEye(eye, reflected, height, vp) {
  eye.updateMatrixWorld(); eye.getWorldDirection(direction).add(eye.position);
  up.set(0,1,0).applyQuaternion(eye.quaternion); up.y *= -1;
  reflected.up.copy(up); reflected.position.copy(eye.position); reflected.position.y = 2*height-eye.position.y;
  reflected.lookAt(direction.x, 2*height-direction.y, direction.z);
  reflected.projectionMatrix.copy(eye.projectionMatrix); reflected.projectionMatrixInverse.copy(eye.projectionMatrixInverse);
  reflected.updateMatrixWorld(); vp.multiplyMatrices(reflected.projectionMatrix,reflected.matrixWorldInverse);
}

// The route is made of light: it is not in the offline probe. Render JUST its emitters, not
// a second copy of the entire Navigation room, into the reflection of the chart's glass.
// No screenspace tracing: an off-screen station can still reflect. Labels/cards are UI.
export const chartPars = `uniform sampler2D tChart; uniform mat4 uChartVP; uniform vec4 uChart;
  vec3 chartLight(vec3 W,vec3 N,vec3 V){
    if(uMirror>.5 || N.y<.97 || V.y<=0. || abs(W.y-uChart.y)>.004 || distance(W.xz,uChart.xz)>uChart.w) return vec3(0.);
    vec4 q=uChartVP*vec4(W,1.); vec2 uv=q.xy/q.w*.5+.5;
    float r=vFinish.a, lod=log2(1.+r*r*float(textureSize(tChart,0).y)*.18);
    return textureLod(tChart,uv,lod).rgb*envWeight(r,clamp(dot(N,V),0.,1.));
  }`;
// The same for a LIVE room: weighted by this lobe's split-sum reflectance E.
export const chartParsLive = `uniform sampler2D tChart; uniform mat4 uChartVP; uniform vec4 uChart;
  vec3 chartLive(vec3 W,vec3 N,vec3 V,vec3 E,float r){
    if(uMirror>.5 || N.y<.97 || V.y<=0. || abs(W.y-uChart.y)>.004 || distance(W.xz,uChart.xz)>uChart.w) return vec3(0.);
    vec4 q=uChartVP*vec4(W,1.); vec2 uv=q.xy/q.w*.5+.5;
    return textureLod(tChart,uv,log2(1.+r*r*float(textureSize(tChart,0).y)*.18)).rgb*E;
  }`;
export function chartReflection(center, radius, mirror) {
  const rt = new THREE.WebGLRenderTarget(4,4,{type:mirror.rt.texture.type,depthBuffer:false,
    generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const cam = new THREE.PerspectiveCamera(), vp = new THREE.Matrix4(), black = new THREE.Color(0);
  const h = center.y+.004; cam.layers.set(2);
  return { uniforms:{tChart:{value:rt.texture},uChartVP:{value:vp},uChart:{value:new THREE.Vector4(center.x,h,center.z,radius-.25)}},
    draw(renderer,scene,eye){
      const k=Math.min(.62,640/mirror.size.x,440/mirror.size.y), w=Math.max(4,Math.round(mirror.size.x*k)), hpx=Math.max(4,Math.round(mirror.size.y*k));
      rt.setSize(w,hpx); reflectEye(eye,cam,h,vp);
      const bg=scene.background,px=uPx.value; scene.background=black; uPx.value=mirror.pxPerRad.value*hpx/mirror.size.y;
      renderer.setRenderTarget(rt); renderer.render(scene,cam); scene.background=bg; uPx.value=px;
    }, dispose(){rt.dispose();} };
}
