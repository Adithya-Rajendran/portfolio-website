// The radiance probe of each room, the live specular lighting and the chart reflection.
import * as THREE from 'three';
import {uPx} from './kit.js';

export const probePars = `
  uniform highp sampler2DArray tRoomSpec;
  uniform vec3 uProbePos, uBoxLo, uBoxHi;
  uniform float uProbeRange, uSpecGain;
  varying vec4 vFinish;
  vec3 envWeight(float r, float nv) {
    vec4 p = r*vec4(-1.,-.0275,-.572,.022) + vec4(1.,.0425,1.04,-.04);
    float a004 = min(p.x*p.x, exp2(-9.28*nv))*p.x + p.y;
    vec2 ab = vec2(-1.04,1.04)*a004 + p.zw;
    return max(vFinish.rgb*ab.x + ab.y, vec3(0.))*uSpecGain;
  }
  vec3 roomSpec(vec3 W, vec3 N, vec3 V) {
    vec3 ray = reflect(-V, N);
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
    return f*(a2*vis/max(1.e-9,d*d))*uSpecGain;
  }`;

export function liveSpecPars({ probes, sky, live, lights, grid = 0 }) {
  const P = Math.max(1, probes), NL = lights;
  return `
  #define PROBES ${P}
  uniform highp sampler2DArray tRoomSpec; uniform vec3 uProbePos[PROBES], uBoxLo, uBoxHi; uniform float uProbeRange, uSpecGain;
  ${sky ? 'uniform sampler2D tSky; uniform mat3 uSkyM; uniform float uSkyHalf, uSkyGain, uSkyLod;' : ''}
  ${live ? 'uniform samplerCube tLive; uniform vec3 uLiveEye, uLiveC; uniform float uLiveR, uLiveLod;' : ''}
  ${NL ? `uniform vec3 uLP[${NL}], uLI[${NL}], uLD[${NL}], uLS[${NL}];` : ''}
  ${NL && grid ? `uniform highp sampler3D tLampGrid0; ${grid > 4 ? 'uniform highp sampler3D tLampGrid1;' : ''} uniform vec3 uGridLo, uGridInv;` : ''}
  vec2 envAB(float r, float nv) {
    vec4 p = r*vec4(-1.,-.0275,-.572,.022) + vec4(1.,.0425,1.04,-.04);
    float a004 = min(p.x*p.x, exp2(-9.28*nv))*p.x + p.y;
    return vec2(-1.04,1.04)*a004 + p.zw;
  }
  float specOcc(float ao, float nv, float r) { return clamp(pow(nv + ao, exp2(-16.*r - 1.)) - 1. + ao, 0., 1.); }
  vec2 panoUV(vec3 d) { return vec2(fract(.5 + atan(d.x, -d.z)*0.15915494309), acos(clamp(d.y,-1.,1.))*0.31830988618); }
  vec4 probeAt(int i, vec3 hit, float level) {
    vec4 a = textureLod(tRoomSpec, vec3(panoUV(normalize(hit - uProbePos[i])), float(i)), level); a.rgb *= a.rgb; return a;
  }
  ${sky ? `vec3 skyAlong(vec3 R, float rough) {
    vec3 d = uSkyM*R; if (d.z <= .02) return vec3(0.);
    vec2 uv = d.xy/(d.z*uSkyHalf)*.5 + .5;
    if (any(lessThan(uv, vec2(0.))) || any(greaterThan(uv, vec2(1.)))) return vec3(0.);
    vec3 t = textureLod(tSky, uv, uSkyLod + log2(max(rough*rough*2048., 1.))).rgb; return t*t*${(8).toFixed(1)}*uSkyGain; }` : ''}
  ${live ? `vec4 liveAlong(vec3 W, vec3 R, float rough) {
    float below = smoothstep(uLiveC.y + .5, uLiveC.y - 1.5, W.y); if (below <= 0.) return vec4(0.);
    vec3 oc = W - uLiveC; float b = dot(oc, R), h = b*b - dot(oc, oc) + uLiveR*uLiveR;
    if (h <= 0.) return vec4(0.);
    h = sqrt(h); float t0 = -b - h, t1 = -b + h; if (t1 <= 0.) return vec4(0.);
    float lod = uLiveLod + rough*5.;
    vec4 far = textureLod(tLive, W + R*t1 - uLiveEye, lod);
    if (t0 <= 0.) return far*below;
    vec4 near = textureLod(tLive, W + R*t0 - uLiveEye, lod);
    return (near + far*(1. - near.a))*below; }` : ''}
  struct Env { vec3 hit; int i0, i1; float w1; };
  Env envSetup(vec3 W, vec3 R) {
    Env e; vec3 at = clamp(W, uBoxLo + .002, uBoxHi - .002);
    vec3 reach = mix(at - uBoxLo, uBoxHi - at, step(vec3(0.), R))/max(abs(R), vec3(1e-5));
    e.hit = at + R*min(reach.x, min(reach.y, reach.z));
    float d0 = 1e9, d1 = 1e9; e.i0 = 0; e.i1 = 0;
    for (int i = 0; i < PROBES; i++) { vec3 d = W - uProbePos[i]; float q = dot(d, d);
      if (q < d0) { d1 = d0; e.i1 = e.i0; d0 = q; e.i0 = i; } else if (q < d1) { d1 = q; e.i1 = i; } }
    float a = 1./((1. + d0)*(1. + d0)), b = PROBES > 1 ? 1./((1. + d1)*(1. + d1)) : 0.;
    e.w1 = uMirror > .5 ? 0. : b/(a + b);
    return e;
  }
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
  vec3 ggx(vec3 N, vec3 V, vec3 L, vec3 F0, float a) {
    float nl = max(dot(N, L), 0.), nv = max(dot(N, V), 1e-3); vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.);
    float a2 = a*a, d = nh*nh*(a2 - 1.) + 1.;
    float vis = .5/max(1e-4, nl*sqrt(nv*nv*(1. - a2) + a2) + nv*sqrt(nl*nl*(1. - a2) + a2));
    vec3 F = F0 + (1. - F0)*pow(1. - clamp(dot(V, H), 0., 1.), 5.);
    return F*(a2*vis/max(1e-9, 3.14159265*d*d))*nl;
  }
  ${NL ? `
  vec3 lampLobe(vec3 W, vec3 N, vec3 V, vec3 F0, float rough) {
    vec3 sum = vec3(0.), R = reflect(-V, N); float a = max(rough*rough, .002);
    ${grid ? `
    vec3 gq = (W - uGridLo)*uGridInv; bool inGrid = all(greaterThanEqual(gq, vec3(0.))) && all(lessThan(gq, vec3(1.)));
    ivec3 gs = textureSize(tLampGrid0, 0), gc = clamp(ivec3(gq*vec3(gs)), ivec3(0), gs - 1);
    ivec4 q0 = ivec4(texelFetch(tLampGrid0, gc, 0)*255. + .5)${grid > 4 ? ', q1 = ivec4(texelFetch(tLampGrid1, gc, 0)*255. + .5)' : ''};
    for (int k = 0; k < ${NL}; k++) {
      int i = !inGrid ? k : k < 4 ? q0[k] : ${grid > 4 ? 'k < 8 ? q1[k - 4] : ' : ''}255;
      if (i >= ${NL}) break;` : `for (int i = 0; i < ${NL}; i++) {`}
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

const direction = new THREE.Vector3(), up = new THREE.Vector3();
export function reflectEye(eye, reflected, height, vp) {
  eye.updateMatrixWorld(); eye.getWorldDirection(direction).add(eye.position);
  up.set(0,1,0).applyQuaternion(eye.quaternion); up.y *= -1;
  reflected.up.copy(up); reflected.position.copy(eye.position); reflected.position.y = 2*height-eye.position.y;
  reflected.lookAt(direction.x, 2*height-direction.y, direction.z);
  reflected.projectionMatrix.copy(eye.projectionMatrix); reflected.projectionMatrixInverse.copy(eye.projectionMatrixInverse);
  reflected.updateMatrixWorld(); vp.multiplyMatrices(reflected.projectionMatrix,reflected.matrixWorldInverse);
}

export const chartPars = `uniform sampler2D tChart; uniform mat4 uChartVP; uniform vec4 uChart;
  vec3 chartLight(vec3 W,vec3 N,vec3 V){
    if(uMirror>.5 || N.y<.97 || V.y<=0. || abs(W.y-uChart.y)>.004 || distance(W.xz,uChart.xz)>uChart.w) return vec3(0.);
    vec4 q=uChartVP*vec4(W,1.); vec2 uv=q.xy/q.w*.5+.5;
    float r=vFinish.a, lod=log2(1.+r*r*float(textureSize(tChart,0).y)*.18);
    return textureLod(tChart,uv,lod).rgb*envWeight(r,clamp(dot(N,V),0.,1.));
  }`;
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
