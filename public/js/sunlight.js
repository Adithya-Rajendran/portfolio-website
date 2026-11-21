// The fixed architecture and live PBR objects must agree on the window, caster and receiver.
// All arguments are room/world-space. The bias is in metres, scaled to the orthographic depth range.
import * as THREE from 'three';
import { uMirror, DSCALE } from './kit.js';

export const windowShadow = (unit,size) => `float windowVisibility(vec3 W,vec3 N,float nl){
  const float unit=${unit.toFixed(8)}, halfWidth=${(unit*size*.5).toFixed(6)};
  const int resolution=${Math.max(1,Math.floor(size))};
  // Use the actual triangle plane (not a bevel's smoothed shading normal). Each PCF tap
  // looks along a DIFFERENT sun ray: at low sun its depth on a tabletop can differ by
  // centimetres. A single centre depth for all taps stripes even an unobstructed surface.
  vec3 face=cross(dFdx(W),dFdy(W)); float len2=dot(face,face);
  face=len2>1.e-18?face*inversesqrt(len2):N; if(dot(face,N)<0.)face=-face;
  float incidence=dot(face,uSunDir); if(nl<=0. || incidence<=.0001) return 0.;
  vec3 sp=(uSunVP*vec4(W+face*min(.001,unit*.15),1.)).xyz*.5+.5;
  if(any(lessThanEqual(sp,vec3(0.))) || any(greaterThanEqual(sp,vec3(1.)))) return 0.;
  vec3 right=vec3(uSunVP[0][0],uSunVP[1][0],uSunVP[2][0])*halfWidth;
  vec3 up=vec3(uSunVP[0][1],uSunVP[1][1],uSunVP[2][1])*halfWidth;
  vec2 dz=vec2(dot(face,right),dot(face,up))*(unit/(70.*incidence));
  vec2 tc=sp.xy*float(resolution); float open=0.,z=sp.z-(.0015+unit*.12)/70.;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
    ivec2 ij=clamp(ivec2(floor(tc+vec2(float(i),float(j))*1.3)),ivec2(0),ivec2(resolution-1));
    float receiver=z+dot(dz,vec2(ij)+.5-tc);  // actual sampled texel centre, not the nominal tap
    open+=step(receiver,texelFetch(tShadow,ij,0).r);
  }
  return open/9.;
}`;

// A real directional irradiance term in Three's own standard-material BRDF, not a tint or
// another light/shadow render. World position comes from the final morphed view position, so
// both printed pages and the drone use the same cast-and-receive map as the table below them.
export function receiveWindowSun(root, uniforms, visibility) {
  const materials=new Set(); root.traverse(o=>{if(o.material?.isMeshStandardMaterial) materials.add(o.material);});
  for(const m of materials){
    // The floor uses mirror alpha as distance. Transparent rotor blades blend light but
    // must not replace that distance with their opacity; opaque fittings write metres.
    if(m.transparent){ m.blending=THREE.CustomBlending; m.blendSrc=THREE.SrcAlphaFactor; m.blendDst=THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha=THREE.ZeroFactor; m.blendDstAlpha=THREE.OneFactor; }
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms,{uMirror});
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform mat4 uSunVP; uniform sampler2D tShadow; uniform vec3 uSunDir,uSunE; uniform float uMirror;
        ${visibility}`)
        .replace('#include <lights_fragment_begin>',`#include <lights_fragment_begin>
          vec3 W=cameraPosition+(vec4(geometryPosition,0.)*viewMatrix).xyz;
          vec3 N=normalize((vec4(geometryNormal,0.)*viewMatrix).xyz);
          float open=windowVisibility(W,N,dot(N,uSunDir));
          if(open>0.){
            directLight.direction=(viewMatrix*vec4(uSunDir,0.)).xyz;
            directLight.color=uSunE*(PI*open); directLight.visible=true;
            RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
          }`);
      if(!m.transparent) shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
        `#include <opaque_fragment>\nif(uMirror>.5) gl_FragColor.a=length(geometryPosition)*${DSCALE.toFixed(3)};`);
    };
    m.customProgramCacheKey=()=>`window-sun:${m.transparent}:${DSCALE}:${visibility}`; m.needsUpdate=true;
  }
}
