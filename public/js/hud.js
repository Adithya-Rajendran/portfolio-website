// The visitor's own display, where it answers the visitor: the lock (corner marks around the thing the pointer rests on, and
// a tag saying what it is and what a click on it does), the cue (the same marks, quieter, already standing on the one thing in
// the room a visitor has to know about, before they have pointed at anything), the bar's caption (what is in focus) and the
// hint (what can be done here, until it has been done once). Nothing here moves by itself: the lock and the cue settle once
// as they appear, and then only follow their thing while the view moves (registration, not motion of the display's own).
// main.js finds the pick under the pointer and says, every drawn frame, which one the display may lock on, and whether the
// room is seen in its wide view (where the cue may stand).
import * as THREE from 'three';

const PAD = 6, EDGE = 8, MOST = 0.6, GAP = 6;         // px around the thing; kept this far inside the window; no lock over more than 60% of it
const CLEAR = 20;                                     // px: the cue's tag is put this far clear of the page's words, so a sway of the view does not push it onto them
const _v = new THREE.Vector3();

/**
 * @param camera   the room's camera, placed for the frame being drawn
 * @param words    content.json "display" (hint.pointer, hint.touch)
 * A pick may carry a cue ({ pointer, touch }: what a click or a tap on it does, in plain words); a room may have a hint of
 * its own ({ pointer, touch, until }), which stands in the hint's place until the visitor has done what it names.
 * @param gliding  () => the camera is still on its way to or from a pick
 * @param choose   (pick) => the visitor pressed the cue's own words: do what they say (the same as a click on its pick)
 */
