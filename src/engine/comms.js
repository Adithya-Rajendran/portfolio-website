// The Contact room's field of light, its links and its drone.
import * as THREE from 'three';
import { GLOW, uTime, spring } from './kit.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
const INK = { fg: '#f4faff', soft: 'rgba(224,240,255,0.93)', line: 'rgba(150,215,255,0.62)', cy: '#9be6ff', warm: '#ffdcae',
  fill: 'rgba(143,227,255,0.15)', lit: 'rgba(143,227,255,0.3)' };
const DRONE_COL = '#8fd6ff';
const LAYOUT = {
  land: { W: 1600, H: 1000, size: [1.92, 1.2], lift: 0.14, drone: [1.3, 0.26], m: 80, standby: [392, 610, 64], invite: [200, 1],
          T: { top: 104, kick: 28, lede: 66, ledeMax: 2, body: 40, btn: 46, sub: 28, gap: 28, links: 150 } },
  port: { W: 1000, H: 1400, size: [1.15, 1.61], lift: 0.3, drone: [0.3, 1.4], m: 60, standby: [455, 690, 76], invite: [230, 2],
          T: { top: 96, kick: 32, lede: 60, ledeMax: 4, body: 42, btn: 48, sub: 30, gap: 20, links: 150 } },
};
const STANDBY = 0.62, REACH = 0.45, HALO = 0.16;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const inside = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const UNFOLD = `float ox = smoothstep(0.0, 0.45, uOpen), oy = smoothstep(0.25, 1.0, uOpen);`;
const HUE = `vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.333, 0.667))*6.0 - 3.0) - 1.0, 0.0, 1.0); }
  vec3 tint(vec2 uv, float t){ return mix(vec3(0.55, 0.85, 1.0), hue(0.52 + 0.08*sin(t*0.2 + uv.x*3.0 + uv.y*2.0)), 0.35); }`;

const PLANE = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`;
function shade(uniforms) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide, uniforms, vertexShader: PLANE,
    blending: THREE.CustomBlending, blendEquation: THREE.MinEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    fragmentShader: `uniform float uOpen; varying vec2 vUv;
      void main(){ ${UNFOLD} vec2 q = abs(vUv - 0.5)*2.0; if (q.x > ox || q.y > oy) discard; gl_FragColor = vec4(vec3(0.25), 1.0); }`,
  });
}
function field(uniforms) {
  return new THREE.ShaderMaterial({
    ...GLOW, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, uniforms, vertexShader: PLANE,
    fragmentShader: `uniform sampler2D tMap; uniform float uOpen, uLife, uGain; uniform vec2 uSize; varying vec2 vUv; ${HUE}
      void main(){
        ${UNFOLD}
        vec2 q = abs(vUv - 0.5)*2.0, d = (vec2(ox, oy) - q)*uSize*0.5;
        float e = min(d.x, d.y); if (e < 0.0) discard;
        float px = fwidth(e), rim = 1.0 - smoothstep(0.0, max(0.005, px*1.5), e), glow = exp(-e/0.035) + 0.35*exp(-e/0.16);
        float grain = 0.5 + 0.5*sin(vUv.x*uSize.x*9.0 + vUv.y*uSize.y*6.0 + uLife*0.7)*sin(vUv.y*uSize.y*13.0 - uLife*0.45);
        vec3 t = tint(vUv, uLife), c = vec3(0.004, 0.011, 0.018) + t*(0.006 + 0.005*grain + glow*0.05 + rim*0.85);
        vec3 ui = texture2D(tMap, vUv).rgb; ui = ui*ui;
        float k = smoothstep(0.0, 0.15, uOpen);
        gl_FragColor = vec4((c + ui*uGain)*k, (0.93 - 0.2*rim)*k);
      }`,
  });
}
function halo(uniforms) {
  return new THREE.ShaderMaterial({
    ...GLOW, side: THREE.DoubleSide, uniforms,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform float uOpen, uLife; uniform vec2 uSize; varying vec2 vP; ${HUE}
      void main(){
        ${UNFOLD}
        vec2 d = abs(vP) - vec2(ox, oy)*uSize*0.5; float e = length(max(d, 0.0));
        if (max(d.x, d.y) <= 0.0) discard;
        gl_FragColor = vec4(tint(vP/uSize + 0.5, uLife)*(0.16*exp(-e/0.012) + 0.05*exp(-e/0.05))*smoothstep(0.0, 0.15, uOpen), 1.0);
      }`,
  });
}

