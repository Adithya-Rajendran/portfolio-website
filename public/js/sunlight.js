// The fixed architecture and live PBR objects must agree on the window, caster and receiver.
// All arguments are room/world-space. The bias is in metres, scaled to the orthographic depth range.
import * as THREE from 'three';
import { uMirror, DSCALE } from './kit.js';

export const windowShadow = (unit,size) => `float windowVisibility(vec3 W,vec3 N,float nl){
  if(nl<=0.) return 0.;
  const float unit=${unit.toFixed(8)};
  vec3 sp=(uSunVP*vec4(W+N*unit*(1.-clamp(nl,0.,1.)),1.)).xyz*.5+.5;
  if(any(lessThanEqual(sp,vec3(0.))) || any(greaterThanEqual(sp,vec3(1.)))) return 0.;
  float open=0.; float z=sp.z-(.0025+unit*(1.25-nl))/70.;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++)
    open+=step(z,texture2D(tShadow,sp.xy+vec2(float(i),float(j))*${(1.3/size).toFixed(8)}).r);
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
