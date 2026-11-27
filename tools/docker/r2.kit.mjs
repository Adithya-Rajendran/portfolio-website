// Shared helpers for the second round of browser checks, on top of rooms.kit.mjs
import { sleep } from './rooms.kit.mjs';
export { sleep };

export const WAYS = () => {
  const NAMES = ['ReadGlyph', 'ReadFrame', 'ReadBeam', 'ReadAnchor', 'ScanSheet', 'ScanFan', 'ScanBody', 'ReadFlow', 'ReadPrint'];
  const fresh = () => { const t = performance.now(); return { n: 0, last: t, gap: 0, states: [], max: {}, byState: {}, word: 0, live: false, dark: 0, astray: 0 }; };
  const W = window.__w = { rec: fresh(), mark() { const r = W.rec; r.gap = Math.max(r.gap, performance.now() - r.last); W.rec = fresh(); return r; } };
  const shown = (o) => { for (let e = o; e; e = e.parent) if (!e.visible) return false; return true; };
  setInterval(() => {
    const l = window.__lobby; if (!l?.scene) return;
    const r = W.rec, st = l.reader.state(), c = {}, now = performance.now(); let glyph = null, dark = 0; r.n++; r.gap = Math.max(r.gap, now - r.last); r.last = now;
    if (r.states[r.states.length - 1] !== st) r.states.push(st);
    l.scene.traverse((o) => {
      if (NAMES.includes(o.name)) { if (o.name === 'ReadGlyph') glyph = o; if (shown(o)) c[o.name] = (c[o.name] || 0) + 1; }
      else if (o.isSprite && o.userData.pane && o.material.opacity < 0.01) dark++;
    });
    const by = (r.byState[st] ??= {});
    for (const k of NAMES) { const n = c[k] || 0; r.max[k] = Math.max(r.max[k] || 0, n); by[k] = Math.max(by[k] || 0, n); }
    if (glyph) r.word = Math.max(r.word, glyph.material.uniforms.uWord.value);
    r.dark = Math.max(r.dark, dark);
    if (l.picks.find((q) => q.reads)?.live()) r.live = true;
    const host = document.querySelector('#reader');
    if (host && !host.hidden) { const q = host.getBoundingClientRect(); r.astray = Math.max(r.astray, -q.left, -q.top, q.right - innerWidth, q.bottom - innerHeight); }
  }, 25);
};
export const MAX_GAP = 250;
export const sampled = (S, item, rec, what) => {
  const ok = rec.n >= 1 && rec.gap <= MAX_GAP;
  S.chk(item, ok, 'SET-UP, not the page: the recorder sampled ' + what + ' too thinly to trust its "never" checks (' + rec.n + ' samples, largest gap ' + Math.round(rec.gap) + ' ms, at most ' + MAX_GAP + ' ms is trusted): the machine was too loaded; run it again alone', { n: rec.n, gap: Math.round(rec.gap) });
  if (ok) S.note('recorder: ' + what + ': ' + rec.n + ' samples, largest gap ' + Math.round(rec.gap) + ' ms');
  return ok;
};
export const look = (p) => p.evaluate(() => {
  const l = window.__lobby, c = {}, shown = (o) => { for (let e = o; e; e = e.parent) if (!e.visible) return false; return true; };
  l.scene.traverse((o) => { if (/^(Read|Scan)/.test(o.name) && shown(o)) c[o.name] = (c[o.name] || 0) + 1; });
  const q = l.picks.find((x) => x.reads);
  return { state: l.reader.state(), ...c, live: !!q?.live(), glyph: !!q && q.mesh.parent.visible };
});
export const GATE = () => {
  const raf = window.requestAnimationFrame.bind(window), g = window.__gate = { open: true, n: 0, stamp: -1 };
  window.requestAnimationFrame = (cb) => { const go = (t) => { if (g.open || g.stamp === t) return cb(t); if (g.n > 0) { g.n--; g.stamp = t; return cb(t); } raf(go); }; return raf(go); };
};
export const gate = {
  shut: (p) => p.evaluate(() => { window.__gate.open = false; window.__gate.n = 0; }),
  open: (p) => p.evaluate(() => { window.__gate.open = true; }),
  step: async (p, n) => { await p.evaluate((n) => { window.__gate.n = n; }, n); await p.waitForFunction(() => window.__gate.n <= 0, null, { timeout: 120000, polling: 40 }); await sleep(250); },
};
export const CLOCK = () => {
  const raf = window.requestAnimationFrame.bind(window), c = window.__clock = { frames: 0, sim: 0, last: null };
  window.requestAnimationFrame = (cb) => raf((t) => { if (t !== c.last) { if (c.last !== null) c.sim += Math.min(t - c.last, 50); c.last = t; c.frames++; } return cb(t); });
};
export async function settle(p, seconds = 2.5, timeout = 120000) {
  const from = await p.evaluate(() => window.__clock.sim);
  return p.waitForFunction((end) => window.__clock.sim >= end, from + seconds * 1000, { timeout, polling: 100 }).then(() => true, () => false);
}
export async function camStill(p, timeout = 90000) {
  const eye = () => p.evaluate(() => [...window.__lobby.camera.position.toArray(), window.__lobby.display.state().gliding]);
  let a = await eye(), calm = 0; const end = Date.now() + timeout;
  while (Date.now() < end) {
    await sleep(300); const b = await eye();
    calm = !b[3] && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.05 ? calm + 1 : 0; a = b;
    if (calm >= 4) return true;
  }
  return false;
}
export const pickPoint = (p, i) => p.evaluate(async (i) => {
  const THREE = window.__modules.THREE, l = window.__lobby, m = l.picks[i].mesh, ray = new THREE.Raycaster(); l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  m.geometry.computeBoundingSphere(); const v = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(l.camera), x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
  const live = l.picks.filter((q) => !q.live || q.live()); ray.setFromCamera(new THREE.Vector2(v.x, v.y), l.camera);
  const hit = ray.intersectObjects(live.map((q) => q.mesh), false)[0];
  return { x, y, inside: x > 4 && x < innerWidth - 4 && y > 4 && y < innerHeight - 4 && v.z < 1, reaches: hit?.object === m, top: document.elementFromPoint(x, y)?.id ?? null };
}, i);
export const canvasPoint = (p, fx, fy) => p.evaluate(([fx, fy]) => {
  let best = null;
  for (let gy = 0.05; gy < 1; gy += 0.05) for (let gx = 0.05; gx < 1; gx += 0.05) {
    const x = gx * innerWidth, y = gy * innerHeight; if (document.elementFromPoint(x, y)?.id !== 'scene') continue;
    const d = Math.hypot(gx - fx, gy - fy); if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}, [fx, fy]);
export const dstate = (p) => p.evaluate(() => window.__lobby.display.state());
export function boxCorners(boxes) {
  return boxes.map((b) => {
    const [w, d, h] = b.size, hx = w / 2, hy = h / 2, hz = d / 2, c = Math.cos(b.turn || 0), s = Math.sin(b.turn || 0), out = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const X = sx * hx, Y = sy * hy, Z = sz * hz;
      out.push([b.c[0] + X * c + Z * s, b.c[2] + Y, -b.c[1] + (-X * s + Z * c)]);
    }
    return out;
  });
}
export const pen = {
  down: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen', pointerId: 7, isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true })), [x, y]),
  move: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'pen', pointerId: 7, isPrimary: true, buttons: 1, clientX: x, clientY: y, bubbles: true })), [x, y]),
  up: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'pen', pointerId: 7, isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y, bubbles: true })), [x, y]),
};
