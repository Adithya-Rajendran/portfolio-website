// One local, path-traced radiance probe per room. Only polished batches use it; their Cycles
// lightmaps omit first-hit glossy (no double highlight). The floor has its own live planar pass.
// Position, roughness and linear F0 come from the actual material/geometry, not the object name.
export const probePars = `
  uniform highp sampler2DArray tRoomSpec;
  uniform vec3 uProbePos, uBoxLo, uBoxHi;
  uniform float uProbeRange, uSpecGain;
  varying vec4 vFinish;
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
    // Split-sum GGX environment BRDF (Lazarov's fit). In particular rough metal doesn't
    // gain a white mirror rim just because the view is grazing.
    float nv = clamp(dot(N,V),0.,1.);
    vec4 p = r*vec4(-1.,-.0275,-.572,.022) + vec4(1.,.0425,1.04,-.04);
    float a004 = min(p.x*p.x, exp2(-9.28*nv))*p.x + p.y;
    vec2 ab = vec2(-1.04,1.04)*a004 + p.zw;
    return env*max(vFinish.rgb*ab.x + ab.y, vec3(0.))*uSpecGain;
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
