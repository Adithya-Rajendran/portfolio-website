// ARCADIA STATION — the page's shell: one renderer, one camera, one set of controls, and whichever room is open.
// Rooms are built by js/room.js from assets/<id>/; everything the site says is in content.json.
//
// How a frame is made (kept deliberately cheap, so moving characters can be added later):
//   1. Cycles bakes the room's fixed light and indirect daylight. Direct window sun uses a live light-space
//      shadow map. The orrery's baked light phases follow its rings; polished fittings read a local specular probe.
//   2. The polished floor gets a live planar reflection: the scene is rendered once more from the mirrored camera
//      at reduced size. Anything that moves reflects automatically.
//   3. One HDR scene pass, a small bloom chain and a single full-screen grading/tone-mapping pass (js/post.js).
//   4. The internal resolution follows the frame rate (Governor).
import * as THREE from 'three';
import { Post, Governor } from './js/post.js';
import { Q, SKIP, V, num, uTime, uPx, uMirror, setDistanceScale } from './js/kit.js';
import { loadRoom } from './js/room.js';
import { reflectEye } from './js/reflections.js';
import { initLive, live, fill } from './js/screens.js';
import { loadSite, furnish } from './js/site.js';
import { createDisplay } from './js/hud.js';

const $ = (sel) => document.querySelector(sel), esc = (str) => String(str).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const canvas = $('#scene'), loader = $('#loader'), hud = $('#hud'), bar = $('#inspectbar');
const html = document.documentElement, plain = () => !html.classList.contains('station');    // an article shown as a page: the room, if loaded, is hidden behind it (post.css)
function fail(msg) {
  if (loader.dataset.failed) return; // Preserve the first cause while outstanding requests settle.
  if ($('#page')) { loader.dataset.failed = 'true'; html.className = ''; console.error(msg); return; }      // the page has its text in it: leave that to be read
  loader.dataset.failed = 'true'; loader.classList.remove('done'); $('#what').textContent = msg;
  $('#loader .percentage').hidden = true;
  $('#loader .bar').style.display = 'none'; $('#loader .mark').style.animation = 'none';
}
addEventListener('error', (e) => fail('ERROR: ' + (e.message || 'failed to start')));
addEventListener('unhandledrejection', (e) => fail('ERROR: ' + (e.reason?.message || e.reason || 'failed to load')));
const [content, site] = await Promise.all([fetch('content.json').then((r) => r.json()), loadSite()]);
furnish(content, site);                                 // the posts, the projects and the profile take their places in the rooms
const titles = new Map([...site.posts, ...site.projects].map((p) => [p.url, p.title]));

// ---------------------------------------------------------------- renderer
// The canvas itself needs no depth buffer or MSAA (the scene is drawn into our own HDR target) - except in WebKit,
// which presented a black page from a non-antialiased canvas in testing, so Safari keeps an antialiased one.
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrom(e|ium)|Edg\//.test(navigator.userAgent);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.has('aa') ? Q.get('aa') === '1' : WEBKIT, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
} catch (e) {
  fail('THIS BROWSER CANNOT START WEBGL 2 — ENABLE HARDWARE ACCELERATION');
  throw e;
}
renderer.toneMapping = THREE.NoToneMapping;          // tone mapping happens once, in the final post pass
renderer.info.autoReset = false;
const gl = renderer.getContext(), FLOAT = !!gl.getExtension('EXT_color_buffer_float'), HDR_OK = FLOAT || !!gl.getExtension('EXT_color_buffer_half_float');
setDistanceScale(HDR_OK ? 1 : 0.01);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 3000), maxAniso = renderer.capabilities.getMaxAnisotropy();
// the floor's mirror image: rendered here every frame, read by the floor material of whichever room is open
const mirror = { cam: new THREE.PerspectiveCamera(), vp: new THREE.Matrix4(), size: new THREE.Vector2(4, 4), pxPerRad: { value: 500 }, minLod: { value: 0 },
  rt: new THREE.WebGLRenderTarget(4, 4, { type: HDR_OK ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4, resolveDepthBuffer: false }) };     // MSAA: thin light strips must not alias in it
const post = new Post(renderer, { hdr: HDR_OK, packed: FLOAT, msaa: 4, look: { contrast: num('contrast', 1.3), saturation: num('sat', 1.08),
  bloom: num('bloom', 0.05), vignette: num('vig', 0.45), grain: num('grain', 0.045) } });
