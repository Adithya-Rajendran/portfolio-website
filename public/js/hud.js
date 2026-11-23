// The visitor's own display, where it answers the visitor: the lock (corner marks around the thing the pointer rests on, and
// a tag saying what it is and what a click on it does), the bar's caption (what is in focus) and the hint (what can be done
// here, until it has been done once). Nothing here moves by itself: the lock settles once as it appears or changes to another
// thing, and then only follows its thing while the view moves (registration, not motion of the display's own).
// main.js finds the pick under the pointer and says, every drawn frame, which one the display may lock on.
import * as THREE from 'three';

const PAD = 6, EDGE = 8, MOST = 0.6, GAP = 6;         // px around the thing; kept this far inside the window; no lock over more than 60% of it
const _v = new THREE.Vector3();

/**
 * @param camera   the room's camera, placed for the frame being drawn
 * @param words    content.json "display" (hint.pointer, hint.touch)
 * @param gliding  () => the camera is still on its way to or from a pick
 */
export function createDisplay({ camera, words, gliding }) {
  const $ = (s) => document.querySelector(s), lock = $('#lock'), box = lock.querySelector('.lock-box'), tag = lock.querySelector('.lock-tag');
  const nameEl = tag.querySelector('.lock-name'), verbEl = tag.querySelector('.lock-verb'), named = $('#named');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let kind = matchMedia('(hover: none)').matches ? 'touch' : 'pointer', inspected = false;      // how the visitor last pointed; before any pointer, what the device is
  let on = null, rect = null, size = [0, 0], going = 0;
  // the room's own words (the hero, the facts) step back while the lock lies over them: what is pointed at comes first
  const words_ = [$('#hud .hero'), $('#hud > footer')]; let behind = [];
  const meets = ([x, y, w, h], b) => x < b.right && x + w > b.left && y < b.bottom && y + h > b.top;
  const measure = () => { size = [tag.offsetWidth, tag.offsetHeight]; behind = words_.map((el) => [el, el.getBoundingClientRect()]); };

  /** The pick's outline in the world: its own (pick.bounds) or the corners of its mesh's box. */
  function outline(pick) {
    if (pick.bounds) return pick.bounds();
    const g = pick.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const { min, max } = g.boundingBox;
    return Array.from({ length: 8 }, (_, i) => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(pick.mesh.matrixWorld));
  }
  /** Where the brackets go: [left, top, width, height] in CSS px, padded and inside the window; null where there is to be no lock
   *  (part of it behind the visitor, or it fills most of the view: the visitor is looking at it already). */
  function frameOf(pick) {
    const W = innerWidth, H = innerHeight; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of outline(pick)) {
      _v.copy(p).applyMatrix4(camera.matrixWorldInverse); if (_v.z > -camera.near) return null;
      _v.applyMatrix4(camera.projectionMatrix);
      const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    x0 = Math.max(EDGE, x0 - PAD); y0 = Math.max(EDGE, y0 - PAD); x1 = Math.min(W - EDGE, x1 + PAD); y1 = Math.min(H - EDGE, y1 + PAD);
    if (x1 - x0 < 2 || y1 - y0 < 2 || (x1 - x0) * (y1 - y0) > MOST * W * H) return null;
    return [x0, y0, x1 - x0, y1 - y0];
  }
  /** Brackets on the rectangle; the tag under it with the left edges aligned, over it if there is no room under it, always in the window. */
  function place(r) {
    if (rect && r.every((x, i) => Math.abs(x - rect[i]) < 0.05)) return;
    rect = r; const [x, y, w, h] = r, [tw, th] = size;
    box.style.transform = `translate(${x}px, ${y}px)`; box.style.width = `${w}px`; box.style.height = `${h}px`;
    const under = y + h + GAP, top = under + th <= innerHeight - EDGE ? under : Math.max(EDGE, y - GAP - th);
    const left = Math.max(EDGE, Math.min(x, innerWidth - EDGE - tw));
    tag.style.transform = `translate(${left}px, ${top}px)`;
    for (const [el, b] of behind) el.classList.toggle('yield', meets(r, b) || meets([left, top, tw, th], b));
  }
  function show(pick, r) {
    on = pick; rect = null; clearTimeout(going);
    nameEl.textContent = pick.name; verbEl.textContent = pick.verb;
    // from the start of its settle, even when it was on something else a moment ago: one short close-in, then still
    lock.hidden = false; lock.classList.add('cut'); lock.classList.remove('on');
    measure(); place(r);                                                           // (reading the size also lays the cut state out)
    lock.classList.remove('cut'); lock.classList.add('on');
  }
  function drop() {
    if (!on) return;
    on = null; rect = null; lock.classList.remove('on'); clearTimeout(going); for (const el of words_) el.classList.remove('yield');
    if (still) lock.hidden = true; else going = setTimeout(() => { if (!on) lock.hidden = true; }, 150);
  }
  addEventListener('resize', () => { if (on) { measure(); rect = null; } });

  const hint = () => (inspected ? '' : words.hint[kind] ?? '');
  /** The footer's hint (main.js writes the footer for each room): the words for how the visitor points, or nothing once they have inspected something. */
  function paintHint() {
    const el = $('#hud > footer .hint'); if (!el) return;
    const t = hint(); el.querySelector('.how').textContent = t; el.classList.toggle('gone', !t);
  }
  return {
    paintHint,
    /** How the visitor is pointing now (a PointerEvent's pointerType). */
    pointing(type) {
      const k = type === 'touch' ? 'touch' : type ? 'pointer' : kind;
      if (k !== kind) { kind = k; paintHint(); }
    },
    /** Every drawn frame, after the camera is placed: the pick to lock on (null: none). */
    frame(pick) {
      const r = pick && frameOf(pick);
      if (!r) return drop();
      if (pick === on) place(r); else show(pick, r);
    },
    /** The focus changed: the lock goes, the bar names what is in focus, and the hint has done its work. */
    focused(pick) {
      drop();
      named.textContent = named.title = pick?.name ?? '';
      if (pick && !inspected) { inspected = true; paintHint(); }
    },
    state: () => ({ lock: on ? { name: on.name, verb: on.verb, rect: rect.map((x) => Math.round(x * 10) / 10) } : null, named: named.textContent, hint: hint(), gliding: gliding() }),
  };
}
