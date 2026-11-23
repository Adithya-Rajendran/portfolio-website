// Wall screens. What they say lives in content.json; this file only knows how to lay it out.
// Each screen is a Canvas 2D drawing shown as an emissive panel, redrawn (and re-uploaded) only when it changes.
import * as THREE from 'three';
import { VERT, DIST, uMirror } from './kit.js';

const W = 1024, H = 696, CYCLE = 7, FADE = 0.8;                 // canvas size; seconds per message and its fade
const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const INK = { cy: '#6fdcff', amber: '#ffb057', faint: 'rgba(255,176,87,0.35)', dim: '#4d7f95', fg: '#d9f3ff', white: '#fff' };

// ---- live values: any text may contain {tminus} or the name of a counter from content.json, e.g. {aboard}
let depart = 0, counters = {};
export function initLive({ depart: clock, live }) {
  const [h, m, s] = clock.split(':').map(Number);
  depart = Date.now() + ((h * 60 + m) * 60 + s) * 1000; counters = live;
}
export function live(t = performance.now() / 1000) {
  const s = Math.max(0, Math.floor((depart - Date.now()) / 1000)), two = (n) => String(n).padStart(2, '0');
  const v = { tminus: `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` };
  for (const [k, c] of Object.entries(counters)) v[k] = Math.min(c.max ?? Infinity, c.from + Math.floor(t * c.per));
  return v;
}
export const fill = (str, v) => str.replace(/\{(\w+)\}/g, (_, k) => (typeof v[k] === 'number' ? v[k].toLocaleString('en-US') : v[k] ?? ''));

