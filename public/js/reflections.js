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
