// The Contact room's field, after the Culture: no keyboard and no screen, a field of light that unfolds in the air above
// the plinth when you come up to it, with a small drone in attendance whose aura shows its mood.
// What it offers is decided by what the site has (content.json "comms", filled from the profile by js/site.js):
//   links  neither an address nor a send endpoint: the ways to reach the owner, each a plain button that opens in a new tab
//   mail   an address: a message box, and one button that opens the visitor's own mail program with the message in it
//          (their program knows who they are); the address is shown and can be copied
//   send   an endpoint: a message box, the visitor's email for the answer, and SEND. The station posts
//          { message, email, from, at } as JSON to the endpoint, and says whether it went.
// The words are drawn as light on a dark plate, so they read over the lit Earth and a pale room alike. Everything that can
// be pressed or typed in is also a real element (<a>, <button>, <textarea>, <input>) in section#comms, laid exactly over
// its drawing and left clear: the keyboard, a finger, a screen reader and the browser's own menu for a link all find it.
import * as THREE from 'three';
import { GLOW, V, uTime, spring } from './kit.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
// Inks. The canvas is black where nothing is drawn and the shader adds its square as light: an ink's alpha is its strength.
const INK = { fg: '#f4faff', soft: 'rgba(224,240,255,0.93)', dim: 'rgba(200,226,248,0.72)', line: 'rgba(150,215,255,0.62)', cy: '#9be6ff', warm: '#ffdcae', bad: '#ffcbb8',
  fill: 'rgba(143,227,255,0.15)', lit: 'rgba(143,227,255,0.3)' };
// the drone's aura, by mood (Culture drones wear their mood in colour; this palette is the station's own)
const MOOD = { idle: '#8fd6ff', composing: '#ffd59a', sending: '#ffffff', sent: '#a6ffcf', handed: '#a6ffcf', email: '#ffb4a0', failed: '#ff9c9c' };
// Two layouts of the field: landscape, and portrait for phones held upright. Canvas pixels; size in metres; lift raises the
// field clear of the plinth; drone: where it hovers beside (or above) it. T: the sizes of its type and the heights of what
// can be pressed (a finger needs 44 CSS px: upright, the field is as wide as the phone, 1000 canvas px to about 340).
// standby: while nobody is at the field (it is open as a band then), the kicker's baseline, the invitation's first one and the
// kicker's size; invite: the invitation's size at most, and on how many lines.
const LAYOUT = {
  land: { W: 1600, H: 1000, size: [1.92, 1.2], lift: 0.14, drone: [1.3, 0.26], m: 80, standby: [392, 610, 64], invite: [200, 1],
          T: { top: 104, kick: 28, lede: 66, ledeMax: 2, body: 40, type: 44, btn: 46, sub: 28, caps: 30, gap: 28, links: [150, 104], row: 110 } },
  port: { W: 1000, H: 1400, size: [1.15, 1.61], lift: 0.3, drone: [0.3, 1.4], m: 60, standby: [455, 690, 76], invite: [230, 2],
          T: { top: 96, kick: 32, lede: 60, ledeMax: 4, body: 42, type: 48, btn: 48, sub: 30, caps: 34, gap: 20, links: [150, 130], row: 140 } },
};
const STANDBY = 0.62, REACH = 0.45, HALO = 0.16;                 // with nobody at it the field stays open as a band, and larger, to be seen from the door; HALO: how far its light reaches beyond its edge, m
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inside = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const UNFOLD = `float ox = smoothstep(0.0, 0.45, uOpen), oy = smoothstep(0.25, 1.0, uOpen);`;      // it unfolds from a horizontal line, wider than tall first
const HUE = `vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.333, 0.667))*6.0 - 3.0) - 1.0, 0.0, 1.0); }
  vec3 tint(vec2 uv, float t){ return mix(vec3(0.55, 0.85, 1.0), hue(0.52 + 0.08*sin(t*0.2 + uv.x*3.0 + uv.y*2.0)), 0.35); }`;

