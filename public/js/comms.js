// The signal room's terminal, after the Culture: no keyboard and no screen, a field of light that unfolds in the air
// above the plinth when you come up to it, with a small drone in attendance whose aura shows its mood. You write on
// the field; the station's Mind sends it. Socials are glyphs on the same field.
// What it says and where a message goes come from content.json ("comms"). Without a send endpoint the message is
// handed to the visitor's own mail program (mailto); with no address either, it is copied for them to carry. The Mind says which.
import * as THREE from 'three';
import { GLOW, V, uTime, spring } from './kit.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
const INK = { fg: '#eef8ff', soft: 'rgba(214,236,255,0.62)', dim: 'rgba(190,220,245,0.34)', line: 'rgba(170,220,255,0.22)', warm: '#ffe2b8' };
// the drone's aura, by mood (Culture drones wear their mood in colour; this palette is the station's own)
const MOOD = { idle: '#8fd6ff', composing: '#ffd59a', sending: '#ffffff', sent: '#a6ffcf', handed: '#a6ffcf', copied: '#a6ffcf', empty: '#ffb4a0', failed: '#ff9c9c' };
// Two layouts of the field: landscape, and portrait for phones held upright. Canvas pixels; size in metres;
// regions [x0, y0, x1, y1]; lift raises a tall field clear of the plinth; drone: where it hovers beside (or above) it.
// standby: the y of the three lines of the invitation shown while nobody is at the field (inside the half-open band).
const LAYOUT = {
  land: { W: 1600, H: 1000, size: [1.92, 1.2], lift: 0, drone: [1.3, 0.26], standby: [360, 565, 680], invite: 176, m: 70, rule: 118, MSG: [70, 168, 1530, 612], SIG: [70, 676, 1530, 742], sigX: 220,
          social: [140, 170, 846, 46], SEND: [1250, 812, 1530, 892], mind: 968, size1: 44, lead: 58 },
  port: { W: 1000, H: 1400, size: [1.15, 1.61], lift: 0.3, drone: [0.37, 1.13], standby: [540, 730, 870], invite: 132, m: 60, rule: 158, MSG: [60, 206, 940, 830], toY: 140, SIG: [60, 900, 940, 1010], sigX: 0,
          social: [130, 170, 1130, 50], SEND: [60, 1230, 940, 1300], mind: 1360, size1: 48, lead: 62 },
};
const STANDBY = 0.62, REACH = 0.45;                             // with nobody at it the field stays open as a band, and larger, to be seen from the door
const inside = ([x0, y0, x1, y1], x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function field(tex) {
  return new THREE.ShaderMaterial({
    // light added over a faint veil (alpha dims what is behind); the scene's alpha channel is left alone
    ...GLOW, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, uniforms: { tMap: { value: tex }, uOpen: { value: 0 }, uTime, uGain: { value: 1.6 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D tMap; uniform float uOpen, uTime, uGain; varying vec2 vUv; varying vec3 vW;
      vec3 hue(float h){ return clamp(abs(fract(h + vec3(0.0, 0.333, 0.667))*6.0 - 3.0) - 1.0, 0.0, 1.0); }
      void main(){
        // unfolds from a horizontal line, wider than tall first
        float ox = smoothstep(0.0, 0.45, uOpen), oy = smoothstep(0.25, 1.0, uOpen);
        vec2 q = abs(vUv - 0.5)*2.0;
        float m = (1.0 - smoothstep(ox - 0.02, ox, q.x))*(1.0 - smoothstep(oy*1.0 - 0.015, oy*1.0 + 0.002, q.y));
        if (m <= 0.0) discard;
        // a field, not a screen: a faint body, slow interference, an iridescent edge
        float e = max(q.x, q.y), edge = smoothstep(0.975, 0.997, e)*(1.0 - smoothstep(0.997, 1.0, e)) + exp(-pow((oy - q.y)*30.0, 2.0))*(1.0 - oy)*2.0;
        float ripple = 0.5 + 0.5*sin(vW.x*9.0 + vW.y*6.0 + uTime*0.7)*sin(vW.y*13.0 - uTime*0.45);
        vec3 tint = mix(vec3(0.55, 0.85, 1.0), hue(0.52 + 0.08*sin(uTime*0.2 + vUv.x*3.0 + vUv.y*2.0)), 0.35);
        vec3 c = tint*(0.014 + 0.01*ripple) + tint*edge*0.22;
        vec3 ui = texture2D(tMap, vUv).rgb; ui = ui*ui;               // the canvas is drawn in sRGB: light, in linear
        float k = m*smoothstep(0.0, 0.15, uOpen);
        gl_FragColor = vec4((c + ui*uGain)*k, 0.55*k);                  // what is behind dims a little: the words stay legible
      }`,
  });
}

/**
 * @param center  world position of the field's middle;  facing: horizontal direction it faces (into the room)
 * @param window  a world point in the window, where a sent message leaves the room;  out: the way it goes on
 */
export function createComms({ scene, center, facing, text, window: win, out }) {
  const root = new THREE.Group(); root.position.copy(center); root.lookAt(center.clone().add(facing)); scene.add(root);
  const cv = document.createElement('canvas'), c = cv.getContext('2d');
  let tex = null, L = null, W = 0, H = 0;
  const mat = field(null), panel = new THREE.Mesh(new THREE.PlaneGeometry(), mat); panel.renderOrder = 6; root.add(panel);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ visible: false })); root.add(hit);
  function layout() {                                            // (re)build for the screen's orientation
    const next = LAYOUT[innerWidth < innerHeight * 0.9 ? 'port' : 'land']; if (next === L) return false;
    L = next; W = cv.width = L.W; H = cv.height = L.H;
    tex?.dispose(); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 8; mat.uniforms.tMap.value = tex;
    for (const m of [panel, hit]) { m.geometry.dispose(); m.geometry = new THREE.PlaneGeometry(...L.size); m.position.y = L.lift; m.updateMatrixWorld(); }
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
  let mood = 'idle';
  const setMood = (m) => { mood = m; };

  // ---- the message: two real text fields, kept out of sight, so typing (and phone keyboards) work as usual
  const css = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;resize:none;';
  const msg = Object.assign(document.createElement('textarea'), { maxLength: text.max || 2000, spellcheck: true }), sig = Object.assign(document.createElement('input'), { type: 'email', autocomplete: 'email' });
  msg.style.cssText = sig.style.cssText = css; msg.setAttribute('aria-label', text.write); sig.setAttribute('aria-label', text.reply);
  document.body.append(msg, sig);
  let state = 'idle', blink = 0, sending = null;
  const redraw = () => { draw(); tex.needsUpdate = true; };
  const typed = () => { if (state !== 'sending') state = msg.value.trim() ? 'composing' : 'idle'; setMood(state); redraw(); };
  msg.addEventListener('input', typed); sig.addEventListener('input', typed);
  for (const f of [msg, sig]) {
    f.addEventListener('focus', redraw); f.addEventListener('blur', redraw);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } else if (e.key === 'Enter' && f === sig) { e.preventDefault(); msg.focus(); } });
  }
  document.addEventListener('selectionchange', () => { if (document.activeElement === msg) redraw(); });

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
  function glyph(x, y, r, label, i) {                            // a social: a ring with its initial, the name under it
    c.strokeStyle = INK.soft; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = INK.line; c.beginPath(); c.arc(x, y, r - 9, -0.6 + i, 1.6 + i); c.stroke();
    font(300, 34); c.fillStyle = INK.fg; c.textAlign = 'center'; c.fillText(label[0], x, y + 12);
    font(500, 21, SANS, 4); c.fillStyle = INK.soft; c.fillText(label, x, y + r + 36); c.textAlign = 'left';
  }
  function invitation() {                                       // standby: what the field says to the room from across it
    const [y0, y1, y2] = L.standby, s = text.standby || {}, x = W / 2; c.textAlign = 'center';
    font(500, 34, SANS, 12); c.fillStyle = INK.soft; c.fillText(s.kicker ?? '', x, y0);
    font('italic 400', L.invite, SERIF); c.fillStyle = INK.fg; c.fillText(s.invite ?? '', x, y1);
    font(600, 36, SANS, 10); c.fillStyle = INK.warm; c.fillText((matchMedia('(pointer: fine)').matches ? s.click : s.tap) ?? '', x, y2);
    c.textAlign = 'left';
  }
  function draw() {
    const { m, MSG, SIG, SEND } = L, right = W - m;
    c.clearRect(0, 0, W, H); c.textBaseline = 'alphabetic';
    if (!expanded) return invitation();
    font(500, 27, SANS, 7); c.fillStyle = INK.soft; c.fillText(text.title, m, 92);
    c.textAlign = 'right'; c.fillText(`${text.toLabel}  ${text.to}`, right, L.toY || 92); c.textAlign = 'left';       // portrait: on a line of its own
    const g = c.createLinearGradient(m, 0, right, 0); g.addColorStop(0, INK.line); g.addColorStop(1, 'rgba(170,220,255,0)'); c.fillStyle = g; c.fillRect(m, L.rule, right - m, 2);
    // the message
    const on = document.activeElement === msg, caret = Math.floor(blink * 2) % 2 === 0;
    font(300, L.size1); c.fillStyle = INK.fg;
    if (!msg.value && !on) { font('italic 400', L.size1 - 4, SERIF); c.fillStyle = INK.dim; lines(text.write, MSG[2] - MSG[0]).slice(0, 3).forEach(([l], k) => c.fillText(l.trim(), MSG[0], MSG[1] + 56 + k * L.lead)); }
    else {
      const ls = lines(msg.value, MSG[2] - MSG[0]), lead = L.lead, shown = Math.floor((MSG[3] - MSG[1]) / lead), at = msg.selectionEnd ?? msg.value.length;
      let row = ls.findIndex(([l, i], k) => at >= i && (k === ls.length - 1 || at < ls[k + 1][1])); if (row < 0) row = ls.length - 1;
      const first = Math.max(0, row - shown + 1);
      ls.slice(first, first + shown).forEach(([l], k) => c.fillText(l.replace(/\n$/, ''), MSG[0], MSG[1] + 56 + k * lead));
      if (on && caret) { const [l, i] = ls[row]; const x = MSG[0] + c.measureText(l.slice(0, at - i)).width; c.fillStyle = INK.warm; c.fillRect(x + 2, MSG[1] + 56 + (row - first) * lead - 40, 3, 50); }
    }
    // reply-to
    c.fillStyle = INK.line; c.fillRect(m, SIG[1] - 18, right - m, 1);
    font(500, 22, SANS, 5); c.fillStyle = INK.soft; c.fillText(text.replyLabel, SIG[0], SIG[1] + 24);
    const son = document.activeElement === sig, sx = SIG[0] + L.sigX, sy = SIG[1] + (L.sigX ? 26 : 84);      // portrait: the address under its label
    if (!sig.value && !son) { font('italic 400', 32, SERIF); c.fillStyle = INK.dim; c.fillText(text.reply, sx, sy); }
    else { font(300, 36); c.fillStyle = INK.fg; c.fillText(sig.value, sx, sy); if (son && caret) c.fillRect(sx + 2 + c.measureText(sig.value).width, sy - 30, 3, 38); }
    // socials and the send glyph
    socials().forEach((s, i) => glyph(s.x, s.y, L.social[3], s.label, i));
    const [x0, y0, x1, y1] = SEND, ready = !!msg.value.trim() && state !== 'sending';
    c.strokeStyle = ready ? INK.warm : INK.soft; c.lineWidth = ready ? 4 : 2; c.beginPath(); c.roundRect(x0, y0, x1 - x0, y1 - y0, 40); c.stroke();
    font(ready ? 600 : 500, 26, SANS, 10); c.fillStyle = ready ? INK.warm : INK.soft; c.textAlign = 'center';      // light can only add: an outline, never a fill
    c.fillText(text.send, (x0 + x1) / 2, (y0 + y1) / 2 + 9); c.textAlign = 'left';
    // the Mind
    font('italic 400', 34, SERIF); c.fillStyle = state === 'empty' || state === 'failed' ? '#ffcfbf' : INK.warm;
    lines(text.mind[state] ?? '', right - m).slice(0, 2).forEach(([l], k, all) => c.fillText(l.trim(), m, L.mind - (all.length - 1 - k) * 42));
  }
  const socials = () => (text.socials || []).map(([label, href], i) => ({ label, href, x: L.social[0] + i * L.social[1], y: L.social[2] }));

  // ---- sending: the words fold into a mote of light that leaves through the window
  const mote = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 8, 6), ...GLOW }));
  const trail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.8, 0.55), ...GLOW }));
  mote.visible = trail.visible = false; scene.add(mote, trail);
  const curve = () => {
    const a = panel.getWorldPosition(V()), far = win.clone().addScaledVector(out, 40), mid = a.clone().lerp(win, 0.5); mid.y += 1.6;
    return new THREE.CatmullRomCurve3([a, mid, win.clone(), far]);
  };
  async function send() {
    if (state === 'sending') return;
    if (!msg.value.trim()) { state = 'empty'; setMood('empty'); msg.focus(); redraw(); return; }
    state = 'sending'; setMood('sending'); redraw();
    const body = { message: msg.value.trim(), reply: sig.value.trim(), from: location.href, at: new Date().toISOString() };
    const flight = new Promise((done) => { sending = { t0: uTime.value, path: curve(), done }; });
    // Where it goes: to the station's endpoint if it has one, else into the visitor's own mail, else (no address is published)
    // onto their clipboard, to be pasted wherever they reach the owner.
    let result = text.address ? 'handed' : 'copied';
    if (result === 'copied' && !text.endpoint) { try { await navigator.clipboard.writeText(body.message + (body.reply ? `\n\n— ${body.reply}` : '')); } catch { result = 'failed'; } }      // now, while the click still counts as the visitor's
    if (text.endpoint) {
      try { result = (await fetch(text.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).ok ? 'sent' : 'failed'; }
      catch { result = 'failed'; }
    }
    await flight;
    if (result === 'handed') {
      const q = new URLSearchParams({ subject: text.subject, body: body.message + (body.reply ? `\n\n— ${body.reply}` : '') }).toString().replace(/\+/g, '%20');
      window.location.href = `mailto:${text.address}?${q}`;
    }
    if (result !== 'failed') { msg.value = ''; sig.value = ''; }
    state = result; setMood(result); redraw();
  }

  layout(); draw(); tex.needsUpdate = true;
  return {
    root, hit, drone,
    /** The field's size in metres, and whether the drone stands beside it (main.js frames both). */
    frame: () => ({ size: L.size, beside: L === LAYOUT.land }),
    /** Opened by inspecting it (main.js); closing hands the keyboard back to the page. */
    setExpanded(on) {
      expanded = on; redraw();
      if (!on) { msg.blur(); sig.blur(); }
      else if (matchMedia('(pointer: fine)').matches) setTimeout(() => expanded && msg.focus({ preventScroll: true }), 900);   // phones: wait for a tap, or the keyboard pops up mid-glide
    },
    /** A click on the field, at texture coordinate uv. */
    click(uv) {
      if (!expanded || open.x < 0.9) return;
      const x = uv.x * W, y = (1 - uv.y) * H;
      if (inside(L.SEND, x, y)) return send();
      const s = socials().find((s) => Math.hypot(s.x - x, s.y - y) < L.social[3] + 14);
      if (s) { if (s.href) window.open(s.href, '_blank', 'noopener'); return; }
      if (inside(L.SIG, x, y)) sig.focus(); else msg.focus();
    },
    /** What the pointer would do here: 'pointer' over a glyph, 'text' over the writing. */
    cursor(uv) {
      const x = uv.x * W, y = (1 - uv.y) * H;
      return inside(L.SEND, x, y) || socials().some((s) => Math.hypot(s.x - x, s.y - y) < L.social[3] + 14) ? 'pointer' : 'text';
    },
    typing: () => document.activeElement === msg || document.activeElement === sig,
    /** The room's own light for the drone's metal (room.js: the Cycles probes). */
    setEnv(env) { for (const m of [body.material, band.material]) { m.envMap = env; m.needsUpdate = true; } },
    update(t, dt) {
      if (layout()) redraw();
      open.to = expanded ? 1 : STANDBY; mat.uniforms.uOpen.value = open.step();
      mat.uniforms.uGain.value = expanded ? 1.6 : 2.6 + 0.5 * Math.sin(t * 1.6);      // standby breathes, to be noticed
      const k = 1 + REACH * (1 - THREE.MathUtils.clamp((open.x - STANDBY) / (1 - STANDBY), 0, 1));   // settles to its working size as you come up
      panel.scale.setScalar(k); hit.scale.setScalar(k); panel.position.y = hit.position.y = L.lift * k;
      seed.scale.setScalar(1 - 0.5 * open.x); seed.rotation.z = t * 0.4;
      if (this.typing()) { const b = Math.floor((blink += dt) * 2); if (b !== Math.floor((blink - dt) * 2)) redraw(); }
      // drone: hovers, turns a little toward whoever is at the field, nods while sending
      drone.position.x = L.drone[0] * k; drone.position.y = L.drone[1] * k + Math.sin(t * 1.3) * 0.025 + (state === 'sending' ? -0.05 * Math.sin(Math.min(1, (t - (sending?.t0 ?? t)) * 2) * Math.PI) : 0);
      drone.rotation.y = -0.45 + Math.sin(t * 0.37) * 0.12; drone.rotation.z = Math.sin(t * 0.9) * 0.04;
      auraMat.uniforms.uCol.value.lerp(new THREE.Color(MOOD[mood]), 0.06); auraMat.uniforms.uK.value = mood === 'sending' ? 1.2 : 0.55;
      if (sending) {
        const f = Math.min(1, (uTime.value - sending.t0) / 2.6), e = f * f * (3 - 2 * f), p = sending.path.getPointAt(e);
        mote.position.copy(p); trail.position.copy(sending.path.getPointAt(Math.max(0, e - 0.02)));
        mote.visible = trail.visible = true; mote.scale.setScalar(1 + 2 * Math.sin(Math.PI * Math.min(1, f * 1.2))); trail.scale.setScalar(1 - 0.8 * f);
        if (f >= 1) { mote.visible = trail.visible = false; sending.done(); sending = null; }
      }
    },
    dispose() { msg.remove(); sig.remove(); tex?.dispose(); },
  };
}
