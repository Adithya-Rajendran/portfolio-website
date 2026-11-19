// Lean HDR post pipeline (replaces three's EffectComposer + UnrealBloom, which cost ~45% of the frame on an
// integrated GPU):
//   scene (half-float, MSAA)  ->  bloom: prefilter to 1/2 res, dual-filter down/up chain  ->  ONE full-res pass
//   that composites bloom and applies lens vignette, grain, the filmic look, AgX tone mapping and sRGB.
// The scene target can be smaller than the canvas (dynamic resolution); the final pass upsamples it.
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LUMA = `float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }`;
// A single NaN/Inf pixel would be smeared over the whole frame by the blur chain (seen as black flashes in WebKit).
const SAFE = `vec3 safe(vec3 c){ if (any(isnan(c)) || any(isinf(c))) return vec3(0.0); return clamp(c, 0.0, 64.0); }`;

const mat = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra,
});

export class Post {
  constructor(renderer, { hdr = true, packed = true, msaa = 4, levels = 6, look = {} } = {}) {
    this.renderer = renderer; this.hdr = hdr; this.msaa = msaa; this.levels = levels;
    // R11F_G11F_B10F: the usual HDR scene format in games. Half the memory and bandwidth of RGBA16F, which matters
    // most for the multisampled scene target (MSAA resolve was the single largest cost on integrated GPUs).
    this.fmt = !hdr ? { type: THREE.UnsignedByteType } : packed ? { type: THREE.UnsignedInt101111Type, format: THREE.RGBFormat } : { type: THREE.HalfFloatType };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.cam = new THREE.Camera();
    this.scene = this._makeScene();
    this.bloom = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(2, 2, { ...this.fmt, depthBuffer: false }));

    this.mPre = mat(`uniform sampler2D t; uniform vec2 px; uniform float thr, knee; varying vec2 vUv; ${LUMA} ${SAFE}
      vec3 s(vec2 o){ return safe(texture2D(t, vUv + o*px).rgb); }
      void main(){
        vec3 a = s(vec2(-1.0,-1.0)), b = s(vec2(1.0,-1.0)), c = s(vec2(-1.0,1.0)), d = s(vec2(1.0,1.0));
        // Karis average: weight by 1/(1+luma) so sub-pixel light strips do not shimmer in the bloom
        float wa = 1.0/(1.0+luma(a)), wb = 1.0/(1.0+luma(b)), wc = 1.0/(1.0+luma(c)), wd = 1.0/(1.0+luma(d));
        vec3 m = (a*wa + b*wb + c*wc + d*wd)/(wa + wb + wc + wd);
        float l = luma(m), soft = clamp(l - thr + knee, 0.0, 2.0*knee); soft = soft*soft/(4.0*knee + 1e-4);
        gl_FragColor = vec4(m*max(soft, l - thr)/max(l, 1e-4), 1.0);
      }`, { t: { value: null }, px: { value: new THREE.Vector2() }, thr: { value: look.threshold ?? 1.3 }, knee: { value: 0.6 } });