// ---- drawing vocabulary
/** One line of text. style = "weight size ink", then any of: mono, right, center, sN (N px of letter spacing). */
function put(c, str, x, y, style) {
  const [weight, size, ink, ...opt] = style.split(' ');
  c.font = `${weight} ${size}px ${opt.includes('mono') ? MONO : SANS}`;
  c.fillStyle = INK[ink]; c.textAlign = opt.find((o) => o === 'right' || o === 'center') || 'left';
  if ('letterSpacing' in c) c.letterSpacing = `${opt.find((o) => /^s\d/.test(o))?.slice(1) || 0}px`;
  c.fillText(str, x, y);
}
const rule = (c, y, alpha = 0.12, h = 1) => { c.fillStyle = `rgba(111,220,255,${alpha})`; c.fillRect(48, y, 928, h); };
/** Key / value rows; a third entry names the ink of the value. */
function rows(c, y, step, list) {
  list.forEach(([k, v, ink = 'fg'], i) => {
    put(c, k, 48, y + i * step, '500 22 dim s3'); put(c, v, 976, y + i * step, `500 30 ${ink} right s1`); rule(c, y + i * step + 26);
  });
}
function frame(c, title, tag, footer) {
  c.globalAlpha = 1; c.fillStyle = '#020c14'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(40,120,160,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = INK.cy; c.fillRect(48, 44, 10, 34);
  put(c, title, 76, 62, '600 30 cy s6'); put(c, tag, 976, 62, '500 20 dim right s6'); rule(c, 100, 0.35, 2);
  put(c, footer, 48, 656, '500 18 dim s6');
}
const rnd = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const FIGURES = {
  ship(c, s) {                                               // side elevation: drive, spine, habitat rings edge-on, shield
    c.strokeStyle = INK.cy; c.lineWidth = 2; c.beginPath();
    c.moveTo(70, 200); c.lineTo(150, 170); c.lineTo(150, 230); c.closePath(); c.moveTo(150, 200); c.lineTo(880, 200);
    for (const x of [330, 470, 610]) c.rect(x - 16, 140, 32, 120);
    c.moveTo(880, 150); c.quadraticCurveTo(960, 200, 880, 250); c.closePath();
    for (const x of [210, 250, 740, 790]) { c.moveTo(x, 186); c.lineTo(x, 214); }
    c.stroke();
    [[110, 262], [470, 292], [905, 282], [515, 180]].forEach(([x, y], i) => put(c, s.captions[i], x, y, '500 16 dim center s2'));
  },
  crossing(c, s, t) {                                        // home star, dashed course, destination; a marker that has just set out
    for (let i = 0; i < 90; i++) {
      const r = rnd(i, 3), d = r > 0.85 ? 3 : 2;
      c.fillStyle = `rgba(190,225,255,${0.15 + r * 0.5})`; c.fillRect(48 + rnd(i, 1) * 928, 120 + rnd(i, 2) * 300, d, d);
    }
    const x0 = 130, x1 = 890, y = 270, xm = x0 + 26 + (Math.floor(t) % 2) * 2;
    const disc = (x, r, ink) => { c.fillStyle = ink; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    c.lineWidth = 2; c.strokeStyle = 'rgba(111,220,255,0.6)'; c.setLineDash([6, 10]); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
    c.setLineDash([]); disc(x0, 13, '#ffe7b0'); disc(x1, 9, '#ff8d6b'); c.strokeStyle = INK.amber; c.beginPath(); c.arc(x1, y, 20, 0, 7); c.stroke();
    c.fillStyle = INK.white; c.beginPath(); c.moveTo(xm + 14, y); c.lineTo(xm, y - 7); c.lineTo(xm, y + 7); c.fill();
    put(c, s.captions[0], x0, y + 48, '500 22 fg center s4'); put(c, s.captions[1], x0, y + 76, '500 17 dim center s4');
    put(c, s.captions[2], x1 - 60, y + 48, '500 22 fg center s4'); put(c, s.captions[3], x1 - 60, y + 76, '500 17 dim center s4');
  },
};

// ---- layouts: (canvas, screen content, T = fill in live values, seconds, live values)
const LAYOUTS = {
  board(c, s, T, t) {                                        // departure board: a big clock, facts, a blinking status line
    put(c, s.label, 48, 150, '500 22 dim'); put(c, T(s.clock), 40, 250, '300 150 amber mono'); rows(c, 372, 60, s.rows);
    put(c, s.status, 84, 558, `600 30 ${Math.floor(t) % 2 ? 'faint' : 'amber'} s4`); c.fillRect(48, 548, 18, 18);
  },
  messages(c, s, T, t) {                                     // one message at a time, fading in and out, word-wrapped
    const p = t % CYCLE, [msg, from] = s.items[Math.floor(t / CYCLE) % s.items.length];
    let line = '', y = 230;
    c.globalAlpha = Math.max(0, Math.min(1, p / FADE, (CYCLE - p) / FADE)); put(c, '', 0, 0, '300 62 fg');
    for (const w of msg.split(' ')) {
      if (c.measureText(line + w).width > 900) { c.fillText(line.trim(), 48, y); y += 78; line = ''; }
      line += w + ' ';
    }
    c.fillText(line.trim(), 48, y); put(c, '— ' + from, 48, y + 84, '600 26 amber s6'); c.globalAlpha = 1;
    put(c, s.label, 48, 548, '500 22 dim'); put(c, T(s.count), 48, 596, '300 44 cy mono'); put(c, s.note, 976, 596, '500 22 dim right');
  },
  rows(c, s, T, t) {                                         // key / value rows, under a figure or over a closing line
    FIGURES[s.figure]?.(c, s, t); rows(c, s.figure ? 440 : 170, s.figure ? 60 : 70, s.rows);
    if (s.line) put(c, s.line, 48, 556, '300 40 fg s1');
  },
  roster(c, s, T, t) {                                       // a table whose highlighted row moves on every few seconds
    const now = Math.floor(t / 3) % s.people.length, X = [48, 430, 610, 976];
    s.head.forEach((h, i) => put(c, h, X[i], 132, `500 17 dim s3${i === 3 ? ' right' : ''}`));
    s.people.forEach(([name, from, role], i) => {
      const y = 178 + i * 58, state = Math.sign(i - now) + 1;         // 0 aboard, 1 at the gate, 2 still to come
      if (i === now) { c.fillStyle = 'rgba(255,176,87,0.12)'; c.fillRect(36, y - 26, 952, 52); }
      put(c, name, 48, y, `400 28 ${i === now ? 'white' : 'fg'}`); put(c, from, 430, y, '500 20 dim s2'); put(c, role, 610, y, '500 20 dim s2');
      put(c, s.states[state], 976, y, `500 20 ${['cy', 'amber', 'dim'][state]} right s2`); rule(c, y + 28, 0.1);
    });
    put(c, T(s.count), 48, 610, '500 20 dim');
  },
  bars(c, s, T, t, v) {                                      // a figure over progress bars; a bar's level may be a live counter
    FIGURES[s.figure]?.(c, s, t);
    s.bars.forEach(([k, level, text], i) => {
      const y = 346 + i * 56, x = typeof level === 'string' ? v[level] / counters[level].max : level;
      put(c, k, 48, y, '500 20 dim s3'); c.fillStyle = 'rgba(111,220,255,0.14)'; c.fillRect(360, y - 7, 440, 14);
      c.fillStyle = INK[x < 1 ? 'amber' : 'cy']; c.fillRect(360, y - 7, 440 * x, 14); put(c, T(text), 976, y, '500 24 fg right');
    });
  },
  catalogue(c, s) {                                          // the Library's shelf list: a title over its date; the one called for is marked
    const step = Math.min(104, 520 / Math.max(1, s.volumes.length)); put(c, '', 0, 0, '400 34 fg');
    const clip = (str, width) => { if (c.measureText(str).width <= width) return str; while (str.length > 1 && c.measureText(str + '…').width > width) str = str.slice(0, -1); return str.trimEnd() + '…'; };
    s.volumes.forEach((v, i) => {
      const y = 158 + i * step, on = i === s.selected;
      if (on) { c.fillStyle = 'rgba(255,176,87,0.13)'; c.fillRect(36, y - 34, 952, step - 10); c.fillStyle = INK.amber; c.fillRect(36, y - 34, 5, step - 10); }
      c.font = `400 34px ${SANS}`; put(c, clip(v.title, on ? 700 : 910), 60, y, `400 34 ${on ? 'white' : 'fg'}`);
      put(c, `${v.date}  ·  ${v.minutes} MIN`.toUpperCase(), 60, y + 38, '500 18 dim s4'); if (on) put(c, s.called, 970, y, '600 20 amber right s4');
    });
    if (!s.volumes.length) put(c, s.empty, 48, 300, '300 40 dim');
  },
  placard(c, s) {                                            // a numbered (or plain) title card
    const y = s.no ? 340 : 200;
    if (s.no) put(c, s.no, 44, 210, '200 150 amber');
    put(c, s.name, 48, y, '300 64 fg'); put(c, s.meta, 48, y + 60, '500 22 dim s4'); rule(c, y + 100, 0.3);
    put(c, s.lines[0], 48, y + 150, '300 30 fg'); put(c, s.lines[1], 48, y + 200, '300 30 dim');
    if (s.cta) put(c, s.cta, 48, 606, '600 22 cy s4');
  },
};
const EVERY = { board: 1, roster: 3, bars: 2 };                // seconds between redraws; anything else is drawn once

// Uploading a canvas into an sRGB texture takes Chrome/ANGLE ~20 ms per screen (Intel HD 630): a visible hitch
// whenever several screens redraw together. A plain RGBA8 upload is fast, so the canvas goes into one shared staging
// texture and a full-screen draw decodes it into the screen's sRGB texture (the hardware re-encodes it: bit-exact).
const stage = new THREE.CanvasTexture(); stage.flipY = false; stage.generateMipmaps = false; stage.minFilter = stage.magFilter = THREE.NearestFilter;
const decode = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { t: { value: stage } }, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D t; varying vec2 vUv;
    void main(){ vec3 c = texture2D(t, vUv).rgb; gl_FragColor = vec4(mix(c/12.92, pow((c + 0.055)/1.055, vec3(2.4)), step(0.04045, c)), 1.0); }`,
}));
decode.frustumCulled = false;
const decodeCam = new THREE.Camera();

/** @param cfg a room's "screens" entry from content.json. Returns one material per screen, in list order. */
export function createScreens({ footer, tag = '', list }, renderer, anisotropy, gain = 0.9) {
  const items = list.map((s) => {
    const cv = Object.assign(document.createElement('canvas'), { width: W, height: H }), ctx = cv.getContext('2d');
    const rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace, anisotropy, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const tex = rt.texture; tex.userData.canvas = cv;
    ctx.textBaseline = 'middle';
    const material = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uMirror, uGain: { value: gain } }, vertexShader: VERT, side: THREE.DoubleSide,     // a screen laid back on a desk may be wound either way
      fragmentShader: `uniform sampler2D map; uniform float uMirror, uGain; varying vec2 vUv; varying vec3 vW;
        void main(){
          vec3 c = texture2D(map, vUv).rgb;
          c *= 0.9 + 0.1*sin(vUv.y*${H}.0*3.14159);                       // pixel rows
          c += vec3(0.004, 0.012, 0.02);                                  // a panel never goes fully black
          gl_FragColor = vec4(c*uGain, 1.0); ${DIST}
        }`,
    });
    return { s, ctx, rt, material, last: null };
  });
  function update() {
    const t = performance.now() / 1000, v = live(t), fading = Math.min(t % CYCLE, CYCLE - (t % CYCLE)) < FADE;
    for (const it of items) {
      const { s } = it, every = s.layout === 'messages' ? (fading ? 0.1 : 1) : s.figure === 'crossing' ? 1 : EVERY[s.layout];
      const key = `${every ? Math.floor(t / every) : 0}/${s.rev ?? 0}`;                // s.rev: bumped by whoever changes the content
      if (key === it.last) continue;
      it.last = key; frame(it.ctx, s.title, s.tag ?? tag, footer); LAYOUTS[s.layout](it.ctx, s, (str) => fill(str, v), t, v);
      stage.image = it.ctx.canvas; stage.needsUpdate = true; renderer.setRenderTarget(it.rt); renderer.render(decode, decodeCam);
    }
  }
  update();
  return { materials: items.map((it) => it.material), update, dispose: () => items.forEach((it) => it.rt.dispose()) };
}
