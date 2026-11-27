// The visitor's display: the lock, the cue, the caption of the bar and the hint, placed from the rectangles of the station.
const EDGE = 8, GAP = 6;
const CLEAR = 20;
const box4 = (r) => (r ? [r.x, r.y, r.width, r.height] : null);

export function createDisplay({ station, words, choose }) {
  const $ = (s) => document.querySelector(s), lock = $('#lock'), box = lock.querySelector('.lock-box'), tag = lock.querySelector('.lock-tag');
  const nameEl = tag.querySelector('.lock-name'), verbEl = tag.querySelector('.lock-verb'), named = $('#named');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let kind = matchMedia('(hover: none)').matches ? 'touch' : 'pointer', inspected = false;
  let on = null, rect = null, size = [0, 0], going = 0;
  const words_ = [$('#hud .hero'), $('#hud > footer')]; let behind = [];
  const meets = ([x, y, w, h], b) => x < b.right && x + w > b.left && y < b.bottom && y + h > b.top;
  const measure = () => { size = [tag.offsetWidth, tag.offsetHeight]; behind = words_.map((el) => [el, el.getBoundingClientRect()]); };
  const frameOf = (pick) => box4(station.rectOf(pick.id));

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
    lock.hidden = false; lock.classList.add('cut'); lock.classList.remove('on');
    measure(); place(r);
    lock.classList.remove('cut'); lock.classList.add('on');
  }
  function drop() {
    if (!on) return;
    on = null; rect = null; lock.classList.remove('on'); clearTimeout(going); for (const el of words_) el.classList.remove('yield');
    if (still) lock.hidden = true; else going = setTimeout(() => { if (!on) lock.hidden = true; }, 150);
  }
  addEventListener('resize', () => { if (on) { measure(); rect = null; } if (cued) cueShow(cued, cRect, true); });

  const cue = Object.assign(lock.cloneNode(true), { id: 'cue', className: '', hidden: true }); lock.after(cue);
  const cBox = cue.querySelector('.lock-box'), cTag = cue.querySelector('.lock-tag'), cName = cTag.querySelector('.lock-name'), cVerb = cTag.querySelector('.lock-verb');
  const spent = new Set(), met = new Set(), range = document.createRange();
  cTag.addEventListener('click', (e) => { e.stopPropagation(); if (cued) choose?.(cued); });
  let cued = null, cRect = null, cSize = [0, 0], cSide = 0, cGone = 0, zones = [], own = null; const done = new Set();
  function wordZones() {
    const out = [];
    for (const el of document.querySelectorAll('#hud .hero > *, #hud > header > *, #hud > footer > *')) {
      let b = el.getBoundingClientRect(); if (el.matches('p') && b.width) { range.selectNodeContents(el); b = range.getBoundingClientRect(); }
      if (b.width && b.height) out.push(b);
    }
    return out;
  }
  function sides([x, y, w, h]) {
    const [tw, th] = cSize, inX = (v) => Math.max(EDGE, Math.min(v, innerWidth - EDGE - tw)), inY = (v) => Math.max(EDGE, Math.min(v, innerHeight - EDGE - th));
    const lx = x + tw <= innerWidth - EDGE ? x : inX(x + (w - tw) / 2);
    return [[lx, inY(y + h + GAP)], [inX(x + w + GAP), inY(y + (h - th) / 2)], [inX(x - GAP - tw), inY(y + (h - th) / 2)], [lx, inY(y - GAP - th)]];
  }
  const free = (p, r, room) => !meets([p[0], p[1], cSize[0], cSize[1]], { left: r[0], right: r[0] + r[2], top: r[1], bottom: r[1] + r[3] })
    && !zones.some((b) => meets([p[0] - room, p[1] - room, cSize[0] + 2 * room, cSize[1] + 2 * room], b));
  function cuePlace(r) {
    if (cRect && r.every((x, i) => Math.abs(x - cRect[i]) < 0.05)) return;
    cRect = r; const [x, y, w, h] = r; let at = sides(r);
    if (!free(at[cSide], r, 0)) { const i = at.findIndex((p) => free(p, r, CLEAR)), j = i < 0 ? at.findIndex((p) => free(p, r, 0)) : i; if (j >= 0) cSide = j; }
    cBox.style.transform = `translate(${x}px, ${y}px)`; cBox.style.width = `${w}px`; cBox.style.height = `${h}px`;
    cTag.style.transform = `translate(${at[cSide][0]}px, ${at[cSide][1]}px)`;
  }
  function cueShow(pick, r, again = false) {
    cued = pick; cRect = null; clearTimeout(cGone);
    cName.textContent = pick.name; cVerb.textContent = pick.cue[kind] ?? pick.cue.pointer ?? '';
    cue.hidden = false; cue.classList.add('cut'); if (!again) { cue.classList.remove('on'); cue.classList.toggle('first', !met.has(pick.id)); met.add(pick.id); }
    cSize = [cTag.offsetWidth, cTag.offsetHeight]; zones = wordZones();
    const at = sides(r), i = at.findIndex((p) => free(p, r, CLEAR)); cSide = i < 0 ? Math.max(0, at.findIndex((p) => free(p, r, 0))) : i;
    cuePlace(r);
    cue.classList.remove('cut'); cue.classList.add('on');
  }
  function cueDrop() {
    if (!cued) return;
    cued = null; cRect = null; cue.classList.remove('on', 'first'); clearTimeout(cGone);
    if (still) cue.hidden = true; else cGone = setTimeout(() => { if (!cued) cue.hidden = true; }, 150);
  }

  const hint = () => (own && !done.has(own.until) ? own[kind] ?? '' : inspected ? '' : words.hint[kind] ?? '');
  function paintHint() {
    const el = $('#hud > footer .hint'); if (!el) return;
    const t = hint(); el.querySelector('.how').textContent = t; el.classList.toggle('gone', !t);
  }
  return {
    paintHint,
    pointing(type) {
      const k = type === 'touch' ? 'touch' : type ? 'pointer' : kind;
      if (k !== kind) { kind = k; paintHint(); if (cued) cueShow(cued, cRect, true); }
    },
    room(hint) { cueDrop(); spent.clear(); met.clear(); own = hint ?? null; },
    did(what) { if (!done.has(what)) { done.add(what); paintHint(); } },
    frame(pick, wide = false) {
      const r = pick && frameOf(pick);
      if (!r) drop(); else if (pick.id === on?.id) place(r); else show(pick, r);
      const c = wide && !on ? station.picks.get().find((q) => q.cue && !spent.has(q.id)) : null, cr = c && frameOf(c);
      if (!cr) cueDrop(); else if (c.id === cued?.id) cuePlace(cr); else cueShow(c, cr);
    },
    focused(pick) {
      drop(); cueDrop(); if (pick) spent.add(pick.pick);
      named.textContent = named.title = pick?.name ?? '';
      if (pick && !inspected) { inspected = true; paintHint(); }
    },
    state: () => ({ lock: on ? { name: on.name, verb: on.verb, rect: rect.map((x) => Math.round(x * 10) / 10) } : null, named: named.textContent, hint: hint(), gliding: station.gliding.get(),
      cue: cued ? { name: cued.name, words: cVerb.textContent, rect: cRect.map((x) => Math.round(x * 10) / 10) } : null }),
  };
}