const gov = new Governor({ min: 0.5, max: 1, pinned: Q.has('scale') ? num('scale', 1) : null });
let room = null, busy = false;

// Quality tiers. 0: 4x MSAA on the scene and on the mirror image (cheap on discrete GPUs, ~45% of the frame on an
// Intel HD 630). 1: no MSAA; edges are smoothed in the final pass (FXAA) and the mirror image is rendered a little
// larger and read one mip level down instead. The governor drops to tier 1 before it cuts resolution hard.
const REFL_SCALE = num('refl', 0.66), TIER_PINNED = Q.has('tier') || Q.has('msaa');
let tier = -1, reflScale = REFL_SCALE;
function setTier(t) {
  if (t === tier) return; tier = t;
  post.setMSAA(t ? 0 : 4); post.setFXAA(!!t);
  mirror.rt.samples = t ? 0 : 4; mirror.rt.dispose();
  reflScale = t ? Math.min(1, REFL_SCALE * 1.3) : REFL_SCALE; mirror.minLod.value = t ? 0.8 : 0;
}
setTier(Q.has('tier') ? num('tier', 0) : num('msaa', 4) ? 0 : 1);
function applyScale() {
  const W = canvas.width, H = canvas.height, s = gov.scale, tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const rw = Math.max(8, Math.round(W * s * reflScale)), rh = Math.max(8, Math.round(H * s * reflScale));
  post.setSize(W * s, H * s); mirror.rt.setSize(rw, rh); mirror.size.set(rw, rh);
  mirror.pxPerRad.value = rh / (2 * tanHalf); uPx.value = post.scene.height / (2 * tanHalf);
}
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, num('dpr', 2))); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  // keep the horizontal framing of the 16:9 hero shot on narrower screens
  const base = Math.tan(THREE.MathUtils.degToRad((room?.info.fov ?? 50) / 2));
  camera.fov = Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(base * Math.max(1, (16 / 9) / camera.aspect))));
  camera.updateProjectionMatrix(); applyScale();
  if (focus.pick) focus.to = focus.pick.pose();
}