    this.mDown = mat(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(t, vUv).rgb*4.0;
        c += texture2D(t, vUv + px*vec2(-1.0,-1.0)).rgb + texture2D(t, vUv + px*vec2(1.0,-1.0)).rgb
           + texture2D(t, vUv + px*vec2(-1.0,1.0)).rgb + texture2D(t, vUv + px*vec2(1.0,1.0)).rgb;
        gl_FragColor = vec4(c*0.125, 1.0);
      }`, { t: { value: null }, px: { value: new THREE.Vector2() } });

    this.mUp = mat(`uniform sampler2D t; uniform vec2 px; uniform float gain; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(t, vUv + px*vec2(-2.0,0.0)).rgb + texture2D(t, vUv + px*vec2(2.0,0.0)).rgb
               + texture2D(t, vUv + px*vec2(0.0,-2.0)).rgb + texture2D(t, vUv + px*vec2(0.0,2.0)).rgb;
        c += (texture2D(t, vUv + px*vec2(-1.0,1.0)).rgb + texture2D(t, vUv + px*vec2(1.0,1.0)).rgb
            + texture2D(t, vUv + px*vec2(-1.0,-1.0)).rgb + texture2D(t, vUv + px*vec2(1.0,-1.0)).rgb)*2.0;
        gl_FragColor = vec4(c*(gain/12.0), 1.0);
      }`, { t: { value: null }, px: { value: new THREE.Vector2() }, gain: { value: 1.0 } },
      { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, transparent: true });

    this.mFinal = mat(`uniform sampler2D tScene, tBloom; uniform float uBloom, uContrast, uSat, uVig, uGrain, uTime; uniform vec2 uPx;
      varying vec2 vUv; ${LUMA} ${SAFE}
      #include <tonemapping_pars_fragment>
      vec3 fetch(vec2 uv){ return safe(texture2D(tScene, uv).rgb); }
      #ifdef FXAA
      // FXAA (3.11 "console" flavour) for the tier without MSAA. Edges are found and blended in a compressed space
      // (c / (1 + luma)) so that HDR light strips next to dark surfaces do not swamp their neighbours.
      vec3 T(vec3 c){ return c/(1.0 + luma(c)); }
      vec3 antialiased(vec2 uv){
        vec3 cM = T(fetch(uv)), cNW = T(fetch(uv + uPx*vec2(-0.5,-0.5))), cNE = T(fetch(uv + uPx*vec2(0.5,-0.5))),
             cSW = T(fetch(uv + uPx*vec2(-0.5,0.5))), cSE = T(fetch(uv + uPx*vec2(0.5,0.5)));
        float lM = luma(cM), lNW = luma(cNW), lNE = luma(cNE), lSW = luma(cSW), lSE = luma(cSE);
        float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec3 r = cM;
        if (lMax - lMin > max(0.02, lMax*0.125)) {
          vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
          float rcp = 1.0/(min(abs(dir.x), abs(dir.y)) + max((lNW + lNE + lSW + lSE)*0.03125, 1.0/128.0));
          dir = clamp(dir*rcp, -8.0, 8.0)*uPx;
          vec3 a = 0.5*(T(fetch(uv + dir*(1.0/3.0 - 0.5))) + T(fetch(uv + dir*(2.0/3.0 - 0.5))));
          vec3 b = a*0.5 + 0.25*(T(fetch(uv - dir*0.5)) + T(fetch(uv + dir*0.5)));
          float lB = luma(b); r = (lB < lMin || lB > lMax) ? a : b;
        }
        return r/max(1.0 - luma(r), 1e-3);
      }
      #else
      vec3 antialiased(vec2 uv){ return fetch(uv); }
      #endif
      void main(){
        vec3 c = antialiased(vUv) + texture2D(tBloom, vUv).rgb*uBloom;
        // lens: light falls off towards the corners. sensor: photon noise, relatively stronger in the shadows
        vec2 q = (vUv - 0.5)*vec2(1.0, 0.82); c *= mix(1.0 - uVig, 1.0, smoothstep(0.84, 0.2, length(q)));
        float n = fract(sin(dot(gl_FragCoord.xy + mod(uTime, 10.0)*vec2(61.3, 47.9), vec2(12.9898, 78.233)))*43758.5453) - 0.5;
        c = max(c + n*uGrain*sqrt(c + 0.004), 0.0);
        // filmic look in scene-linear: contrast in log space around mid grey (as Blender's AgX "Medium High Contrast")
        c = 0.18*pow(max(c/0.18, 1e-6), vec3(uContrast));
        c = max(mix(vec3(luma(c)), c, uSat), 0.0);
        c = AgXToneMapping(c);
        gl_FragColor = linearToOutputTexel(vec4(c, 1.0));
        gl_FragColor.rgb += n/255.0;                                   // dither: no banding in the dark gradients
      }`, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: look.bloom ?? 0.05 }, uContrast: { value: look.contrast ?? 1.3 },
        uSat: { value: look.saturation ?? 1.08 }, uPx: { value: new THREE.Vector2() }, uVig: { value: look.vignette ?? 0.42 }, uGrain: { value: look.grain ?? 0.045 }, uTime: { value: 0 },
        toneMappingExposure: { value: look.exposure ?? 0.9 } });
  }

  _makeScene() {
    const rt = new THREE.WebGLRenderTarget(4, 4, { ...this.fmt, samples: this.msaa, depthBuffer: true, stencilBuffer: false });
    rt.texture.generateMipmaps = false;
    return rt;
  }

  setExposure(v) { this.mFinal.uniforms.toneMappingExposure.value = v; }

  setMSAA(samples) {
    if (samples === this.msaa) return;
    const { width, height } = this.scene; this.scene.dispose(); this.msaa = samples; this.scene = this._makeScene(); this.scene.setSize(width, height);
  }

  /** Shader anti-aliasing in the final pass, for when MSAA is off. */
  setFXAA(on) { this.mFinal.defines = on ? { FXAA: 1 } : {}; this.mFinal.needsUpdate = true; this.fxaa = on; }

  setSize(w, h) {
    w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
    if (w === this.scene.width && h === this.scene.height) return;
    this.scene.setSize(w, h);
    for (let i = 0; i < this.levels; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); this.bloom[i].setSize(w, h); }
  }

  _pass(material, target) { this.quad.material = material; this.renderer.setRenderTarget(target); this.renderer.render(this.quad, this.cam); }

  /** Bloom + final composite of this.scene to the canvas. */
  render(time, skipBloom = false) {
    const r = this.renderer, b = this.bloom, autoClear = r.autoClear; r.autoClear = false;
    if (!skipBloom) {
    this.mPre.uniforms.t.value = this.scene.texture; this.mPre.uniforms.px.value.set(1 / this.scene.width, 1 / this.scene.height);
    this._pass(this.mPre, b[0]);
    for (let i = 1; i < this.levels; i++) {
      this.mDown.uniforms.t.value = b[i - 1].texture; this.mDown.uniforms.px.value.set(1 / b[i - 1].width, 1 / b[i - 1].height);
      this._pass(this.mDown, b[i]);
    }
    for (let i = this.levels - 1; i > 0; i--) {                       // each level adds the blurred level below it
      this.mUp.uniforms.t.value = b[i].texture; this.mUp.uniforms.px.value.set(0.5 / b[i].width, 0.5 / b[i].height);
      this._pass(this.mUp, b[i - 1]);
    }
    }
    const u = this.mFinal.uniforms; u.tScene.value = this.scene.texture; u.tBloom.value = b[0].texture; u.uTime.value = time;
    u.uPx.value.set(1 / this.scene.width, 1 / this.scene.height);
    this._pass(this.mFinal, null);
    r.autoClear = autoClear;
  }

  dispose() { this.scene.dispose(); this.bloom.forEach((t) => t.dispose()); }
}

/**
 * Dynamic resolution: keeps the frame rate up by shrinking the internal render size when frames run long, and
 * creeping back up when there is headroom. Increases back off exponentially after each failure so it settles.
 */
export class Governor {
  constructor({ min = 0.5, max = 1, target = 60, pinned = null } = {}) {
    this.min = min; this.max = max; this.scale = pinned ?? max; this.pinned = pinned != null;
    this.slow = 1000 / (target * 0.86); this.fast = 1000 / (target * 0.95);
    this.cool = 2; this.backoff = 8; this.good = 0; this.rest(4000);
  }
  /** Ignore the next `ms` of frames: start-up and room changes stall on shader compiles and texture uploads. */
  rest(ms) { this.warm = ms; this.acc = 0; this.n = 0; }
  /** @returns true when the scale changed */
  update(dtMs) {
    if (this.pinned || dtMs > 250) return false;                       // ignore tab switches / hitches
    if (this.warm > 0) { this.warm -= dtMs; return false; }
    this.acc += dtMs; this.n++;
    if (this.acc < 500) return false;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    this.cool = Math.max(0, this.cool - 0.5);
    if (avg > this.slow && this.scale > this.min) {
      this.scale = Math.max(this.min, this.scale * (avg > this.slow * 1.4 ? 0.8 : 0.9));
      this.cool = this.backoff; this.backoff = Math.min(120, this.backoff * 2); this.good = 0;
      return true;
    }
    if (avg < this.fast) {
      this.good += 0.5;
      if (this.good > 30) this.backoff = 8;                             // stable for a long time: forget old failures
      if (this.cool === 0 && this.scale < this.max) { this.scale = Math.min(this.max, this.scale * 1.07); this.cool = 2; return true; }
    }
    return false;
  }
}