// The field is drawn in three parts, and leaves the scene's alpha channel alone (the floor's mirror pass reads distance there).
// First a shade: nothing behind the field stays brighter than a dull glow (the lit Earth's limb is many times white, and a
// veil thin enough to see through would let it drown the words). It writes depth and is drawn before the sun, which is
// brighter still: behind the field the sun is simply eclipsed.
const PLANE = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
function shade(uniforms) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide, uniforms, vertexShader: PLANE,
    blending: THREE.CustomBlending, blendEquation: THREE.MinEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    fragmentShader: `uniform float uOpen; varying vec2 vUv;
      void main(){ ${UNFOLD} vec2 q = abs(vUv - 0.5)*2.0; if (q.x > ox || q.y > oy) discard; gl_FragColor = vec4(vec3(0.25), 1.0); }`,
  });
}
// Then the plate: what is left of the room behind goes down to a ghost of itself, and on it the words are light.
function field(uniforms) {
  return new THREE.ShaderMaterial({
    ...GLOW, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, uniforms, vertexShader: PLANE,
    fragmentShader: `uniform sampler2D tMap; uniform float uOpen, uLife, uGain; uniform vec2 uSize; varying vec2 vUv; ${HUE}
      void main(){
        ${UNFOLD}
        vec2 q = abs(vUv - 0.5)*2.0, d = (vec2(ox, oy) - q)*uSize*0.5;       // d: metres in from the edge of what is open
        float e = min(d.x, d.y); if (e < 0.0) discard;
        // a field, not a screen: an edge of light a few millimetres wide, its glow a hand's breadth in, a faint body with a slow grain
        float px = fwidth(e), rim = 1.0 - smoothstep(0.0, max(0.005, px*1.5), e), glow = exp(-e/0.035) + 0.35*exp(-e/0.16);
        float grain = 0.5 + 0.5*sin(vUv.x*uSize.x*9.0 + vUv.y*uSize.y*6.0 + uLife*0.7)*sin(vUv.y*uSize.y*13.0 - uLife*0.45);
        vec3 t = tint(vUv, uLife), c = vec3(0.004, 0.011, 0.018) + t*(0.006 + 0.005*grain + glow*0.05 + rim*0.85);
        vec3 ui = texture2D(tMap, vUv).rgb; ui = ui*ui;                // the canvas is drawn in sRGB: light, in linear
        float k = smoothstep(0.0, 0.15, uOpen);
        gl_FragColor = vec4((c + ui*uGain)*k, (0.93 - 0.2*rim)*k);
      }`,
  });
}
// Last, its light in the air around it: outside the edge, fading over a hand's breadth. It dims nothing.
function halo(uniforms) {
  return new THREE.ShaderMaterial({
    ...GLOW, side: THREE.DoubleSide, uniforms,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform float uOpen, uLife; uniform vec2 uSize; varying vec2 vP; ${HUE}
      void main(){
        ${UNFOLD}
        vec2 d = abs(vP) - vec2(ox, oy)*uSize*0.5; float e = length(max(d, 0.0));
        if (max(d.x, d.y) <= 0.0) discard;                             // the plate is there
        gl_FragColor = vec4(tint(vP/uSize + 0.5, uLife)*(0.16*exp(-e/0.012) + 0.05*exp(-e/0.05))*smoothstep(0.0, 0.15, uOpen), 1.0);
      }`,
  });
}

/**
 * @param center  world position of the field's middle;  facing: horizontal direction it faces (into the room)
 * @param window  a world point in the window, where a sent message leaves the room;  out: the way it goes on
 */
export function createComms({ scene, center, facing, text, window: win, out }) {
  const root = new THREE.Group(); root.position.copy(center); root.lookAt(center.clone().add(facing)); scene.add(root);
  const web = (k) => { try { return /^https?:$/.test(new URL(k[1], location.href).protocol); } catch { return false; } };      // a link leads to a page or a file, nothing else
  const mode = text.endpoint ? 'send' : text.address ? 'mail' : 'links', Wr = text.write, links = (text.links || []).filter(web).slice(0, 6).map((k) => [...k]);
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  let tex = null, L = null, T = null, W = 0, H = 0, cam = null, life = 0;
  const U = { tMap: { value: null }, uOpen: { value: 0 }, uLife: { value: 0 }, uGain: { value: 2.8 }, uSize: { value: new THREE.Vector2(1, 1) } };
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(), shade(U)); dark.renderOrder = 0.4; root.add(dark);            // before the sun and the storms (1): they are behind it
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(), field(U)); panel.renderOrder = 0.5; root.add(panel);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(), halo(U)); glow.renderOrder = 6; root.add(glow);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ visible: false })); root.add(hit);
  function layout() {                                            // (re)build for the screen's orientation
    const next = LAYOUT[innerWidth < innerHeight * 0.9 ? 'port' : 'land']; if (next === L) return false;
    L = next; T = L.T; W = cv.width = L.W; H = cv.height = L.H; U.uSize.value.set(...L.size);
    tex?.dispose(); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; U.tMap.value = tex;
    for (const m of [dark, panel, hit, glow]) { m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(L.size[0] + (m === glow ? 2 * HALO : 0), L.size[1] + (m === glow ? 2 * HALO : 0)); }
    return true;
  }
  const open = spring(0.07); let expanded = false;

  // ---- a slow ring of light under the field says "something lives here"
  const seed = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 3.0), ...GLOW }));
  seed.position.y = -0.56; seed.rotation.x = Math.PI / 2; root.add(seed);

  // ---- the drone: a rounded body in the room's light (receives the window sun, room.js) and an aura that is its mood
  const drone = new THREE.Group(); drone.position.z = -0.18; root.add(drone);
  const shape = (w, h, d) => { const g = new THREE.SphereGeometry(1, 40, 24); g.scale(w / 2, h / 2, d / 2); return g; };
  const body = new THREE.Mesh(shape(0.34, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.75, roughness: 0.22 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.006, 8, 64), new THREE.MeshStandardMaterial({ color: 0x20262c, metalness: 0.5, roughness: 0.4 }));
  band.rotation.x = Math.PI / 2; band.scale.set(1.0, 0.7, 1.0);
  const auraMat = new THREE.ShaderMaterial({ ...GLOW, side: THREE.BackSide, uniforms: { uCol: { value: new THREE.Color(MOOD.idle) }, uK: { value: 1 }, uTime },
    vertexShader: `varying vec3 vN, vV; void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK, uTime; varying vec3 vN, vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uCol*uCol*f*uK*(0.9 + 0.1*sin(uTime*2.3)), 1.0); }` });
  const aura = new THREE.Mesh(shape(0.5, 0.3, 0.4), auraMat);
  drone.add(body, band, aura);

  // ---- what the field offers, as real elements. Each lies over its drawing (lay()), clear: a link is a link (a tap, a
  // middle click, the browser's own menu), a button a button, and Tab goes through them in the order they are read. The
  // two places for text only take the keyboard; a press on their drawing gives it to them.
  const dom = Object.assign(document.createElement('section'), { id: 'comms', inert: true }); dom.setAttribute('aria-label', text.title); dom.dataset.mode = mode;
  dom.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:1;pointer-events:none;';
  const OVER = 'position:absolute;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;border-radius:0;background:none;color:transparent;opacity:0;overflow:hidden;font:16px sans-serif;outline:0;resize:none;-webkit-tap-highlight-color:transparent;';
  const el = (tag, props, attrs = {}, pressed = true) => { const e = Object.assign(document.createElement(tag), props); for (const k in attrs) e.setAttribute(k, attrs[k]);
    e.style.cssText = OVER + (pressed ? 'cursor:pointer;' : 'pointer-events:none;'); dom.append(e); return e; };
  const msg = mode === 'links' ? null : el('textarea', { maxLength: text.max || 2000, spellcheck: true }, { 'aria-label': Wr.message }, false);
  const sig = mode === 'send' ? el('input', { type: 'email', autocomplete: 'email', required: true }, { 'aria-label': `${Wr.email}, ${Wr.emailFor}` }, false) : null;
  const act = mode === 'send' ? el('button', { type: 'button', textContent: Wr.send }, { 'data-act': 'send' }) : mode === 'mail' ? el('a', { textContent: Wr.mail }, { 'data-act': 'mail' }) : null;
  const copy = mode === 'mail' ? el('button', { type: 'button', textContent: Wr.copy }, { 'data-act': 'copy', 'aria-label': `${Wr.copy}: ${text.address}` }) : null;
  const status = el('p', {}, { role: 'status' }, false);
  for (const k of links) {                                       // [name, url] -> where it leads, said under its name: the site ("github.com"), or for a file of this site its kind ("PDF")
    const u = new URL(k[1], location.href);
    k.sub = u.origin === location.origin ? (u.pathname.match(/\.(\w+)$/)?.[1] ?? '').toUpperCase() : u.hostname.replace(/^www\./, '');
    k.el = el('a', { href: u.href, target: '_blank', rel: 'noopener', textContent: k[0] }, text.opens ? { 'aria-label': `${k[0]}, ${text.opens}` } : {});
  }
  document.body.append(dom);
  const fields = [msg, sig].filter(Boolean), pressed = [act, copy, ...links.map((k) => k.el)].filter(Boolean), zones = new Map();
  let state = 'idle', mood = 'idle', blink = 0, sending = null, hover = null, copied = false, keys = false, opener = null;
  const redraw = () => { draw(); tex.needsUpdate = true; };
  const say = (s) => { state = mood = s; status.textContent = text.status[s] ?? ''; redraw(); };
  const mailto = () => `mailto:${encodeURIComponent(text.address).replace(/%40/g, '@')}?subject=${encodeURIComponent(text.subject)}&body=${encodeURIComponent(msg.value.trim().replace(/\r?\n/g, '\r\n'))}`;
  const ready = () => !!msg.value.trim() && (!sig || (!!sig.value.trim() && sig.checkValidity())) && state !== 'sending';
  const typed = () => { if (mode === 'mail') act.href = mailto(); if (state !== 'sending') say(msg.value.trim() ? 'composing' : 'idle'); };
  for (const f of fields) {
    f.addEventListener('input', typed); f.addEventListener('focus', redraw); f.addEventListener('blur', redraw);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (f === sig || e.metaKey || e.ctrlKey)) { e.preventDefault(); act.click(); } });
  }
  for (const p of pressed) {
    p.addEventListener('focus', redraw); p.addEventListener('blur', redraw);
    p.addEventListener('pointerenter', () => { hover = p; redraw(); }); p.addEventListener('pointerleave', () => { if (hover === p) { hover = null; redraw(); } });
  }
  if (mode === 'mail') { act.href = mailto(); act.addEventListener('click', () => say('handed')); }      // the browser hands the mailto: to the visitor's mail program
  if (mode === 'send') act.addEventListener('click', send);
  copy?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text.address); copied = true; copy.textContent = Wr.copied; redraw(); } catch { /* not allowed: the address is there to be read */ } });
  const onSelect = () => { if (document.activeElement === msg) redraw(); }, onKey = () => { keys = true; }, onPointer = () => { keys = false; };
  document.addEventListener('selectionchange', onSelect); addEventListener('keydown', onKey, true); addEventListener('pointerdown', onPointer, true);      // keys: the visitor is finding their way by keyboard

  // ---- drawing the field (light on black: the shader adds it)
  function font(weight, size, family = SANS, spacing = 0) { c.font = `${weight} ${size}px ${family}`; if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`; }
  function lines(str, width) {                                   // word-wrapped lines, each with the index it starts at
    const out = []; let start = 0;
    for (const para of str.split('\n')) {
      let line = '', at = start;
      for (const word of para.split(/(?<= )/)) {
        if (c.measureText(line + word).width > width && line) { out.push([line, at]); at += line.length; line = ''; }
        line += word;
      }
      out.push([line, at]); start += para.length + 1;
    }
    return out;
  }
  const wrap = (str, width, most = 99) => { const ls = lines(str || '', width).map(([l]) => l.trim()).filter(Boolean); return ls.length > most ? [...ls.slice(0, most - 1), ls[most - 1].replace(/[\s,;:.]*\S*$/, '…')] : ls; };
  const caps = (str, x, y, size, ink, align = 'left') => {       // spaced capitals; the space after the last letter is taken back, so they centre and end where they should
    font(600, size, SANS, size * 0.3); c.fillStyle = ink; c.textAlign = align; c.fillText(str.toUpperCase(), x + (align === 'left' ? 0 : size * (align === 'center' ? 0.15 : 0.3)), y); c.textAlign = 'left'; };
  const shrink = (str, width, size, least, set) => { for (set(size); c.measureText(str).width > width && size > least; set(size -= 2)); return size; };      // the largest size at which it fits
  const rounded = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const focused = (e) => document.activeElement === e && e.matches(':focus-visible');
  function arrow(x, y, s, ink) {                                 // up and out: it opens somewhere else (drawn: as a character, some phones make a picture of it)
    c.strokeStyle = ink; c.lineWidth = Math.max(3, s * 0.15); c.lineCap = c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x, y + s); c.lineTo(x + s, y); c.moveTo(x + s * 0.28, y); c.lineTo(x + s, y); c.lineTo(x + s, y + s * 0.72); c.stroke(); c.lineCap = 'butt'; c.lineJoin = 'miter';
  }
  /** Something to press: its name on it, under that where it leads (links), an arrow if it opens elsewhere. The one with the keyboard wears a second ring. */
  function button(e, [x, y, w, h], name, { sub = '', out = false, strong = false, small = false } = {}) {
    const on = hover === e, ink = strong ? INK.warm : INK.cy, pad = Math.min(36, w * 0.09), s = small ? T.caps : T.btn, as = s * 0.46, room = w - 2 * pad - (out ? as + 18 : 0), mid = y + h / 2;
    rounded(x, y, w, h, 16); c.fillStyle = on ? INK.lit : INK.fill; c.fill(); c.lineWidth = on || strong ? 4 : 2.5; c.strokeStyle = on || strong ? ink : INK.line; c.stroke();
    if (focused(e)) { rounded(x - 10, y - 10, w + 20, h + 20, 24); c.lineWidth = 5; c.strokeStyle = INK.warm; c.stroke(); }
    let z, base;                                                 // the name's size and its baseline
    if (small) { const str = name.toUpperCase(); z = shrink(str, room, s, 18, (q) => font(600, q, SANS, q * 0.26)); base = mid + z * 0.36;
      c.fillStyle = strong ? INK.warm : INK.fg; c.textAlign = out ? 'left' : 'center'; c.fillText(str, out ? x + pad : x + w / 2 + z * 0.13, base); c.textAlign = 'left'; }
    else { z = shrink(name, room, s, 24, (q) => font(500, q)); base = sub ? mid + z * 0.04 : mid + z * 0.35; c.fillStyle = INK.fg; c.fillText(name, x + pad, base);
      if (sub) { shrink(sub, w - 2 * pad, T.sub, 16, (q) => font(400, q, SANS, 1)); c.fillStyle = INK.soft; c.fillText(sub, x + pad, base + T.sub * 1.55); } }
    if (out) arrow(x + w - pad - as, base - z * 0.36 - as / 2, as, on ? INK.fg : ink);
    zones.set(e, [x, y, x + w, y + h]);
  }
  /** A place to type in: its outline brightens while it has the keyboard. */
  function place(e, [x0, y0, x1, y1]) {
    const on = document.activeElement === e;
    rounded(x0, y0, x1 - x0, y1 - y0, 14); c.fillStyle = 'rgba(143,227,255,0.1)'; c.fill(); c.lineWidth = on ? 4 : 2.5; c.strokeStyle = on ? INK.cy : INK.line; c.stroke();
    zones.set(e, [x0, y0, x1, y1]);
  }
  function invitation() {                                       // standby: what the field says to the room from across it. Few words, large.
    const [y0, y1, kick] = L.standby, s = text.standby || {}, what = (mode === 'links' ? s.invite : Wr.invite) ?? '', [most, rows] = L.invite, x = W / 2;
    caps(s.kicker ?? '', x, y0, kick, INK.cy, 'center');
    let size = most, ls; do { font('italic 400', size, SERIF); ls = wrap(what, W - 2 * L.m); } while (ls.length > rows && (size -= 10) > 60);
    c.fillStyle = INK.fg; c.textAlign = 'center'; ls = ls.slice(0, rows); ls.forEach((l, i) => c.fillText(l, x, y1 + (i + (rows - ls.length) / 2) * size)); c.textAlign = 'left';
  }
  function header() {                                            // what this is, and whose
    const { m } = L, right = W - m, y = T.top;
    caps(text.title, m, y, T.kick, INK.cy); if (text.name) caps(text.name, right, y, T.kick, INK.soft, 'right');
    const g = c.createLinearGradient(m, 0, right, 0); g.addColorStop(0, INK.line); g.addColorStop(1, 'rgba(150,215,255,0.12)'); c.fillStyle = g; c.fillRect(m, y + 28, right - m, 2);
    return y + 30;
  }
  /** Who this is for, in the owner's own words (the profile's): set in the middle of the room there is for it. */
  function words(y0, y1) {
    const { m } = L, w = W - 2 * m, lead = [T.lede * 1.22, T.body * 1.44], gap = [T.body * 0.7, T.body], seek = (text.seeking || []).filter(Boolean);
    font(400, T.lede, SERIF); const lede = wrap(text.intro, w, T.ledeMax);
    font(600, T.kick, SANS, T.kick * 0.3); const kw = text.openTo && seek.length ? c.measureText(text.openTo.toUpperCase()).width + T.kick * 0.8 : 0;
    font(400, T.body); const one = seek.join('   ·   '), inline = c.measureText(one).width <= w - kw, sought = inline && one ? [one] : seek, over = kw && !inline ? T.kick * 1.9 : 0;
    let most = 6, more, total;                                  // the invitation gives way, a line at a time, if there is not room for it all
    do { font(400, T.body); more = most ? wrap(text.invitation, w, most) : []; total = lede.length * lead[0] + (more.length ? gap[0] + more.length * lead[1] : 0) + (sought.length ? gap[1] + over + sought.length * lead[1] : 0); } while (total > y1 - y0 && most-- > 0);
    let top = y0 + Math.max(0, (y1 - y0 - total) / 2);
    font(400, T.lede, SERIF); c.fillStyle = INK.fg; for (const l of lede) { c.fillText(l, m, top + T.lede * 0.8); top += lead[0]; }
    if (more.length) top += gap[0];
    font(400, T.body); c.fillStyle = INK.soft; for (const l of more) { c.fillText(l, m, top + T.body * 0.8); top += lead[1]; }
    if (!sought.length) return;
    top += gap[1];
    if (kw) { caps(text.openTo, m, top + (inline ? T.body * 0.8 : T.kick), T.kick, INK.warm); top += over; }
    font(400, T.body); c.fillStyle = INK.fg; for (const l of sought) { c.fillText(l, m + (inline ? kw : 0), top + T.body * 0.8); top += lead[1]; }
  }
  /** The ways to reach the owner, as buttons from y0 down to y1: a row (two rows of more than four), or on a phone held upright two to a row. big: each says where it leads. */
  const grid = () => { const n = links.length, cols = L === LAYOUT.land ? (n > 4 ? Math.ceil(n / 2) : n) : n > 2 ? 2 : 1; return [cols, Math.ceil(n / (cols || 1))]; };
  const tall = (h) => { const [, rows] = grid(); return rows ? rows * h + (rows - 1) * T.gap : 0; };
  function ways(y0, y1, big) {
    const { m } = L, [cols, rows] = grid(); if (!rows) return;
    const bw = (W - 2 * m - T.gap * (cols - 1)) / cols, bh = (y1 - y0 - T.gap * (rows - 1)) / rows;
    links.forEach((k, i) => button(k.el, [m + (i % cols) * (bw + T.gap), y0 + Math.floor(i / cols) * (bh + T.gap), bw, bh], k[0], { sub: big ? k.sub : '', out: true }));
  }
  /** The message: what is typed, wrapped, the lines about the caret kept in sight; before that, the invitation to write. */
  function message(r) {
    place(msg, r);
    const [x0, y0, x1, y1] = r, pad = 30, x = x0 + pad, top = y0 + pad + T.type * 0.82, lead = T.type * 1.32, on = document.activeElement === msg;
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
    if (!msg.value && !on) { font('italic 400', T.type - 4, SERIF); c.fillStyle = INK.dim; wrap(text.intro, x1 - x0 - 2 * pad, 3).forEach((l, k) => c.fillText(l, x, top + k * lead)); }
    else {
      font(400, T.type); c.fillStyle = INK.fg;
      const ls = lines(msg.value, x1 - x0 - 2 * pad), shown = Math.max(1, Math.floor((y1 - y0 - 2 * pad) / lead)), at = msg.selectionEnd ?? msg.value.length;
      let row = ls.findIndex(([l, i], k) => at >= i && (k === ls.length - 1 || at < ls[k + 1][1])); if (row < 0) row = ls.length - 1;
      const first = Math.max(0, row - shown + 1);
      ls.slice(first, first + shown).forEach(([l], k) => c.fillText(l.replace(/\n$/, ''), x, top + k * lead));
      if (on && (still || Math.floor(blink * 2) % 2 === 0)) { const [l, i] = ls[row]; c.fillStyle = INK.warm; c.fillRect(x + c.measureText(l.slice(0, at - i)).width + 2, top + (row - first) * lead - T.type * 0.86, 3, T.type * 1.1); }
    }
    c.restore();
  }
  /** One line of typed text in its place (the visitor's email). */
  function line(e, r, hint) {
    place(e, r);
    const [x0, y0, x1, y1] = r, x = x0 + 30, y = (y0 + y1) / 2 + T.type * 0.32, on = document.activeElement === e;
    if (!e.value && !on) { font('italic 400', T.type - 8, SERIF); c.fillStyle = INK.dim; c.fillText(hint, x, y); return; }
    shrink(e.value, x1 - x0 - 70, T.type, 24, (z) => font(400, z)); c.fillStyle = INK.fg; c.fillText(e.value, x, y);
    if (on && (still || Math.floor(blink * 2) % 2 === 0)) { c.fillStyle = INK.warm; c.fillRect(x + c.measureText(e.value).width + 3, y - T.type * 0.8, 3, T.type); }
  }
  const said = (x, y, w) => { font('italic 400', T.body, SERIF); c.fillStyle = state === 'failed' || state === 'email' ? INK.bad : INK.warm; wrap(status.textContent, w, 1).forEach((l) => c.fillText(l, x, y)); };
  function draw() {
    const { m } = L, right = W - m, upright = L === LAYOUT.port, bottom = H - m, row = T.row;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; zones.clear();      // black, not clear: a clear canvas would upload the soft edges of its strokes at full strength
    if (!expanded) return invitation();
    const y = header();
    if (mode === 'links') { const top = bottom - tall(T.links[0]); words(y + 24, top - 34); return ways(top, bottom, true); }
    // a message: its box, then what sends it and what is said of how it went, and the other ways at the foot
    const foot = bottom - tall(T.links[1]), saidY = foot - T.body * 0.95;
    caps(Wr.message, m, y + 46, T.kick, INK.soft);
    if (mode === 'mail') {                                       // the button and the address side by side; upright, one under the other with what is said between them
      const a0 = upright ? foot - T.gap - row - 10 : saidY - T.body * 1.1 - row, b0 = upright ? a0 - T.body * 1.7 - row : a0, chip = upright ? 210 : 170, ax = upright ? m : m + 728;
      message([m, y + 64, right, b0 - T.gap * 1.4]);
      button(act, upright ? [m, b0, right - m, row] : [m, b0, 700, row], Wr.mail, { strong: true, small: true });
      const z = shrink(text.address, right - chip - T.gap - ax, T.type - 4, 22, (q) => font(400, q)); c.fillStyle = INK.fg; c.fillText(text.address, ax, a0 + row / 2 + z * 0.34);
      button(copy, [right - chip, a0 + (upright ? 0 : 10), chip, row - (upright ? 0 : 20)], copied ? Wr.copied : Wr.copy, { small: true });
      said(m, upright ? b0 + row + T.body * 1.15 : saidY, right - m);
    } else {                                                     // the visitor's email beside SEND; upright, over it
      const s0 = upright ? saidY - T.body * 1.2 - row : saidY - T.body * 1.1 - row, e0 = upright ? s0 - T.gap - row : s0, label = e0 - 18;
      message([m, y + 64, right, label - T.kick * 1.9]);
      caps(Wr.email, m, label, T.kick, INK.soft); const lw = c.measureText(Wr.email.toUpperCase()).width; font(400, T.kick + 4, SANS, 1); c.fillStyle = INK.dim; c.fillText(Wr.emailFor, m + lw + T.kick * 0.6, label);
      line(sig, upright ? [m, e0, right, e0 + row] : [m, e0, right - 330, e0 + row], Wr.emailHint);
      button(act, upright ? [m, s0, right - m, row] : [right - 300, s0, 300, row], Wr.send, { strong: ready(), small: true });
      said(m, saidY, right - m);
    }
    ways(foot, bottom, false);
  }

  // ---- sending: once it has gone, the words fold into a mote of light that leaves through the window
  const mote = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8, 6), ...GLOW }));
  const trail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.8, 0.55), ...GLOW }));
  mote.visible = trail.visible = false; mote.renderOrder = trail.renderOrder = 7; scene.add(mote, trail);
  const curve = () => {                                          // from in front of the field (it hides what is behind it), up over its edge, out
    const a = panel.getWorldPosition(V()).addScaledVector(facing, 0.12), over = a.clone().setY(a.y + L.size[1] / 2 + 0.45), mid = a.clone().lerp(win, 0.5); mid.y += 1.6;
    return new THREE.CatmullRomCurve3([a, over, mid, win.clone(), win.clone().addScaledVector(out, 40)]);
  };
  async function send() {
    if (state === 'sending') return;
    if (!msg.value.trim()) return msg.focus({ preventScroll: true });
    if (!sig.value.trim() || !sig.checkValidity()) { say('email'); return sig.focus({ preventScroll: true }); }      // the answer needs somewhere to go
    say('sending');
    const body = { message: msg.value.trim(), email: sig.value.trim(), from: location.href, at: new Date().toISOString() };
    let ok = false;
    try { ok = (await fetch(text.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).ok; } catch { /* nobody answered: it did not send */ }
    if (ok) { msg.value = ''; if (!still) sending = { t0: uTime.value, path: curve() }; }      // reduced motion: no flight across the room
    say(ok ? 'sent' : 'failed');
  }
  /** Each element over its drawing, as the camera sees the field now. */
  const _a = V(), _b = V(), at = (v, x, y) => v.set((x / W - 0.5) * L.size[0], (0.5 - y / H) * L.size[1], 0).applyMatrix4(hit.matrixWorld).project(cam);
  function lay() {
    const live = expanded && !!cam && open.x > 0.9, events = live ? '' : 'none'; if (dom.style.pointerEvents !== events) dom.style.pointerEvents = events;
    if (!expanded || !cam) return;
    cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    for (const [e, [x0, y0, x1, y1]] of zones) {
      at(_a, x0, y0); at(_b, x1, y1);
      const x = (Math.min(_a.x, _b.x) + 1) / 2 * innerWidth, y = (1 - Math.max(_a.y, _b.y)) / 2 * innerHeight, w = Math.abs(_b.x - _a.x) / 2 * innerWidth, h = Math.abs(_b.y - _a.y) / 2 * innerHeight;
      const key = [x, y, w, h].map(Math.round).join(); if (e.dataset.at === key) continue;
      e.dataset.at = key; e.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; e.style.width = `${w.toFixed(1)}px`; e.style.height = `${h.toFixed(1)}px`;
    }
  }

  layout(); draw(); tex.needsUpdate = true;
  return {
    root, hit, drone, mode,
    /** The field's size in metres, and whether the drone stands beside it (main.js frames both). */
    frame: () => ({ size: L.size, beside: L === LAYOUT.land }),
    /** Opened by inspecting it (main.js), for the eye that looks at it; closing hands the keyboard back to where it was. */
    setExpanded(on, camera) {
      const held = dom.contains(document.activeElement);
      expanded = on; cam = camera ?? cam; dom.inert = !on; hover = null; redraw();
      if (!on) { if (held) { if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true }); else document.activeElement?.blur?.(); } return; }
      opener = document.activeElement;
      const first = msg ?? (keys ? pressed[0] : null);           // a message: the box takes the keyboard; else the first link, for a visitor who came by keyboard
      if (first && (keys || matchMedia('(pointer: fine)').matches)) setTimeout(() => expanded && first.focus({ preventScroll: true }), 900);   // phones: wait for a tap, or the keyboard pops up mid-glide
    },
    /** A click on the field's own surface, at texture coordinate uv: a place for text takes the keyboard. (What can be pressed takes its own clicks.) */
    click(uv) {
      if (!expanded || open.x < 0.9) return;
      const x = uv.x * W, y = (1 - uv.y) * H, e = [...zones].find(([, r]) => inside(r, x, y))?.[0];
      if (fields.includes(e)) e.focus({ preventScroll: true }); else e?.click();
    },
    /** What the pointer would do here: 'text' over the writing. */
    cursor(uv) { const x = uv.x * W, y = (1 - uv.y) * H, e = [...zones].find(([, r]) => inside(r, x, y))?.[0]; return !e ? '' : fields.includes(e) ? 'text' : 'pointer'; },
    typing: () => fields.includes(document.activeElement),
    /** The room's own light for the drone's metal (room.js: the Cycles probes). */
    setEnv(env) { for (const m of [body.material, band.material]) { m.envMap = env; m.needsUpdate = true; } },
    update(t, dt) {
      if (layout()) redraw();
      open.to = expanded ? 1 : STANDBY; U.uOpen.value = open.step();
      const near = THREE.MathUtils.clamp((open.x - STANDBY) / (1 - STANDBY), 0, 1);      // 0 in standby, 1 with the visitor at it
      // in standby the field has a slow life of its own, to be noticed; with someone at it, it holds still to be read
      if (!still) life += dt * (1 - near); U.uLife.value = life;
      U.uGain.value = 2.8 + (1 - near) * (0.3 + (still ? 0 : 0.25 * Math.sin(life * 1.1)));
      const k = 1 + REACH * (1 - near);                          // settles to its working size as you come up
      for (const m of [dark, panel, hit, glow]) { m.scale.setScalar(k); m.position.y = L.lift * k; } hit.updateMatrixWorld();
      seed.scale.setScalar(1 - 0.5 * open.x); seed.rotation.z = t * 0.4;
      if (this.typing() && !still) { const b = Math.floor((blink += dt) * 2); if (b !== Math.floor((blink - dt) * 2)) redraw(); }
      lay();
      // drone: hovers, turns a little toward whoever is at the field, dips while a message is on its way
      drone.position.x = L.drone[0] * k; drone.position.y = L.drone[1] * k + Math.sin(t * 1.3) * 0.025 - (state === 'sending' ? 0.04 : 0);
      drone.rotation.y = -0.45 + Math.sin(t * 0.37) * 0.12; drone.rotation.z = Math.sin(t * 0.9) * 0.04;
      auraMat.uniforms.uCol.value.lerp(new THREE.Color(MOOD[mood] ?? MOOD.idle), 0.06); auraMat.uniforms.uK.value = mood === 'sending' ? 1.2 : 0.55;
      if (sending) {
        const f = Math.min(1, (uTime.value - sending.t0) / 2.6), e = f * f * (3 - 2 * f), p = sending.path.getPointAt(e);
        mote.position.copy(p); trail.position.copy(sending.path.getPointAt(Math.max(0, e - 0.02)));
        mote.visible = trail.visible = true; mote.scale.setScalar(1 + 2 * Math.sin(Math.PI * Math.min(1, f * 1.2))); trail.scale.setScalar(1 - 0.8 * f);
        if (f >= 1) { mote.visible = trail.visible = false; sending = null; }
      }
    },
    dispose() { dom.remove(); tex?.dispose(); document.removeEventListener('selectionchange', onSelect); removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onPointer, true); },
  };
}