// A point of the floor is its own mirror image, so the floor only reads the mirror image where the floor itself is
// on screen, widened by the reach of its blur taps (+-5 lobe widths, mip footprints up to 2^(lod+3) px; see room.js).
// Returns that rectangle in mirror pixels (from projecting the floor's bounding box), or null when no floor is in view.
const floorBox = new THREE.Box3(), _c = new THREE.Vector4(), _d = new THREE.Vector4(), _n = new THREE.Vector2(), _lo = new THREE.Vector2(), _hi = new THREE.Vector2();
function floorRect() {
  const corner = (i, v) => v.set(i & 1 ? floorBox.max.x : floorBox.min.x, i & 2 ? floorBox.max.y : floorBox.min.y, i & 4 ? floorBox.max.z : floorBox.min.z, 1).applyMatrix4(mirror.vp);
  const add = (v) => { _n.set(v.x / v.w, v.y / v.w); _lo.min(_n); _hi.max(_n); }, W = 1e-3;
  _lo.set(1, 1); _hi.set(-1, -1);
  for (let i = 0; i < 8; i++) {
    if (corner(i, _c).w > W) add(_c);
    for (const b of [1, 2, 4]) if (!(i & b) && (corner(i, _c).w > W) !== (corner(i | b, _d).w > W)) add(_c.lerp(_d, (_c.w - W) / (_c.w - _d.w)));   // edge crosses the near side
  }
  _lo.clampScalar(-1, 1); _hi.clampScalar(-1, 1);
  if (_lo.x >= _hi.x || _lo.y >= _hi.y) return null;
  const a = ((room.info.floor.rough[0] + room.info.floor.rough[1]) / 2) ** 2, rv = 2 * a * mirror.pxPerRad.value;
  const pad = 5 * rv + 2 * 2 ** (Math.max(Math.log2(Math.max(rv / 4, 1)), mirror.minLod.value) + 3) + 8, { x: w, y: h } = mirror.size;
  const x0 = Math.max(0, Math.floor((_lo.x + 1) / 2 * w - pad)), y0 = Math.max(0, Math.floor((_lo.y + 1) / 2 * h - pad));
  return [x0, y0, Math.min(w, Math.ceil((_hi.x + 1) / 2 * w + pad)) - x0, Math.min(h, Math.ceil((_hi.y + 1) / 2 * h + pad)) - y0];
}
// mirror the camera in the floor plane (y = 0) and render what the floor sees
const _p = V();
function renderMirror() {
  const c = mirror.cam, dim = (list, on) => { for (const o of list) o.visible = on; };
  reflectEye(camera,c,0,mirror.vp);
  const rect = floorRect(); if (!rect) return;
  mirror.rt.scissor.set(...rect); mirror.rt.scissorTest = true;
  dim(room.floors, false); dim(room.hidden, false);
  const px = uPx.value; uPx.value = mirror.pxPerRad.value; uMirror.value = 1;
  renderer.setRenderTarget(mirror.rt); renderer.render(room.scene, c); uMirror.value = 0; uPx.value = px;
  dim(room.floors, true); dim(room.hidden, true);
}
function draw(t) {
  renderer.info.reset();
  if (!SKIP.has('sunlight')) room.prepass?.(renderer);
  room.capture?.(renderer);
  room.chart?.draw(renderer,room.scene,camera);
  if (!SKIP.has('mirror')) renderMirror();
  renderer.setRenderTarget(post.scene); renderer.render(room.scene, camera);
  post.render(t, SKIP.has('bloom'));
}
// mean brightness of the canvas on an n x n grid, read right after drawing
function brightness(n) {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let sum = 0;
  for (let i = 1; i < n; i++) for (let k = 1; k < n; k++) { gl.readPixels((w * i / n) | 0, (h * k / n) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
  return sum / (3 * (n - 1) ** 2);
}
const series = [];                                     // ?debug: brightness of every frame, for the flicker test in tools/

// ---------------------------------------------------------------- camera
// Two shots: "close" stands at the window, "hero" is the wide view the bake was made for. A room opens on the
// close shot, holds, then pulls back. Around either, the pointer adds gentle parallax.
const mouse = new THREE.Vector2(), smooth = new THREE.Vector2(), _hero = V(), _close = V(), _look = V();
const still = matchMedia('(prefers-reduced-motion: reduce)').matches, PINNED = Q.has('shot') || still;
const HOLD = num('hold', 1.2), TRAVEL = num('travel', 5.5);       // opening shot: a short beat, then the pull-back
const SHOT = { hero: 0, close: 1 }[Q.get('shot')] ?? num('shot', 0);
let view = 1, viewTarget = 1, navTouched = false, intro = 0, t0 = 0;   // view: 0 = hero, 1 = close; t0: when this room opened

// ---------------------------------------------------------------- inspect: click anything interactive for a closer look
// The camera glides from wherever it is to the pick's pose; Back / Esc / a click on nothing returns it to the
// room's own camera. Doors are picks too: walking up to one leads through it into the next room.
const focus = { pick: null, to: null, f: 1, from: { pos: V(), tgt: V() }, cur: { pos: V(), tgt: V() }, dest: V() };
let tour = null, leaving = null;
// The visitor's display (js/hud.js): the lock on what the pointer rests on, the bar's caption, the hint.
const display = createDisplay({ camera, words: content.display, gliding: () => focus.f < 1 });
let pointer = null, over = null, aim = false, aimed = 0;     // where the mouse or pen is over the room (null: touch, gone, pressed, or over the display's own controls); the pick under it
function tourOrder() {                                 // a sweep across the room from left to right as seen from the room camera
  const box = new THREE.Box3(), c = V(), azimuth = (p) => { box.setFromObject(p.mesh).getCenter(c); return Math.atan2(c.x - room.CAM.x, room.CAM.z - c.z); };
  return (tour ??= room.picks.filter((p) => !p.aside).map((p) => [azimuth(p), p]).sort((a, b) => a[0] - b[0]).map((a) => a[1]));     // aside: reached from another pick, not on the tour
}
function setFocus(pick = null) {
  if (pick === focus.pick) return;
  focus.pick?.onFocus?.(false, pick); pick?.onFocus?.(true);        // the one being left is told where the visitor is going
  focus.pick = pick; focus.to = pick?.pose() ?? null; focus.f = still ? 1 : 0;      // reduced motion: a cut, not a glide
  pointer = null; display.focused(pick);                                    // the lock goes until the pointer moves again; the bar says what is in focus
  focus.from.pos.copy(focus.cur.pos); focus.from.tgt.copy(focus.cur.tgt);
  clearTimeout(leaving); leaving = null;
  hud.classList.toggle('inspecting', !!pick); bar.hidden = !pick; bar.classList.toggle('aside', !!pick?.aside);
  if (room && !busy) syncUrl();
  if (!pick) return;
  $('#back').textContent = pick.backLabel ?? '←  BACK';
  navTouched = true; viewTarget = Math.round(view);                         // stop the opening move; it would fight the close-up
  $('#count').textContent = `${tourOrder().indexOf(pick) + 1} / ${tourOrder().length}`;
  // a door leads to one room, or (the stair down to the Ring Line) to a list of stops; '' marks one that is not built yet
  const door = pick.door, ways = !door ? [] : door.stops ?? [[`ENTER ${door.label}`, door.to]];
  $('#ways').innerHTML = ways.map(([label, to]) => `<button data-to="${to}"${to ? '' : ' disabled'}>${label}${to ? '  →' : '  ·  NOT YET OPEN'}</button>`).join('')
    + (pick.options || []).map(([label, , sub], i) => `<button data-option="${i}"${pick.current?.() === i ? ' aria-current="true"' : ''}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('');      // or it offers choices of its own
  $('#ways').classList.toggle('list', !!pick.list); $('#ways').classList.toggle('chosen', pick.current?.() >= 0);
  if (pick.enter) $('#ways').insertAdjacentHTML('beforeend', `<button id="enter" hidden aria-label="${esc(content.reader.readThis)}">${esc(pick.enterLabel)}</button>`);      // what Enter does here, as a button (shown by tick)
  tick();                         // a list: titles one under another, above the bar
}
function step(d) { const t = tourOrder(), i = t.indexOf(focus.pick); setFocus(t[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + t.length) % t.length]); }
function travel(id, delay = 0) { if (id && !leaving) leaving = setTimeout(() => enter(id), delay); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickHit(e) {                                // the pick under the pointer, and where on it (a terminal reads the uv)
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const live = room.picks.filter((p) => !p.live || p.live()), of = (h) => live.find((p) => p.mesh === h.object);      // live: some are only there at times
  const hits = ray.intersectObjects(live.map((p) => p.mesh), false), hit = hits.find((h) => of(h).reads) ?? hits[0];  // READ is drawn over everything, so it is also in front of everything
  return hit ? { pick: of(hit), hit } : null;
}
const pickAt = (e) => pickHit(e)?.pick ?? null;

// ---------------------------------------------------------------- page text and room changes
const tick = () => {
  const v = live(); for (const el of document.querySelectorAll('[data-live]')) el.textContent = fill(`{${el.dataset.live}}`, v);
  const b = $('#enter'); if (b) b.hidden = !focus.pick?.enter?.();
};
function fillHud(id) {
  const r = content.rooms[id];
  document.title = r.title; $('.kicker').textContent = r.kicker; $('.headline').innerHTML = r.headline.join('<br>');
  // Words from content.json and, through js/site.js, from the profile: all of it is text. Only the places for live values become elements.
  $('.sub').innerHTML = r.sub.map(esc).join('<br>').replace(/\{(\w+)\}/g, '<span data-live="$1"></span>');
  $('.hero .cta')?.remove();
  if (r.cta) $('.hero').insertAdjacentHTML('beforeend', `<button class="cta">${esc(r.cta)}</button>`);   // the room's call to action: its 'cta' pick
  $('#hud nav').innerHTML = Object.entries(content.rooms).map(([k, v]) => `<a href="${urlFor(k)}" data-room="${k}"${k === id ? ' class="here"' : ''}>${v.nav}</a>`).join('')
    + `<span class="sep"></span><a data-view="0">WIDE</a><a data-view="1">${r.close}</a>`;
  const shelved = room?.volumes?.length ?? 0, facts = r.facts.map(([k, v]) => [k, v.replace('{count} VOLUMES', `${shelved} VOLUME${shelved === 1 ? '' : 'S'}`)]);
  $('#hud > footer').innerHTML = facts.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')
    + `<div class="hint"><span class="how"></span>${r.credit ? `<small>${content.credit}</small>` : ''}</div>`;
  display.paintHint(); tick();
}
const isRoom = (id) => typeof id === 'string' && Object.hasOwn(content.rooms, id);       // not 'constructor' and the like
// Where a URL leads. Every room has a path (content.json "path": / the Atrium, /blog/ the Library ...); anything deeper,
// or a #fragment on a room's path, is something read in that room (/blog/<slug>/, /experience/#<id>). ?room=<id> is the
// older way to name a room and still works.
const ROOMS = Object.entries(content.rooms).map(([id, r]) => [r.path, id]);
const roomAt = (pathname) => { const first = `/${pathname.split('/')[1]}/`.replace('//', '/'); return [first === '/' ? null : ROOMS.find(([p]) => p === first)?.[1] ?? null, first]; };
function route(u = location) {
  const path = u.pathname.replace(/\/?$/, '/'), [at, base] = roomAt(path), q = new URLSearchParams(u.search).get('room');
  return { id: at ?? (isRoom(q) ? q : 'lobby'), read: at && (path !== base || u.hash.length > 1) ? path + u.hash : null };
}
const roomInUrl = () => route().id;
const query = () => { const p = new URLSearchParams(location.search); p.delete('room'); return `${p}` ? `?${p}` : ''; };       // other switches (?tier=, ?shot= ...) are kept
const urlFor = (id) => content.rooms[id].path + query();
/** The address and the tab's title follow what is open: a room, or what is being read in it. */
let silent = 0;                                         // > 0: a step on the way somewhere, not to be recorded
function syncUrl() {
  if (silent) return;
  const read = focus.pick?.url?.() ?? null, [path, id] = (read ?? '').split('#'), url = read ? path + query() + (id ? `#${id}` : '') : urlFor(room.id);
  if (location.pathname + location.search === url.split('#')[0]) { if (location.hash !== (id ? `#${id}` : '')) history.replaceState(null, '', url); }      // the same page, another place in it: not a new entry
  else history.pushState(null, '', url);
  document.title = (read && (focus.pick.title?.() ?? titles.get(path))) || content.rooms[room.id].title;
}
/** Have the article at a URL read in the room that is open. In the Library the drone fetches the volume (fly), or it is simply there
 *  when the page opened on it. False: it cannot be read here. */
async function readPost(url, fly) {
  if (!room?.read) return false;
  if ((fly && room.terminal) || focus.pick?.reads) { silent++; setFocus(room.terminal ?? null); silent--; }     // what is being read is closed; in the Library, to the terminal to watch the drone go. The address waits for the article
  const here = room, pick = await room.read(url, fly);
  if (pick && room === here) setFocus(pick);
  return !!pick;
}
/** A link inside an article that leads elsewhere on the site (null: the reader's own close button). False: let the browser follow it. */
function onLink(href) {
  if (href === null) return back();
  const u = new URL(href, location.origin), [at] = roomAt(u.pathname.replace(/\/?$/, '/')), to = route(u);
  if (u.origin !== location.origin || (!at && u.pathname !== '/')) return false;            // not a room's address: the browser goes there
  if (to.read && to.id === room?.id) {
    const now = focus.pick?.url?.()?.split('#')[0];
    if (now === to.read.split('#')[0]) room.reader.jump(u.hash.slice(1));                   // what is being read: only a place in it
    else if (room.reads(to.read)) readPost(to.read, true);
    else return false;                                                                      // e.g. a post that is not on the shelves
  } else if (to.id === room?.id) back();                                                    // the room itself: close what is read
  else { if (to.read) history.pushState(null, '', to.read.split('#')[0] + query() + u.hash); enter(to.id, !to.read); }     // another room, and what is read there
}
/** How far up from the bottom of the window the bar's controls (and its caption) reach between x0 and x1 (0: none there). The READ glyph stays above them. */
function clearance(x0, x1) {
  if (bar.hidden) return 0;
  let top = innerHeight;
  for (const el of bar.querySelectorAll('button, #named')) { const r = el.getBoundingClientRect(); if (r.width && r.right > x0 && r.left < x1) top = Math.min(top, r.top); }      // and the caption over them
  return innerHeight - top;
}
function back() {
  const was = focus.pick; setFocus(was?.back?.() ?? null);
  if (was?.reads) (bar.querySelector('[aria-current], #enter:not([hidden]), [data-option]') ?? $('.hero .cta') ?? $('#back'))?.focus({ preventScroll: true });     // the keyboard returns to what it came from: the list, READ, or the room's button
}
const progress = (f) => { $('#progress').style.width = `${f * 100}%`; $('#pct').textContent = Math.round(f * 100); };
/** Leave the open room (if any) and open another: cover the view, free the old room, load the new one, start its opening shot. */
async function enter(id, push = true) {
  if (busy || !isRoom(id) || id === room?.id) return;
  busy = true; setFocus(null); intro = 0;
  $('#what').textContent = content.rooms[id].loading; progress(0); loader.classList.remove('done'); hud.classList.add('hidden');
  if (room) { await new Promise((r) => setTimeout(r, 500)); room.dispose(); room = null; }      // let the cover fade in before the old room goes
  if (push && location.pathname + location.search !== urlFor(id)) history.pushState(null, '', urlFor(id));
  room = await loadRoom(id, content.rooms[id], { renderer, camera, mirror, maxAniso, onProgress: progress, onLink, clearance, words: content.reader, display: content.display,
    onShown: () => { if (room && !busy) syncUrl(); }, want: route().read?.split('/')[2] });
  floorBox.makeEmpty(); for (const f of room.floors) floorBox.expandByObject(f);
  fillHud(id); post.setExposure(room.exposure); resize(); gov.rest(2500);
  tour = null; view = viewTarget = Q.has('shot') ? SHOT : +!still; navTouched = PINNED; t0 = uTime.value;
  loader.classList.add('done'); hud.classList.remove('hidden'); busy = false;
  if (roomInUrl() !== id) enter(roomInUrl(), false);                         // Back / Forward was pressed while this was loading
  else if (route().read && !plain()) readPost(route().read, false);         // an address that names something read here: it is open
}

// ---------------------------------------------------------------- input
let downAt = null, hovered = 0;
addEventListener('resize', resize);
addEventListener('popstate', () => {
  const r = route();
  if (r.id !== room?.id) enter(r.id, false);
  else if (r.read) {                                    // Back / Forward: at once, without the flight
    const now = focus.pick?.url?.();
    if (now?.split('#')[0] === r.read.split('#')[0]) room.reader.jump(location.hash.slice(1)); else readPost(r.read, false);
  }
  else if (focus.pick?.reads) back();
});
addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; pointer = null; display.pointing(e.pointerType); });     // a press: the lock goes
addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointer = null; });       // out of the window
addEventListener('blur', () => { pointer = null; });
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  display.pointing(e.pointerType); pointer = e.pointerType !== 'touch' && e.target === canvas ? { clientX: e.clientX, clientY: e.clientY } : null; aim = true;
  if (room && !plain() && e.timeStamp - hovered > 60) {
    hovered = e.timeStamp; const ph = pickHit(e);
    canvas.style.cursor = !ph ? '' : ph.pick === focus.pick && ph.pick.cursor ? ph.pick.cursor(ph.hit.uv) : 'pointer';
  }
});
addEventListener('deviceorientation', (e) => {
  if (e.gamma != null) mouse.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1));
});
addEventListener('click', (e) => {
  if (!room || busy || plain() || e.target.closest('#hud nav, #inspectbar, #reader, a, button')) return;
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;       // that was a drag
  const ph = pickHit(e), pick = ph?.pick ?? null;
  if (pick && pick === focus.pick && pick.click) return pick.click(ph.hit.uv);     // an open terminal takes its own clicks
  if (!pick && focus.pick?.steady) return;                                  // reading: a stray click beside the text does not close the book
  setFocus(pick);
  if (pick?.door && !pick.door.stops) travel(pick.door.to, 1500);           // clicked a door: walk up to it, then through
});
addEventListener('keydown', (e) => {
  if (!room || busy || plain()) return;                                     // a page read as a page keeps its own keys
  if (focus.pick?.typing?.() && e.key !== 'Escape') return;                // writing at a terminal: the keys are the writer's
  if (e.key === 'Escape') back();
  else if (e.key === 'Enter' && focus.pick?.enter?.()) setFocus(focus.pick.enter());     // at the terminal with a book open: read it
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
});
bar.addEventListener('click', (e) => {
  if (e.target.dataset.to) travel(e.target.dataset.to);
  if (e.target.id === 'enter' && focus.pick?.enter?.()) return setFocus(focus.pick.enter());
  const option = e.target.closest('[data-option]');
  if (option) {                                                             // on a narrow screen a list folds down to what was chosen; touching that opens it again
    const ways = $('#ways'), again = ways.classList.contains('chosen') && option.hasAttribute('aria-current') && matchMedia('(max-width: 720px)').matches;
    ways.classList.toggle('chosen', !again); if (again) return;
    for (const b of bar.querySelectorAll('[data-option]')) { if (b === option) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
    focus.pick?.options[option.dataset.option][1]();
  }
  else ({ back, prev: () => step(-1), next: () => step(1) })[e.target.id]?.();
});
$('.hero').addEventListener('click', (e) => {            // a room's call to action: something to read ("ctaReads"), or its 'cta' pick
  if (!e.target.closest('.cta') || !room) return;
  const reads = content.rooms[room.id].ctaReads; if (reads) readPost(reads, false); else setFocus(room.picks.find((p) => p.cta));
});
$('#hud nav').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (a.dataset.room) { e.preventDefault(); enter(a.dataset.room); }
  else { navTouched = true; viewTarget = +a.dataset.view; }
});