export function createComms({ scene, center, facing, text }) {
  const root = new THREE.Group(); root.position.copy(center); root.lookAt(center.clone().add(facing)); scene.add(root);
  const web = (k) => { try { return /^https?:$/.test(new URL(k[1], location.href).protocol); } catch { return false; } };
  const links = (text.links || []).filter(web).slice(0, 6).map((k) => [...k]);
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  let tex = null, L = null, T = null, W = 0, H = 0, cam = null, life = 0;
  const U = { tMap: { value: null }, uOpen: { value: 0 }, uLife: { value: 0 }, uGain: { value: 2.8 }, uSize: { value: new THREE.Vector2(1, 1) } };
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(), shade(U)); dark.renderOrder = 0.4; root.add(dark);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(), field(U)); panel.renderOrder = 0.5; root.add(panel);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(), halo(U)); glow.renderOrder = 6; root.add(glow);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ visible: false })); root.add(hit);
  function layout() {
    const next = LAYOUT[innerWidth < innerHeight * 0.9 ? 'port' : 'land']; if (next === L) return false;
    L = next; T = L.T; W = cv.width = L.W; H = cv.height = L.H; U.uSize.value.set(...L.size);
    tex?.dispose(); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; U.tMap.value = tex;
    for (const m of [dark, panel, hit, glow]) { m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(L.size[0] + (m === glow ? 2 * HALO : 0), L.size[1] + (m === glow ? 2 * HALO : 0)); }
    return true;
  }
  const open = spring(0.07); let expanded = false;

  const seed = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 3.0), ...GLOW }));
  seed.position.y = -0.56; seed.rotation.x = Math.PI / 2; root.add(seed);

  const drone = new THREE.Group(); drone.position.z = -0.18; root.add(drone);
  const shape = (w, h, d) => { const g = new THREE.SphereGeometry(1, 40, 24); g.scale(w / 2, h / 2, d / 2); return g; };
  const body = new THREE.Mesh(shape(0.34, 0.16, 0.24), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.75, roughness: 0.22 }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.006, 8, 64), new THREE.MeshStandardMaterial({ color: 0x20262c, metalness: 0.5, roughness: 0.4 }));
  band.rotation.x = Math.PI / 2; band.scale.set(1.0, 0.7, 1.0);
  const auraMat = new THREE.ShaderMaterial({ ...GLOW, side: THREE.BackSide, uniforms: { uCol: { value: new THREE.Color(DRONE_COL) }, uK: { value: 0.55 }, uTime },
    vertexShader: `varying vec3 vN, vV; void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK, uTime; varying vec3 vN, vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uCol*uCol*f*uK*(0.9 + 0.1*sin(uTime*2.3)), 1.0); }` });
  const aura = new THREE.Mesh(shape(0.5, 0.3, 0.4), auraMat);
  drone.add(body, band, aura);

  const dom = Object.assign(document.createElement('section'), { id: 'comms', inert: true }); dom.setAttribute('aria-label', text.title); dom.dataset.mode = 'links';
  dom.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:1;pointer-events:none;';
  const OVER = 'position:absolute;left:0;top:0;width:1px;height:1px;margin:0;padding:0;border:0;border-radius:0;background:none;color:transparent;opacity:0;overflow:hidden;font:16px sans-serif;outline:0;-webkit-tap-highlight-color:transparent;cursor:pointer;';
  const el = (tag, props, attrs = {}) => { const e = Object.assign(document.createElement(tag), props); for (const k in attrs) e.setAttribute(k, attrs[k]);
    e.style.cssText = OVER; dom.append(e); return e; };
  for (const [i, k] of links.entries()) {
    const u = new URL(k[1], location.href);
    const host = u.origin === location.origin ? (u.pathname.match(/\.(\w+)$/)?.[1] ?? '').toUpperCase() : u.hostname.replace(/^www\./, '');
    k.strong = i === 0;
    k.sub = i === 0 && text.writeNote ? `${text.writeNote} · ${host}` : host;
    const attrs = {
      ...(text.opens ? { 'aria-label': `${k[0]}, ${text.opens}` } : {}),
      ...(i === 0 && text.writeNote ? { 'aria-description': text.writeNote } : {}),
    };
    k.el = el('a', { href: u.href, target: '_blank', rel: 'noopener', textContent: k[0] }, attrs);
  }
  document.body.append(dom);
  const pressed = links.map((k) => k.el), zones = new Map();
  let hover = null, keys = false, opener = null;
  const redraw = () => { draw(); tex.needsUpdate = true; };
  for (const p of pressed) {
    p.addEventListener('focus', redraw); p.addEventListener('blur', redraw);
    p.addEventListener('pointerenter', () => { hover = p; redraw(); }); p.addEventListener('pointerleave', () => { if (hover === p) { hover = null; redraw(); } });
  }
  const onKey = () => { keys = true; }, onPointer = () => { keys = false; };
  addEventListener('keydown', onKey, true); addEventListener('pointerdown', onPointer, true);

  function font(weight, size, family = SANS, spacing = 0) { c.font = `${weight} ${size}px ${family}`; if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`; }
  function lines(str, width) {
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
  const caps = (str, x, y, size, ink, align = 'left') => {
    font(600, size, SANS, size * 0.3); c.fillStyle = ink; c.textAlign = align; c.fillText(str.toUpperCase(), x + (align === 'left' ? 0 : size * (align === 'center' ? 0.15 : 0.3)), y); c.textAlign = 'left'; };
  const shrink = (str, width, size, least, set) => { for (set(size); c.measureText(str).width > width && size > least; set(size -= 2)); return size; };
  const rounded = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  const focused = (e) => document.activeElement === e && e.matches(':focus-visible');
  function arrow(x, y, s, ink) {
    c.strokeStyle = ink; c.lineWidth = Math.max(3, s * 0.15); c.lineCap = c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x, y + s); c.lineTo(x + s, y); c.moveTo(x + s * 0.28, y); c.lineTo(x + s, y); c.lineTo(x + s, y + s * 0.72); c.stroke(); c.lineCap = 'butt'; c.lineJoin = 'miter';
  }
  function button(e, [x, y, w, h], name, { sub = '', out = false, strong = false } = {}) {
    const on = hover === e, ink = strong ? INK.warm : INK.cy, pad = Math.min(36, w * 0.09), s = T.btn, as = s * 0.46, room = w - 2 * pad - (out ? as + 18 : 0), mid = y + h / 2;
    rounded(x, y, w, h, 16); c.fillStyle = on ? INK.lit : INK.fill; c.fill(); c.lineWidth = on || strong ? 4 : 2.5; c.strokeStyle = on || strong ? ink : INK.line; c.stroke();
    if (focused(e)) { rounded(x - 10, y - 10, w + 20, h + 20, 24); c.lineWidth = 5; c.strokeStyle = INK.warm; c.stroke(); }
    const z = shrink(name, room, s, 24, (q) => font(500, q)), base = sub ? mid + z * 0.04 : mid + z * 0.35;
    c.fillStyle = INK.fg; c.fillText(name, x + pad, base);
    if (sub) { shrink(sub, w - 2 * pad, T.sub, 16, (q) => font(400, q, SANS, 1)); c.fillStyle = INK.soft; c.fillText(sub, x + pad, base + T.sub * 1.55); }
    if (out) arrow(x + w - pad - as, base - z * 0.36 - as / 2, as, on ? INK.fg : ink);
    zones.set(e, [x, y, x + w, y + h]);
  }
  function invitation() {
    const [y0, y1, kick] = L.standby, s = text.standby || {}, what = s.invite ?? '', [most, rows] = L.invite, x = W / 2;
    caps(s.kicker ?? '', x, y0, kick, INK.cy, 'center');
    let size = most, ls; do { font('italic 400', size, SERIF); ls = wrap(what, W - 2 * L.m); } while (ls.length > rows && (size -= 10) > 60);
    c.fillStyle = INK.fg; c.textAlign = 'center'; ls = ls.slice(0, rows); ls.forEach((l, i) => c.fillText(l, x, y1 + (i + (rows - ls.length) / 2) * size)); c.textAlign = 'left';
  }
  function header() {
    const { m } = L, right = W - m, y = T.top;
    caps(text.title, m, y, T.kick, INK.cy); if (text.name) caps(text.name, right, y, T.kick, INK.soft, 'right');
    const g = c.createLinearGradient(m, 0, right, 0); g.addColorStop(0, INK.line); g.addColorStop(1, 'rgba(150,215,255,0.12)'); c.fillStyle = g; c.fillRect(m, y + 28, right - m, 2);
    return y + 30;
  }
  function words(y0, y1) {
    const { m } = L, w = W - 2 * m, lead = [T.lede * 1.22, T.body * 1.44], gap = [T.body * 0.7, T.body], seek = (text.seeking || []).filter(Boolean);
    font(400, T.lede, SERIF); const lede = wrap(text.intro, w, T.ledeMax);
    font(600, T.kick, SANS, T.kick * 0.3); const kw = text.openTo && seek.length ? c.measureText(text.openTo.toUpperCase()).width + T.kick * 0.8 : 0;
    font(400, T.body); const one = seek.join('   ·   '), inline = c.measureText(one).width <= w - kw, sought = inline && one ? [one] : seek, over = kw && !inline ? T.kick * 1.9 : 0;
    let most = 6, more, total;
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
  const grid = () => { const n = links.length, cols = L === LAYOUT.land ? (n > 4 ? Math.ceil(n / 2) : n) : n > 2 ? 2 : 1; return [cols, Math.ceil(n / (cols || 1))]; };
  const tall = (h) => { const [, rows] = grid(); return rows ? rows * h + (rows - 1) * T.gap : 0; };
  function ways(y0, y1) {
    const { m } = L, [cols, rows] = grid(); if (!rows) return;
    if (links.length === 3 && L === LAYOUT.port) {
      const bh = (y1 - y0 - T.gap) / 2, bw = (W - 2 * m - T.gap) / 2;
      button(links[0].el, [m, y0, W - 2 * m, bh], links[0][0], { sub: links[0].sub, out: true, strong: links[0].strong });
      button(links[1].el, [m, y0 + bh + T.gap, bw, bh], links[1][0], { sub: links[1].sub, out: true, strong: links[1].strong });
      button(links[2].el, [m + bw + T.gap, y0 + bh + T.gap, bw, bh], links[2][0], { sub: links[2].sub, out: true, strong: links[2].strong });
      return;
    }
    const bw = (W - 2 * m - T.gap * (cols - 1)) / cols, bh = (y1 - y0 - T.gap * (rows - 1)) / rows;
    links.forEach((k, i) => button(k.el, [m + (i % cols) * (bw + T.gap), y0 + Math.floor(i / cols) * (bh + T.gap), bw, bh], k[0], { sub: k.sub, out: true, strong: k.strong }));
  }
  function draw() {
    const { m } = L, bottom = H - m;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; zones.clear();
    if (!expanded) return invitation();
    const y = header(), top = bottom - tall(T.links);
    words(y + 24, top - 34);
    ways(top, bottom);
  }

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), at = (v, x, y) => v.set((x / W - 0.5) * L.size[0], (0.5 - y / H) * L.size[1], 0).applyMatrix4(hit.matrixWorld).project(cam);
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
    root, hit, drone, mode: 'links',
    frame: () => ({ size: L.size, beside: L === LAYOUT.land }),
    setExpanded(on, camera) {
      const held = dom.contains(document.activeElement);
      expanded = on; cam = camera ?? cam; dom.inert = !on; hover = null; redraw();
      if (!on) { if (held) { if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true }); else document.activeElement?.blur?.(); } return; }
      opener = document.activeElement;
      const first = keys ? pressed[0] : null;
      if (first && (keys || matchMedia('(pointer: fine)').matches)) setTimeout(() => expanded && first.focus({ preventScroll: true }), 900);
    },
    click(uv) {
      if (!expanded || open.x < 0.9) return;
      const x = uv.x * W, y = (1 - uv.y) * H, e = [...zones].find(([, r]) => inside(r, x, y))?.[0];
      e?.click();
    },
    cursor(uv) { const x = uv.x * W, y = (1 - uv.y) * H, e = [...zones].find(([, r]) => inside(r, x, y))?.[0]; return e ? 'pointer' : ''; },
    typing: () => false,
    expanded: () => expanded,
    links: () => links.map((k) => ({ label: k[0], note: k.sub ?? '', url: k[1] })),
    linkRect(i) { const r = links[i] && zones.get(links[i].el); if (!r || !expanded || !cam) return null; at(_a, r[0], r[1]); at(_b, r[2], r[3]); return [(Math.min(_a.x, _b.x) + 1) / 2, (1 - Math.max(_a.y, _b.y)) / 2, Math.abs(_b.x - _a.x) / 2, Math.abs(_b.y - _a.y) / 2]; },
    setEnv(env) { for (const m of [body.material, band.material]) { m.envMap = env; m.needsUpdate = true; } },
    update(t, dt) {
      if (layout()) redraw();
      open.to = expanded ? 1 : STANDBY; U.uOpen.value = open.step();
      const near = THREE.MathUtils.clamp((open.x - STANDBY) / (1 - STANDBY), 0, 1);
      if (!still) life += dt * (1 - near); U.uLife.value = life;
      U.uGain.value = 2.8 + (1 - near) * (0.3 + (still ? 0 : 0.25 * Math.sin(life * 1.1)));
      const k = 1 + REACH * (1 - near);
      for (const m of [dark, panel, hit, glow]) { m.scale.setScalar(k); m.position.y = L.lift * k; } hit.updateMatrixWorld();
      seed.scale.setScalar(1 - 0.5 * open.x); seed.rotation.z = t * 0.4;
      lay();
      drone.position.x = L.drone[0] * k; drone.position.y = L.drone[1] * k + Math.sin(t * 1.3) * 0.025;
      drone.rotation.y = -0.45 + Math.sin(t * 0.37) * 0.12; drone.rotation.z = Math.sin(t * 0.9) * 0.04;
    },
    dispose() { dom.remove(); tex?.dispose(); removeEventListener('keydown', onKey, true); removeEventListener('pointerdown', onPointer, true); },
  };
}