export function createDisplay({ camera, words, gliding, choose }) {
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
  addEventListener('resize', () => { if (on) { measure(); rect = null; } if (cued) cueShow(cued, cRect, true); });

  // ---- the cue: a second set of marks (a copy of the lock's), standing on the one pick of the room that carries a cue while
  // the room is seen wide and the lock is nowhere. Its tag is put where it is clear of the page's own words. It arrives once
  // (a slower close-in than the lock's, the first time in a room), and has done its work when its pick has been in focus.
  const cue = Object.assign(lock.cloneNode(true), { id: 'cue', className: '', hidden: true }); lock.after(cue);
  const cBox = cue.querySelector('.lock-box'), cTag = cue.querySelector('.lock-tag'), cName = cTag.querySelector('.lock-name'), cVerb = cTag.querySelector('.lock-verb');
  const spent = new WeakSet(), met = new WeakSet(), range = document.createRange();
  // The tag stands beside its thing, and says "click" or "tap": a press on the words themselves counts (on a phone the
  // thing may be smaller than a fingertip). The press is the tag's own: the room behind it does not get it as well.
  cTag.addEventListener('click', (e) => { e.stopPropagation(); if (cued) choose?.(cued); });
  let picks = [], cued = null, cRect = null, cSize = [0, 0], cSide = 0, cGone = 0, zones = [], own = null; const done = new Set();
  /** Where the page's words are now: each line of the hero as wide as its text, the nav and the brand, the facts and the hint. */
  function wordZones() {
    const out = [];
    for (const el of document.querySelectorAll('#hud .hero > *, #hud > header > *, #hud > footer > *')) {
      let b = el.getBoundingClientRect(); if (el.matches('p') && b.width) { range.selectNodeContents(el); b = range.getBoundingClientRect(); }
      if (b.width && b.height) out.push(b);
    }
    return out;
  }
  /** The tag's place on each side of the marks, in the order they are tried: under, beside it on the right, on the left, over; each kept inside the window. */
  function sides([x, y, w, h]) {
    const [tw, th] = cSize, inX = (v) => Math.max(EDGE, Math.min(v, innerWidth - EDGE - tw)), inY = (v) => Math.max(EDGE, Math.min(v, innerHeight - EDGE - th));
    const lx = x + tw <= innerWidth - EDGE ? x : inX(x + (w - tw) / 2);       // under or over: left edges aligned, or, where the window is too narrow for that, centred on the marks
    return [[lx, inY(y + h + GAP)], [inX(x + w + GAP), inY(y + (h - th) / 2)], [inX(x - GAP - tw), inY(y + (h - th) / 2)], [lx, inY(y - GAP - th)]];
  }
  /** Is the tag, at this place, off the marks and off the page's words (with this much room to spare)? */
  const free = ([l, t], r, room) => !meets([l, t, ...cSize], { left: r[0], right: r[0] + r[2], top: r[1], bottom: r[1] + r[3] })
    && !zones.some((b) => meets([l - room, t - room, cSize[0] + 2 * room, cSize[1] + 2 * room], b));
  function cuePlace(r) {
    if (cRect && r.every((x, i) => Math.abs(x - cRect[i]) < 0.05)) return;
    cRect = r; const [x, y, w, h] = r; let at = sides(r);
    // the side chosen as it appeared is kept while it stays clear: the tag does not hop about as the view sways
    if (!free(at[cSide], r, 0)) { const i = at.findIndex((p) => free(p, r, CLEAR)), j = i < 0 ? at.findIndex((p) => free(p, r, 0)) : i; if (j >= 0) cSide = j; }
    cBox.style.transform = `translate(${x}px, ${y}px)`; cBox.style.width = `${w}px`; cBox.style.height = `${h}px`;
    cTag.style.transform = `translate(${at[cSide][0]}px, ${at[cSide][1]}px)`;
  }
  /** again: it is there already and only its words or the window changed: no second arrival. */
  function cueShow(pick, r, again = false) {
    cued = pick; cRect = null; clearTimeout(cGone);
    cName.textContent = pick.name; cVerb.textContent = pick.cue[kind] ?? pick.cue.pointer ?? '';
    cue.hidden = false; cue.classList.add('cut'); if (!again) { cue.classList.remove('on'); cue.classList.toggle('first', !met.has(pick)); met.add(pick); }
    cSize = [cTag.offsetWidth, cTag.offsetHeight]; zones = wordZones();
    const at = sides(r), i = at.findIndex((p) => free(p, r, CLEAR)); cSide = i < 0 ? Math.max(0, at.findIndex((p) => free(p, r, 0))) : i;
    cuePlace(r);
    cue.classList.remove('cut'); cue.classList.add('on');                             // (reading the size above laid the cut state out)
  }
  function cueDrop() {
    if (!cued) return;
    cued = null; cRect = null; cue.classList.remove('on', 'first'); clearTimeout(cGone);
    if (still) cue.hidden = true; else cGone = setTimeout(() => { if (!cued) cue.hidden = true; }, 150);
  }

  // the room's own hint first, until the visitor has done what it names; then the general one, until they have inspected something
  const hint = () => (own && !done.has(own.until) ? own[kind] ?? '' : inspected ? '' : words.hint[kind] ?? '');
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
      if (k !== kind) { kind = k; paintHint(); if (cued) cueShow(cued, cRect, true); }
    },
    /** A room has opened: its picks (one of them may carry a cue) and its own hint, if it has one. */
    room(all, hint) { cueDrop(); picks = all ?? []; own = hint ?? null; },
    /** The visitor has done something a room's hint names (its "until": 'turn', the route map turned by hand). */
    did(what) { if (!done.has(what)) { done.add(what); paintHint(); } },
    /** Every drawn frame, after the camera is placed: the pick to lock on (null: none), and whether the room is seen wide and at
     *  rest. There the cue stands on the pick that carries one, unless the lock is on something: one mark at a time. */
    frame(pick, wide = false) {
      const r = pick && frameOf(pick);
      if (!r) drop(); else if (pick === on) place(r); else show(pick, r);
      const c = wide && !on ? picks.find((q) => q.cue && !spent.has(q) && (!q.live || q.live())) : null, cr = c && frameOf(c);
      if (!cr) cueDrop(); else if (c === cued) cuePlace(cr); else cueShow(c, cr);
    },
    /** The focus changed: the lock goes, the bar names what is in focus, and the hint has done its work. */
    focused(pick) {
      drop(); cueDrop(); if (pick?.cue) spent.add(pick);                           // the visitor has found it: the cue has done its work for this visit to the room
      named.textContent = named.title = pick?.name ?? '';
      if (pick && !inspected) { inspected = true; paintHint(); }
    },
    state: () => ({ lock: on ? { name: on.name, verb: on.verb, rect: rect.map((x) => Math.round(x * 10) / 10) } : null, named: named.textContent, hint: hint(), gliding: gliding(),
      cue: cued ? { name: cued.name, words: cVerb.textContent, rect: cRect.map((x) => Math.round(x * 10) / 10) } : null }),
  };
}