// ---------------------------------------------------------------- frame
const clock = new THREE.Clock(), CALM = num('calm', 0.15); let drawn = 0, wasCalm = false;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = (uTime.value += dt), since = t - t0;
  if (!room || plain()) return display.frame(null);     // nothing is drawn behind an article read as a page
  // While an article is read the room is a still backdrop, nearly dark behind the hologram's veil. It is redrawn only a
  // few times a second: the GPU is then free for the page, and the text scrolls smoothly even on a slow one.
  const calm = focus.f >= 1 && !!focus.pick?.calm?.();
  if (calm && t - drawn < CALM) return;
  if (calm !== wasCalm) { wasCalm = calm; gov.rest(1500); }
  drawn = t;
  if (!calm && gov.update(dt * 1000)) {
    if (tier === 0 && !TIER_PINNED && gov.scale < 0.72) { setTier(1); gov.scale = 1; gov.cool = 6; }     // cheaper AA before lower resolution
    applyScale();
  }
  // the room's own camera: somewhere between the hero and the close shot, plus parallax and a slow sway
  const { CAM, TGT, CLOSE, CLOSE_TGT } = room;
  if (since > HOLD && !navTouched) viewTarget = 0;
  view += THREE.MathUtils.clamp(viewTarget - view, -dt / TRAVEL, dt / TRAVEL);
  intro = Q.has('shot') ? 1 : Math.max(intro, 1 - view);
  const e = view * view * view * (view * (view * 6 - 15) + 10), par = 1 - 0.75 * e;      // smootherstep; less parallax in the tight shot
  smooth.lerp(mouse, 1 - Math.exp(-dt * 2.5));
  _hero.set(CAM.x + smooth.x * 1.0 * par + Math.sin(t * 0.17) * 0.12, CAM.y - smooth.y * 0.22 * par + Math.sin(t * 0.23) * 0.04, CAM.z);
  _close.set(CLOSE.x + smooth.x * 0.5 + Math.sin(t * 0.17) * 0.06, CLOSE.y - smooth.y * 0.15 + Math.sin(t * 0.23) * 0.03, CLOSE.z - Math.min(since, 8) * 0.06);
  camera.position.lerpVectors(_hero, _close, e);
  camera.position.y += Math.sin(Math.PI * e) * room.arc;                  // arc over the middle of the room on the way
  _look.set(TGT.x + smooth.x * 0.8, TGT.y - smooth.y * 0.55, TGT.z).lerp(_p.set(CLOSE_TGT.x + smooth.x * 0.6, CLOSE_TGT.y - smooth.y * 0.4, CLOSE_TGT.z), e);
  // inspect: glide from where the camera was to the close-up (or back to the room camera computed above)
  focus.f = Math.min(1, focus.f + dt / 1.4);
  const glide = focus.f * focus.f * (3 - 2 * focus.f);
  if (focus.to) {
    focus.dest.copy(focus.to.pos); if (!focus.pick.steady) { focus.dest.x += smooth.x * 0.1; focus.dest.y -= smooth.y * 0.06; }      // steady: text is being read, the view holds still
    camera.position.lerpVectors(focus.from.pos, focus.dest, glide); _look.lerpVectors(focus.from.tgt, focus.to.tgt, glide);
  } else if (focus.f < 1) { camera.position.lerpVectors(focus.from.pos, camera.position, glide); _look.lerpVectors(focus.from.tgt, _look, glide); }
  focus.cur.pos.copy(camera.position); focus.cur.tgt.copy(_look);
  camera.lookAt(_look);

  room.update(t); draw(t);
  // the lock: on the pick the pointer rests on, looked for again as the view moves under a still pointer
  if (!pointer) over = null; else if (aim || t - aimed > 0.15) { over = pickHit(pointer)?.pick ?? null; aim = false; aimed = t; }
  display.frame(over && !busy && over !== focus.pick && !over.reads && !focus.pick?.reads && over.name ? over : null);
  if (Q.has('debug')) { series.push(Math.round(brightness(7))); if (series.length > 400) series.shift(); }
}

