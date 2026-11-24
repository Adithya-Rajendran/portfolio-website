// r2.kit.mjs: what the round-2 browser tests share (opening.mjs, turn.mjs, cue.mjs, contact.mjs, rooms.text.mjs), on top of rooms.kit.mjs: a recorder of the ways
// of opening (the meshes js/reader.js and js/opening/ show, by name), a gate on the page's frames, where a pick is on the screen, and a pointer that is
// not a mouse. It never edits anything. docs/v1-contracts.md §4 is what the hooks are.
import { sleep } from './rooms.kit.mjs';
export { sleep };

/** Install with context.addInitScript(WAYS): a poller (25 ms) that records, over any stretch (window.__w.mark() ends one and starts the next),
 *  the reader's states in order, the most of each way-of-opening mesh that was visible at once (and the most in each state), the most the READ
 *  glyph's uWord rose to, whether the READ pick was ever live, how many station sheets (sprites with userData.pane) were fully dark at once, and the
 *  most pixels by which the reading's page of words (#reader, while shown) lay outside the viewport (astray). */
export const WAYS = () => {
  const NAMES = ['ReadGlyph', 'ReadFrame', 'ReadBeam', 'ReadAnchor', 'ScanSheet', 'ScanFan', 'ScanBody', 'ReadFlow', 'ReadPrint'];
  const fresh = () => ({ n: 0, states: [], max: {}, byState: {}, word: 0, live: false, dark: 0, astray: 0 });
  const W = window.__w = { rec: fresh(), mark() { const r = W.rec; W.rec = fresh(); return r; } };
  const shown = (o) => { for (let e = o; e; e = e.parent) if (!e.visible) return false; return true; };
  setInterval(() => {
    const l = window.__lobby; if (!l?.scene) return;
    const r = W.rec, st = l.reader.state(), c = {}; let glyph = null, dark = 0; r.n++;
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
/** What is visible of the ways' meshes right now, and the READ pick's state. */
export const look = (p) => p.evaluate(() => {
  const l = window.__lobby, c = {}, shown = (o) => { for (let e = o; e; e = e.parent) if (!e.visible) return false; return true; };
  l.scene.traverse((o) => { if (/^(Read|Scan)/.test(o.name) && shown(o)) c[o.name] = (c[o.name] || 0) + 1; });
  const q = l.picks.find((x) => x.reads);
  return { state: l.reader.state(), ...c, live: !!q?.live(), glyph: !!q && q.mesh.parent.visible };
});
/** A gate on the page's frames (install with context.addInitScript(GATE)): while it is shut the page draws only when told to, and each frame then
 *  advances the station's clock by its cap (0.05 s), so a moment of an animation can be examined. */
export const GATE = () => {
  const raf = window.requestAnimationFrame.bind(window), g = window.__gate = { open: true, n: 0, stamp: -1 };
  window.requestAnimationFrame = (cb) => { const go = (t) => { if (g.open || g.stamp === t) return cb(t); if (g.n > 0) { g.n--; g.stamp = t; return cb(t); } raf(go); }; return raf(go); };
};
export const gate = {
  shut: (p) => p.evaluate(() => { window.__gate.open = false; window.__gate.n = 0; }),
  open: (p) => p.evaluate(() => { window.__gate.open = true; }),
  step: async (p, n) => { await p.evaluate((n) => { window.__gate.n = n; }, n); await p.waitForFunction(() => window.__gate.n <= 0, null, { timeout: 120000, polling: 40 }); await sleep(250); },
};
/** The camera has stopped: the glide to a pick is over (display.state().gliding false) and the eye has not moved over four looks. */
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
/** The room's pick i as a visitor could press it: the middle of its mesh's bounding sphere on the screen, and whether a click there reaches that pick. */
export const pickPoint = (p, i) => p.evaluate(async (i) => {
  const THREE = await import('three'), l = window.__lobby, m = l.picks[i].mesh, ray = new THREE.Raycaster(); l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  m.geometry.computeBoundingSphere(); const v = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(l.camera), x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
  const live = l.picks.filter((q) => !q.live || q.live()); ray.setFromCamera(new THREE.Vector2(v.x, v.y), l.camera);
  const hit = ray.intersectObjects(live.map((q) => q.mesh), false)[0];
  return { x, y, inside: x > 4 && x < innerWidth - 4 && y > 4 && y < innerHeight - 4 && v.z < 1, reaches: hit?.object === m, top: document.elementFromPoint(x, y)?.id ?? null };
}, i);
/** A point of the screen where the canvas is what is there (not the page's words), nearest to (fx, fy) of the window. */
export const canvasPoint = (p, fx, fy) => p.evaluate(([fx, fy]) => {
  let best = null;
  for (let gy = 0.05; gy < 1; gy += 0.05) for (let gx = 0.05; gx < 1; gx += 0.05) {
    const x = gx * innerWidth, y = gy * innerHeight; if (document.elementFromPoint(x, y)?.id !== 'scene') continue;
    const d = Math.hypot(gx - fx, gy - fy); if (!best || d < best.d) best = { x, y, d };
  }
  return best;
}, [fx, fy]);
/** The display's state, and the pick the bar names. */
export const dstate = (p) => p.evaluate(() => window.__lobby.display.state());
/** The corners of boxes the bake names (scene.json focus[].boxes, Blender's axes) as three.js world points: [[x, y, z] x 8] per box. */
export function boxCorners(boxes) {
  return boxes.map((b) => {
    const [w, d, h] = b.size, hx = w / 2, hy = h / 2, hz = d / 2, c = Math.cos(b.turn || 0), s = Math.sin(b.turn || 0), out = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const X = sx * hx, Y = sy * hy, Z = sz * hz;                          // (three's axes: x, up, depth), turned about the vertical by `turn`
      out.push([b.c[0] + X * c + Z * s, b.c[2] + Y, -b.c[1] + (-X * s + Z * c)]);
    }
    return out;
  });
}
/** A pointer that is not a mouse (a pen), by synthetic events on the canvas. */
export const pen = {
  down: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'pen', pointerId: 7, isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true, cancelable: true })), [x, y]),
  move: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'pen', pointerId: 7, isPrimary: true, buttons: 1, clientX: x, clientY: y, bubbles: true })), [x, y]),
  up: (p, x, y) => p.evaluate(([x, y]) => document.querySelector('#scene').dispatchEvent(new PointerEvent('pointerup', { pointerType: 'pen', pointerId: 7, isPrimary: true, button: 0, buttons: 0, clientX: x, clientY: y, bubbles: true })), [x, y]),
};
