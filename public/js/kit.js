// Shared pieces: URL switches, shared uniforms, GLSL snippets and the small builders every effect uses.
import * as THREE from 'three';

import { params } from './dev.js';
export const Q = params();                                       // the address's switches: none off a DEV host (dev.js)
export const SKIP = new Set((Q.get('skip') || '').split(','));    // profiling switches: sunlight, mirror, bloom, holo, dust, shaft, storms, zpre
export const num = (k, d) => (Q.has(k) && !Number.isNaN(parseFloat(Q.get(k))) ? parseFloat(Q.get(k)) : d);
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const B = (v) => V(v[0], v[2], -v[1]);                     // Blender (x, y, z) -> three (x, z, -y)

// uTime: seconds. uPx: pixels per world unit at distance 1 (sizes point sprites). uMirror: 1 while the floor's mirror image renders.
export const uTime = { value: 0 }, uPx = { value: 1000 }, uMirror = { value: 0 };

// ---- GLSL
export const VERT = `varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const VERT_UV = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const VERT_XZ = `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const CY = 'vec3(0.2, 0.78, 1.0)', GOLD = 'vec3(1.0, 0.6, 0.2)';
// Opaque surfaces write their distance from the camera into alpha while the mirror image is rendered. That tells
// the floor how far away a reflected object is (-> how blurred its reflection is) without a depth texture.
// Without float render targets the distance has to fit 0..1, hence the scale.
export let DSCALE = 1, DIST = '';
export function setDistanceScale(k) { DSCALE = k; DIST = `gl_FragColor.a = uMirror > 0.5 ? distance(vW, cameraPosition)*${k.toFixed(2)} : 1.0;`; }

// ---- light-only materials: additive, and leaving that alpha channel untouched
export const ADD = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
export const GLOW = { transparent: true, depthWrite: false, ...ADD };
export const cy = (k = 1) => new THREE.Color(0.2 * k, 0.78 * k, k), gold = (k = 1) => new THREE.Color(k, 0.6 * k, 0.2 * k);
export const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, opacity, ...GLOW });
export const glow = (color) => new THREE.MeshBasicMaterial({ color, ...GLOW });
/** Additive shader material; the fragment shader gets vUv unless `extra` supplies another vertex shader. */
export const glsl = (fragmentShader, uniforms = {}, extra = {}) =>
  new THREE.ShaderMaterial({ ...GLOW, vertexShader: VERT_UV, fragmentShader, uniforms, ...extra });

/** A point cloud that is never culled. `attrs`: extra one-float-per-point attributes. */
export function cloud(position, material, attrs = {}) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, new THREE.Float32BufferAttribute(a, 1));
  const p = new THREE.Points(g, material); p.frustumCulled = false; return p;
}

// ---- text drawn into sprites
const FONT = '"Helvetica Neue", "Segoe UI", Arial, sans-serif';
function sprite(w, h, anchor, draw) {
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), c = cv.getContext('2d');
  c.textBaseline = 'middle'; if ('letterSpacing' in c) c.letterSpacing = '5px';
  draw(c);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), ...GLOW }));
  s.center.set(anchor, 0.5); return s;
}
/** Name tag: a title, a rule under it and a smaller line. Anchored at its left edge. */
export function label([title, sub], color = '#bfefff', width = 0.78) {
  const s = sprite(512, 128, 0, (c) => {
    c.fillStyle = color; c.font = `600 40px ${FONT}`; c.fillText(title, 14, 44);
    c.globalAlpha = 0.8; c.fillRect(14, 74, Math.min(484, c.measureText(title).width), 2);
    c.globalAlpha = 0.75; c.font = `500 24px ${FONT}`; c.fillText(sub, 14, 100);
  });
  s.scale.set(width, width / 4, 1); return s;
}
/** Data sheet: a title over key / value rows. Anchored at the right edge of its words and drawn over everything (it only
 *  shows when opened). pane: 0, light only; else it stands on a pane of dark glass that puts out this much of what is behind
 *  it, to be read against anything (a lit rib, a screen with words of its own). `width` is the words' width either way. */
export function sheet({ title, rows, accent = -1 }, color = '#bfefff', width = 1.15, pane = 0) {
  const h = 74 + rows.length * 45, m = pane ? 24 : 0, W = 512 + 2 * m, H = h + 2 * m;
  const s = sprite(W, H, (W - m) / W, (c) => {
    if (pane) {                                                     // the glass, its edge soft over 10 px, and a hairline round it
      const n = 5, a = 1 - (1 - pane) ** (1 / n); c.fillStyle = `rgba(3, 10, 18, ${a})`;
      for (let k = 0; k < n; k++) c.fillRect(k * 2, k * 2, W - k * 4, H - k * 4);
      c.strokeStyle = color; c.globalAlpha = 0.22; c.lineWidth = 1; c.strokeRect(9.5, 9.5, W - 19, H - 19); c.globalAlpha = 1;
      c.translate(m, m);
    }
    c.fillStyle = color; c.font = `600 30px ${FONT}`; c.fillText(title, 16, 30); c.fillRect(16, 54, 480, 2);
    rows.forEach(([k, v], i) => {
      const y = 96 + i * 45;
      c.fillStyle = color; c.globalAlpha = 0.6; c.textAlign = 'left'; c.font = `500 20px ${FONT}`; c.fillText(k, 16, y);
      const room = 480 - c.measureText(k).width - 18; let px = 24;                 // a long value keeps clear of its key: set smaller, as far as it stays readable
      c.font = `500 ${px}px ${FONT}`; while (px > 15 && c.measureText(v).width > room) c.font = `500 ${--px}px ${FONT}`;
      c.globalAlpha = 0.25; c.fillRect(16, y + 22, 480, 1);
      c.globalAlpha = 1; c.textAlign = 'right'; c.fillStyle = i === accent ? '#ffd9a8' : color; c.fillText(v, 496, y);
    });
  });
  if (pane) Object.assign(s.material, { blendDst: THREE.OneMinusSrcAlphaFactor });      // its light, over what the glass leaves of what is behind
  s.material.depthTest = false; s.renderOrder = 10; s.userData.pane = pane;
  s.userData.size = [width * W / 512, width * H / 512]; s.scale.set(...s.userData.size, 1); return s;
}

/** Eased open/close state: set `.to` to 0 or 1, call step() every frame for the smoothed 0..1 value. */
export const spring = (rate) => ({ x: 0, to: 0, step() { this.x += (this.to - this.x) * rate; return this.x * this.x * (3 - 2 * this.x); } });

/** Free everything a scene holds on the GPU (render-target textures belong to someone else). */
export function dispose(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const t of [m.map, ...Object.values(m.uniforms || {}).map((u) => u.value)]) {
        if (t?.isTexture && !t.isRenderTargetTexture) { t.dispose(); t.image?.close?.(); }
      }
      m.dispose();
    }
  });
}