// ---------------------------------------------------------------- start
initLive(content); $('#brand').textContent = content.brand; setInterval(tick, 500);
// An article's own URL is readable as a page from the first moment (html.reading). When the Library has loaded it takes
// over: the book is there, it is scanned, and the same article stands in the room. A reader already well into the text
// is only offered it, as is one who asked to save data (for them the room is not even fetched until asked for).
let touched = false;
const offer = () => new Promise((yes) => {
  const words = Object.fromEntries(Object.entries(content.reader).map(([k, v]) => [k, v.replace('{place}', content.rooms[route().id].place ?? '')])), b = Object.assign(document.createElement('button'), { id: 'stepin', type: 'button' });
  b.innerHTML = `<small>${esc(room ? words.ready : words.offer)}</small>${esc(words.enter)}`; b.addEventListener('click', () => { b.remove(); yes(); }); document.body.append(b);
});
async function stepIn() {
  const read = route().read, at = [...document.querySelectorAll('#page .post-body h2[id]')].filter((h) => h.getBoundingClientRect().top < innerHeight * 0.4).pop()?.id;
  html.className = 'station'; scrollTo(0, 0); resize(); navTouched = true; viewTarget = view = 0; t0 = uTime.value;
  if (at) room.reader?.scrollTo(at);                     // where they had got to
  await readPost(read, false);
}
if (plain()) {
  for (const type of ['scroll', 'keydown', 'pointerdown', 'wheel']) addEventListener(type, () => { touched = true; }, { once: true, passive: true });
  if (navigator.connection?.saveData) await offer();
}
await enter(roomInUrl(), false);
if (plain()) {
  if (!room.reads?.(route().read)) html.className = '';                      // cannot be read in the room (a post not on the shelves): it stays a page
  else if (!touched && scrollY < 80) stepIn(); else offer().then(stepIn);
}
// Safety net: if nothing reached the canvas (seen with multisampled float targets on some drivers), drop MSAA.
camera.position.copy(room.CAM); camera.lookAt(room.TGT); room.update(0); draw(0);
if (tier === 0 && brightness(8) < 2) { setTier(1); applyScale(); }
if (Q.has('focus')) setTimeout(() => setFocus(room.picks[num('focus', 0)]), 300);
frame();
window.__lobby = { renderer, camera, post, gov, series, setFocus, step, enter, ready: () => intro, display: { state: display.state },
  get scene() { return room?.scene; }, get picks() { return room?.picks ?? []; },
  // Opt-in deterministic QA: use the actual room.update, sun prepass, mirror and post,
  // changing only eye/target/time. Normal visitors retain the usual camera and clock.
  ...(Q.has('lightcheck') && { lightFrame(eye, at, t) {
    camera.position.fromArray(eye); camera.lookAt(...at); camera.updateMatrixWorld(true);
    uTime.value = t; room.update(t); draw(t);
  }}),
  reader: { state: () => room?.reader?.state() ?? 'closed', url: () => room?.reader?.url() ?? null, slug: () => room?.reader?.url()?.split('#')[0].split('/').filter(Boolean).pop() ?? null,
    read: (what) => readPost(what.startsWith('/') ? what : `/blog/${what}/`, true), close: () => { if (focus.pick?.reads) back(); } },
  volumes: () => (room?.volumes ?? []).map(({ slug, title }) => ({ slug, title })), held: () => room?.volumes?.[room.heldVolume()]?.slug ?? null,
  mode: () => ({ room: room?.id, hdr: HDR_OK, tier, msaa: post.msaa, scale: +gov.scale.toFixed(2), size: `${post.scene.width}x${post.scene.height}`, mirror: `${mirror.size.x}x${mirror.size.y}` }) };
