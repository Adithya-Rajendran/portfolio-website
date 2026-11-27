// The page's shell: the renderer, the camera, the controls, the addresses and the open room.
import * as THREE from 'three';
import { Post, Governor } from './engine/post.js';
import { loadRoomMode, saveRoomMode } from './engine/governor.js';
import { Q, SKIP, V, num, uTime, uPx, uMirror, DSCALE, setDistanceScale } from './engine/kit.js';
import { loadRoom } from './engine/room.js';
import { reflectEye } from './engine/reflections.js';
import { initLive, live, fill } from './engine/screens.js';
import { loadSite, furnish } from './engine/site.js';
import { addresses } from './engine/address.js';
import { createDisplay } from './engine/hud.js';
import { TURN } from './engine/routemap.js';
import { windowShadow } from './engine/sunlight.js';
import { DEV } from './engine/dev.js';

if (DEV) window.__modules = {
  THREE: { BoxGeometry: THREE.BoxGeometry, Camera: THREE.Camera, Color: THREE.Color, DataUtils: THREE.DataUtils, DoubleSide: THREE.DoubleSide,
    FloatType: THREE.FloatType, FrontSide: THREE.FrontSide, HalfFloatType: THREE.HalfFloatType, Mesh: THREE.Mesh, MeshBasicMaterial: THREE.MeshBasicMaterial,
    PlaneGeometry: THREE.PlaneGeometry, Raycaster: THREE.Raycaster, Scene: THREE.Scene, ShaderMaterial: THREE.ShaderMaterial,
    SphereGeometry: THREE.SphereGeometry, Vector2: THREE.Vector2, Vector3: THREE.Vector3, WebGLRenderTarget: THREE.WebGLRenderTarget },
  kit: { uTime, uMirror, get DSCALE() { return DSCALE; } },
  sunlight: { windowShadow },
};

const $ = (sel) => document.querySelector(sel), esc = (str) => String(str).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const canvas = $('#scene'), loader = $('#loader'), hud = $('#hud'), bar = $('#inspectbar');
const html = document.documentElement, plain = () => !html.classList.contains('station');
const halt = () => new Promise(() => {});
function stayPlain(reason) {
  html.className = ''; loader.dataset.failed = 'true';
  const note = $('#nogl');
  $('#page')?.prepend(note);
  note.hidden = false;
  if (reason) console.warn(reason);
}
const WEBKIT = /AppleWebKit/.test(navigator.userAgent) && !/Chrom(e|ium)|Edg\//.test(navigator.userAgent);
const GL_ATTRS = Object.freeze({ antialias: Q.has('aa') ? Q.get('aa') === '1' : WEBKIT, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' });
function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', GL_ATTRS);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch { return false; }
}
if (!hasWebGL2()) { stayPlain(); await halt(); }
function fail(msg) {
  if (loader.dataset.failed) return;
  if ($('#page')) { loader.dataset.failed = 'true'; html.className = ''; console.error(msg); return; }
  loader.dataset.failed = 'true'; loader.classList.remove('done'); $('#what').textContent = msg;
  $('#loader .percentage').hidden = true;
  $('#loader .bar').style.display = 'none'; $('#loader .mark').style.animation = 'none';
}
addEventListener('error', (e) => fail('ERROR: ' + (e.message || 'failed to start')));
addEventListener('unhandledrejection', (e) => fail('ERROR: ' + (e.reason?.message || e.reason || 'failed to load')));
const [content, site] = await Promise.all([fetch('content.json').then((r) => r.json()), loadSite()]);
furnish(content, site);
const titles = new Map([...site.posts, ...site.projects].map((p) => [p.url, p.title]));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, ...GL_ATTRS });
} catch (e) {
  stayPlain('WebGL2 did not start: ' + (e?.message ?? e));
  await halt();
}
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;
const gl = renderer.getContext(), FLOAT = !!gl.getExtension('EXT_color_buffer_float'), HDR_OK = FLOAT || !!gl.getExtension('EXT_color_buffer_half_float');
const timerExt = gl.getExtension?.('EXT_disjoint_timer_query_webgl2') || null;
const gpuPending = [];
let gpuEpoch = 0, gpuStallFrames = 0, savedRoom = null;
function safeStorage() { try { return globalThis.localStorage; } catch { return null; } }
function resetGpuTimer() {
  gpuEpoch++;
  gpuStallFrames = 0;
  while (gpuPending.length) {
    const { q } = gpuPending.shift();
    try { if (!gl.isContextLost()) gl.deleteQuery(q); } catch {}
  }
}
function drainGpuTimes() {
  if (!timerExt || !gpuPending.length || gl.isContextLost()) return null;
  const samples = [];
  let disjoint = null;
  while (gpuPending.length) {
    const head = gpuPending[0];
    if (!gl.getQueryParameter(head.q, gl.QUERY_RESULT_AVAILABLE)) break;
    gpuPending.shift();
    if (disjoint === null) disjoint = !!gl.getParameter(timerExt.GPU_DISJOINT_EXT);
    const ns = (!disjoint && head.epoch === gpuEpoch) ? gl.getQueryParameter(head.q, gl.QUERY_RESULT) : 0;
    gl.deleteQuery(head.q);
    if (!disjoint && !head.upload && head.epoch === gpuEpoch && typeof ns === 'number' && Number.isFinite(ns) && ns > 0) {
      samples.push(ns / 1e6);
    }
  }
  if (samples.length) gpuStallFrames = 0;
  else if (gpuPending.length && ++gpuStallFrames > 90) resetGpuTimer();
  return samples;
}
setDistanceScale(HDR_OK ? 1 : 0.01);
const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 3000), maxAniso = renderer.capabilities.getMaxAnisotropy();
const mirror = { cam: new THREE.PerspectiveCamera(), vp: new THREE.Matrix4(), size: new THREE.Vector2(4, 4), pxPerRad: { value: 500 }, minLod: { value: 0 },
  rt: new THREE.WebGLRenderTarget(4, 4, { type: HDR_OK ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4, resolveDepthBuffer: false }) };
const post = new Post(renderer, { hdr: HDR_OK, packed: FLOAT, msaa: 4, look: { contrast: num('contrast', 1.3), saturation: num('sat', 1.08),
  bloom: 0.0375 * num('bloom', 1), threshold: num('bloomth', 1.3), vignette: num('vig', 0.45), grain: num('grain', 0.045) } });
let room = null, busy = false;

const REFL_SCALE = num('refl', 0.66), TIER_PINNED = Q.has('tier') || Q.has('msaa');
const PINNED_TIER = Q.has('tier') ? (num('tier', 0) ? 1 : 0) : (num('msaa', 4) ? 0 : 1);
const PINNED_SCALE = Q.has('scale') ? num('scale', 1) : null;
const gov = new Governor({ min: 0.5, max: 1, pinned: PINNED_SCALE, tierPinned: TIER_PINNED, tier: PINNED_TIER, hasGpuTimer: !!timerExt });
let tier = -1, reflScale = REFL_SCALE;
function setTier(t) {
  if (t === tier) return; tier = t;
  post.setMSAA(t ? 0 : 4); post.setFXAA(!!t);
  mirror.rt.samples = t ? 0 : 4; mirror.rt.dispose();
  reflScale = t ? Math.min(1, REFL_SCALE * 1.3) : REFL_SCALE; mirror.minLod.value = t ? 0.8 : 0;
}
setTier(PINNED_TIER);
function applyScale() {
  const W = canvas.width, H = canvas.height, s = gov.scale, tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const rw = Math.max(8, Math.round(W * s * reflScale)), rh = Math.max(8, Math.round(H * s * reflScale));
  post.setSize(W * s, H * s); mirror.rt.setSize(rw, rh); mirror.size.set(rw, rh);
  mirror.pxPerRad.value = rh / (2 * tanHalf); uPx.value = post.scene.height / (2 * tanHalf);
}
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, num('dpr', 2))); renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  const base = Math.tan(THREE.MathUtils.degToRad((room?.info.fov ?? 50) / 2));
  camera.fov = Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(base * Math.max(1, (16 / 9) / camera.aspect))));
  camera.updateProjectionMatrix(); applyScale();
  if (focus.pick) focus.to = focus.pick.pose();
}

const floorBox = new THREE.Box3(), _c = new THREE.Vector4(), _d = new THREE.Vector4(), _n = new THREE.Vector2(), _lo = new THREE.Vector2(), _hi = new THREE.Vector2();
function floorRect() {
  const corner = (i, v) => v.set(i & 1 ? floorBox.max.x : floorBox.min.x, i & 2 ? floorBox.max.y : floorBox.min.y, i & 4 ? floorBox.max.z : floorBox.min.z, 1).applyMatrix4(mirror.vp);
  const add = (v) => { _n.set(v.x / v.w, v.y / v.w); _lo.min(_n); _hi.max(_n); }, W = 1e-3;
  _lo.set(1, 1); _hi.set(-1, -1);
  for (let i = 0; i < 8; i++) {
    if (corner(i, _c).w > W) add(_c);
    for (const b of [1, 2, 4]) if (!(i & b) && (corner(i, _c).w > W) !== (corner(i | b, _d).w > W)) add(_c.lerp(_d, (_c.w - W) / (_c.w - _d.w)));
  }
  _lo.clampScalar(-1, 1); _hi.clampScalar(-1, 1);
  if (_lo.x >= _hi.x || _lo.y >= _hi.y) return null;
  const a = ((room.info.floor.rough[0] + room.info.floor.rough[1]) / 2) ** 2, rv = 2 * a * mirror.pxPerRad.value;
  const pad = 5 * rv + 2 * 2 ** (Math.max(Math.log2(Math.max(rv / 4, 1)), mirror.minLod.value) + 3) + 8, { x: w, y: h } = mirror.size;
  const x0 = Math.max(0, Math.floor((_lo.x + 1) / 2 * w - pad)), y0 = Math.max(0, Math.floor((_lo.y + 1) / 2 * h - pad));
  return [x0, y0, Math.min(w, Math.ceil((_hi.x + 1) / 2 * w + pad)) - x0, Math.min(h, Math.ceil((_hi.y + 1) / 2 * h + pad)) - y0];
}
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
  room.scene.updateMatrixWorld();
  if (!SKIP.has('sunlight')) room.prepass?.(renderer);
  room.capture?.(renderer);
  room.chart?.draw(renderer,room.scene,camera);
  if (!SKIP.has('mirror')) renderMirror();
  renderer.setRenderTarget(post.scene); renderer.render(room.scene, camera);
  post.render(t, SKIP.has('bloom'));
}
function brightness(n) {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4); let sum = 0;
  for (let i = 1; i < n; i++) for (let k = 1; k < n; k++) { gl.readPixels((w * i / n) | 0, (h * k / n) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); sum += px[0] + px[1] + px[2]; }
  return sum / (3 * (n - 1) ** 2);
}
const series = [];

const mouse = new THREE.Vector2(), smooth = new THREE.Vector2(), _hero = V(), _close = V(), _look = V();
const still = matchMedia('(prefers-reduced-motion: reduce)').matches, PINNED = Q.has('shot') || still;
const HOLD = num('hold', 1.2), TRAVEL = num('travel', 5.5);
const SHOT = { hero: 0, close: 1 }[Q.get('shot')] ?? num('shot', 0);
let view = 1, viewTarget = 1, navTouched = false, intro = 0, t0 = 0;

const focus = { pick: null, to: null, f: 1, from: { pos: V(), tgt: V() }, cur: { pos: V(), tgt: V() }, dest: V() };
let tour = null, leaving = null;
const display = createDisplay({ camera, words: content.display, gliding: () => focus.f < 1, choose: (pick) => { if (room && !busy && !plain()) setFocus(pick); } });
let pointer = null, over = null, aim = false, aimed = 0;
function tourOrder() {
  const box = new THREE.Box3(), c = V(), azimuth = (p) => { box.setFromObject(p.mesh).getCenter(c); return Math.atan2(c.x - room.CAM.x, room.CAM.z - c.z); };
  return (tour ??= [...room.picks.filter((p) => p.station != null).sort((a, b) => a.station - b.station),
    ...room.picks.filter((p) => !p.aside && p.station == null).map((p) => [azimuth(p), p]).sort((a, b) => a[0] - b[0]).map((a) => a[1])]);
}
function setFocus(pick = null) {
  if (pick === focus.pick) return;
  focus.pick?.onFocus?.(false, pick); pick?.onFocus?.(true);
  focus.pick = pick; focus.to = pick?.pose() ?? null; focus.f = still ? 1 : 0;
  pointer = null; display.focused(pick);
  focus.from.pos.copy(focus.cur.pos); focus.from.tgt.copy(focus.cur.tgt);
  clearTimeout(leaving); leaving = null;
  hud.classList.toggle('inspecting', !!pick); bar.hidden = !pick; bar.classList.toggle('aside', !!pick?.aside);
  if (room && !busy) syncUrl();
  if (!pick) return;
  $('#back').textContent = pick.backLabel ?? '←  BACK';
  navTouched = true; viewTarget = Math.round(view);
  $('#count').textContent = `${tourOrder().indexOf(pick) + 1} / ${tourOrder().length}`;
  const door = pick.door, ways = !door ? [] : door.stops ?? [[`ENTER ${door.label}`, door.to]];
  $('#ways').innerHTML = ways.map(([label, to]) => `<button data-to="${to}"${to ? '' : ' disabled'}>${label}${to ? '  →' : '  ·  NOT YET OPEN'}</button>`).join('')
    + (pick.options || []).map(([label, , sub], i) => `<button data-option="${i}"${pick.current?.() === i ? ' aria-current="true"' : ''}>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('');
  $('#ways').classList.toggle('list', !!pick.list); $('#ways').classList.toggle('chosen', pick.current?.() >= 0);
  if (pick.enter) $('#ways').insertAdjacentHTML('beforeend', `<button id="enter" hidden aria-label="${esc(content.reader.readThis)}">${esc(pick.enterLabel)}</button>`);
  tick();
}
function step(d) { const t = tourOrder(), i = t.indexOf(focus.pick); setFocus(t[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + t.length) % t.length]); }
function travel(id, delay = 0) { if (id && !leaving) leaving = setTimeout(() => enter(id), delay); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickHit(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const live = room.picks.filter((p) => !p.live || p.live()), of = (h) => live.find((p) => p.mesh === h.object);
  const hits = ray.intersectObjects(live.map((p) => p.mesh), false), hit = hits.find((h) => of(h).reads) ?? hits[0];
  return hit ? { pick: of(hit), hit } : null;
}
const pickAt = (e) => pickHit(e)?.pick ?? null;

const tick = () => {
  const v = live(); for (const el of document.querySelectorAll('[data-live]')) el.textContent = fill(`{${el.dataset.live}}`, v);
  const b = $('#enter'); if (b) b.hidden = !focus.pick?.enter?.();
};
function fillHud(id) {
  const r = content.rooms[id];
  document.title = r.title; $('.kicker').textContent = r.kicker; $('.headline').innerHTML = r.headline.join('<br>');
  const sub = $('.sub'); sub.hidden = !r.sub.length;
  sub.innerHTML = r.sub.map(esc).join('<br>').replace(/\{(\w+)\}/g, '<span data-live="$1"></span>');
  $('.hero .cta')?.remove();
  if (r.cta) $('.hero').insertAdjacentHTML('beforeend', `<button class="cta">${esc(r.cta)}</button>`);
  $('#hud nav').innerHTML = Object.entries(content.rooms).map(([k, v]) => `<a href="${urlFor(k)}" data-room="${k}"${k === id ? ' class="here"' : ''}>${v.nav}</a>`).join('')
    + `<span class="sep"></span><a data-view="0">WIDE</a><a data-view="1">${r.close}</a>`;
  const shelved = room?.volumes?.length ?? 0, facts = r.facts.map(([k, v]) => [k, v.replace('{count} VOLUMES', `${shelved} VOLUME${shelved === 1 ? '' : 'S'}`)]);
  $('#hud > footer').innerHTML = facts.map(([k, v]) => `<div><b>${esc(k)}</b> ${esc(v)}</div>`).join('')
    + `<div class="hint"><span class="how"></span>${r.credit ? `<small>${content.credit}</small>` : ''}</div>`;
  display.paintHint(); tick();
}
const isRoom = (id) => typeof id === 'string' && Object.hasOwn(content.rooms, id);
const { roomAt, route: routeOf } = addresses(content.rooms);
const route = (u = location) => routeOf(u);
const roomInUrl = () => route().id;
const query = () => { const p = new URLSearchParams(Q); p.delete('room'); return `${p}` ? `?${p}` : ''; };
const urlFor = (id) => content.rooms[id].path + query();
let silent = 0;
function syncUrl() {
  if (silent) return;
  const read = focus.pick?.url?.() ?? null, [path, id] = (read ?? '').split('#'), url = read ? path + query() + (id ? `#${id}` : '') : urlFor(room.id);
  if (location.pathname + location.search === url.split('#')[0]) { if (location.hash !== (id ? `#${id}` : '')) history.replaceState(null, '', url); }
  else history.pushState(null, '', url);
  document.title = (read && (focus.pick.title?.() ?? titles.get(path))) || content.rooms[room.id].title;
}
async function readPost(url, fly) {
  if (!room?.read) return false;
  if ((fly && room.terminal) || focus.pick?.reads) { silent++; setFocus(room.terminal ?? null); silent--; }
  const here = room, pick = await room.read(url, fly);
  if (pick && room === here) setFocus(pick);
  return !!pick;
}
function onLink(href) {
  if (href === null) return back();
  const u = new URL(href, location.origin), [at] = roomAt(u.pathname.replace(/\/?$/, '/')), to = route(u);
  if (u.origin !== location.origin || (!at && u.pathname !== '/')) return false;
  if (to.read && to.id === room?.id) {
    const now = focus.pick?.url?.()?.split('#')[0];
    if (now === to.read.split('#')[0]) room.reader.jump(u.hash.slice(1));
    else if (room.reads(to.read)) readPost(to.read, true);
    else return false;
  } else if (to.id === room?.id) back();
  else { if (to.read) history.pushState(null, '', to.read.split('#')[0] + query() + u.hash); enter(to.id, !to.read); }
}
function clearance(x0, x1) {
  if (bar.hidden) return 0;
  let top = innerHeight;
  for (const el of bar.querySelectorAll('button, #named')) { const r = el.getBoundingClientRect(); if (r.width && r.right > x0 && r.left < x1) top = Math.min(top, r.top); }
  return innerHeight - top;
}
function back() {
  const was = focus.pick; setFocus(was?.back?.() ?? null);
  if (was?.reads) (bar.querySelector('[aria-current], #enter:not([hidden]), [data-option]') ?? $('.hero .cta') ?? $('#back'))?.focus({ preventScroll: true });
}
const progress = (f) => { $('#progress').style.width = `${f * 100}%`; $('#pct').textContent = Math.round(f * 100); };
async function enter(id, push = true) {
  if (busy || !isRoom(id) || id === room?.id) return;
  busy = true; setFocus(null); intro = 0;
  $('#what').textContent = content.rooms[id].loading; progress(0); loader.classList.remove('done'); hud.classList.add('hidden');
  if (room) { await new Promise((r) => setTimeout(r, 500)); unturn?.(); unturn = null; room.dispose(); room = null; }
  if (push && location.pathname + location.search !== urlFor(id)) history.pushState(null, '', urlFor(id));
  room = await loadRoom(id, content.rooms[id], { renderer, camera, mirror, maxAniso, onProgress: progress, onLink, clearance, words: content.reader, display: content.display,
    onShown: () => { if (room && !busy) syncUrl(); }, want: route().read?.split('/')[2] });
  room.scene.matrixWorldAutoUpdate = false; room.scene.matrixAutoUpdate = false;
  floorBox.makeEmpty(); for (const f of room.floors) floorBox.expandByObject(f);
  if (room.turn) unturn = turning(room.turn);
  display.room(room.picks, content.rooms[id].hint);
  savedRoom = null;
  const remembered = loadRoomMode(safeStorage(), id, { min: gov.min, max: gov.max, bake: room.scene.userData.stream?.bake?.() });
  const startTier = TIER_PINNED ? PINNED_TIER : (remembered ? remembered.tier : 0);
  const startScale = PINNED_SCALE != null ? PINNED_SCALE : (remembered ? remembered.scale : gov.max);
  gov.reset({ tier: startTier, scale: startScale, warm: 600, held: !TIER_PINNED && !!remembered?.held, heldAt: remembered?.at ?? null });
  setTier(gov.tier);
  fillHud(id); post.setExposure(room.exposure); resize(); resetGpuTimer();
  document.body.classList.toggle('bright', !!content.rooms[id].bright);
  tour = null; view = viewTarget = Q.has('shot') ? SHOT : +!still; navTouched = PINNED; t0 = uTime.value;
  loader.classList.add('done'); hud.classList.remove('hidden'); busy = false;
  if (roomInUrl() !== id) enter(roomInUrl(), false);
  else if (route().read && !plain()) readPost(route().read, false);
}

let downAt = null, hovered = 0;
const CLICK = 6;
let hand = null, swept = false, unturn = null;
const turnable = () => !!room?.turn && !busy && !leaving && !plain() && !focus.pick?.reads;
function turning(turn) {
  const ac = new AbortController(), on = (type, fn, o) => canvas.addEventListener(type, fn, { ...o, signal: ac.signal });
  let idle = 0, banked = 0;
  canvas.classList.add('turns');
  on('pointerdown', (e) => {
    if (hand) letGo(e);
    swept = false;
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button) || !turnable()) return;
    const held = swept = turn.moving() && (turn.grab(), true);
    hand = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false, held, a0: turn.angle(), per: turn.grip(camera), trail: [] };
  });
  on('pointermove', (e) => {
    if (!hand || e.pointerId !== hand.id) return;
    if (!e.buttons || !turnable()) return letGo(e);
    const dx = e.clientX - hand.x, dy = e.clientY - hand.y;
    if (!hand.on) {
      if (Math.hypot(dx, dy) <= CLICK) return;
      if (Math.abs(dx) < Math.abs(dy) * TURN.SLOPE) return letGo(e);
      hand.on = swept = true; const a = turn.angle();
      hand.a0 = a === hand.a0 ? turn.grab() : turn.grab() - dx / hand.per;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
    turn.drag(hand.a0 + dx / hand.per);
    const tr = hand.trail; tr.push([e.timeStamp, turn.angle()]); while (tr.length > 2 && e.timeStamp - tr[1][0] > TURN.FLING * 1000) tr.shift();
  });
  function letGo(e) {
    const h = hand; hand = null; if (!h?.on && !h?.held) return;
    const tr = h.trail, a = tr[0], b = tr[tr.length - 1], span = b && (b[0] - a[0]) / 1000;
    turn.release(b && span > 0.008 && e.timeStamp - b[0] < TURN.FLING * 1000 ? (b[1] - a[1]) / span : 0);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) on(type, (e) => { if (hand && e.pointerId === hand.id) letGo(e); });
  on('wheel', (e) => {
    if (plain()) return;
    const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey || TURN.VERTICAL ? e.deltaY : 0) * (e.deltaMode === 1 ? TURN.LINE : e.deltaMode === 2 ? innerWidth : 1);
    if (!d) return;
    e.preventDefault();
    if (!turnable() || hand?.on) return;
    clearTimeout(idle);
    if (still) {
      banked += d; const n = Math.trunc(banked / TURN.STEP); banked -= n * TURN.STEP; if (n) turn.step(Math.sign(n));
      idle = setTimeout(() => { banked = 0; }, TURN.IDLE); return;
    }
    turn.drag(turn.angle() - d * TURN.WHEEL);
    idle = setTimeout(() => { if (!hand?.on) turn.release(0, -Math.sign(d) * TURN.LEAN); }, TURN.IDLE);
  }, { passive: false });
  return () => { ac.abort(); clearTimeout(idle); canvas.classList.remove('turns'); hand = null; swept = false; seen = null; };
}
addEventListener('resize', resize);
addEventListener('popstate', () => {
  const r = route();
  if (r.id !== room?.id) enter(r.id, false);
  else if (r.read) {
    const now = focus.pick?.url?.();
    if (now?.split('#')[0] === r.read.split('#')[0]) room.reader.jump(location.hash.slice(1)); else readPost(r.read, false);
  }
  else if (focus.pick?.reads) back();
});
addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; pointer = null; display.pointing(e.pointerType); });
addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointer = null; });
addEventListener('blur', () => { pointer = null; });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { resetGpuTimer(); gov.rest(500); }
});
canvas.addEventListener('webglcontextlost', () => { gpuPending.length = 0; gpuEpoch++; });
addEventListener('pointermove', (e) => {
  if (!hand?.on) mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  display.pointing(e.pointerType); pointer = e.pointerType !== 'touch' && e.target === canvas ? { clientX: e.clientX, clientY: e.clientY } : null; aim = true;
  if (room && !plain() && e.timeStamp - hovered > 60) {
    hovered = e.timeStamp; const ph = pickHit(e);
    canvas.style.cursor = !ph ? '' : ph.pick === focus.pick && ph.pick.cursor ? ph.pick.cursor(ph.hit.uv) : 'pointer';
  }
});
addEventListener('deviceorientation', (e) => {
  if (e.gamma != null && !hand?.on) mouse.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1));
});
addEventListener('click', (e) => {
  if (!room || busy || plain() || e.target.closest('#hud nav, #inspectbar, #reader, a, button')) return;
  if (swept || (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > CLICK)) return;
  const ph = pickHit(e), pick = ph?.pick ?? null;
  if (pick && pick === focus.pick && pick.click) return pick.click(ph.hit.uv);
  if (!pick && focus.pick?.steady) return;
  setFocus(pick);
  if (pick?.door && !pick.door.stops) travel(pick.door.to, 1500);
});
addEventListener('keydown', (e) => {
  if (!room || busy || plain()) return;
  if (focus.pick?.typing?.() && e.key !== 'Escape') return;
  if (e.key === 'Escape') back();
  else if (e.key === 'Enter' && focus.pick?.enter?.()) setFocus(focus.pick.enter());
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
});
bar.addEventListener('click', (e) => {
  if (e.target.dataset.to) travel(e.target.dataset.to);
  if (e.target.id === 'enter' && focus.pick?.enter?.()) return setFocus(focus.pick.enter());
  const option = e.target.closest('[data-option]');
  if (option) {
    const ways = $('#ways'), again = ways.classList.contains('chosen') && option.hasAttribute('aria-current') && matchMedia('(max-width: 720px)').matches;
    ways.classList.toggle('chosen', !again); if (again) return;
    for (const b of bar.querySelectorAll('[data-option]')) { if (b === option) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
    focus.pick?.options[option.dataset.option][1]();
  }
  else ({ back, prev: () => step(-1), next: () => step(1) })[e.target.id]?.();
});
$('.hero').addEventListener('click', (e) => {
  if (!e.target.closest('.cta') || !room) return;
  const reads = content.rooms[room.id].ctaReads; if (reads) readPost(reads, false); else setFocus(room.picks.find((p) => p.cta));
});
$('#hud nav').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (a.dataset.room) { e.preventDefault(); enter(a.dataset.room); }
  else { navTouched = true; viewTarget = +a.dataset.view; }
});

const clock = new THREE.Clock(), CALM = num('calm', 0.15), LIFT = 0.8; let drawn = 0, wasCalm = false, seen = null, uploadsSeen = 0, uploadLast = false;
function frame() {
  requestAnimationFrame(frame);
  const rawDt = clock.getDelta(), dt = Math.min(rawDt, 0.05), t = (uTime.value += dt), since = t - t0;
  if (!room || plain()) return display.frame(null);
  const calm = focus.f >= 1 && !!focus.pick?.calm?.();
  if (calm && t - drawn < CALM) return;
  if (calm !== wasCalm) { wasCalm = calm; resetGpuTimer(); gov.rest(600); }
  drawn = t;
  const uploads = room.scene.userData.stream?.uploads?.() ?? 0, uploadNow = uploads !== uploadsSeen, uploadFrame = uploadNow || uploadLast;
  uploadsSeen = uploads; uploadLast = uploadNow;
  const gpuSamples = !calm ? drainGpuTimes() : null;
  if (!calm && gov.update(rawDt * 1000, gpuSamples, uploadFrame)) {
    setTier(gov.tier);
    applyScale();
    resetGpuTimer();
    if (!gov.scalePinned && !TIER_PINNED && room) {
      saveRoomMode(safeStorage(), room.id, { ...gov.savedMode(Date.now()), bake: room.scene.userData.stream?.bake?.() }, { min: gov.min, max: gov.max });
      savedRoom = room.id;
    }
  } else if (!calm && room && savedRoom !== room.id && !gov.scalePinned && !TIER_PINNED && gov.warm <= 0 && gov.settledMs >= 2000) {
    saveRoomMode(safeStorage(), room.id, { ...gov.savedMode(Date.now()), bake: room.scene.userData.stream?.bake?.() }, { min: gov.min, max: gov.max });
    savedRoom = room.id;
  }
  if (room.turn) {
    const by = focus.pick?.reads ? room.reader?.offeredBy() : focus.pick, at = by?.station ?? null;
    if (focus.pick !== seen) { seen = focus.pick; if (at !== null) room.turn.to(at); }
    else if (at !== null && by === focus.pick && room.turn.byHand() && room.turn.front() !== at) { setFocus(room.picks.find((p) => p.station === room.turn.front())); seen = focus.pick; }
  }
  const { CAM, TGT, CLOSE, CLOSE_TGT } = room;
  if (since > HOLD && !navTouched) viewTarget = 0;
  view += THREE.MathUtils.clamp(viewTarget - view, -dt / TRAVEL, dt / TRAVEL);
  intro = Q.has('shot') ? 1 : Math.max(intro, 1 - view);
  const e = view * view * view * (view * (view * 6 - 15) + 10), par = 1 - 0.75 * e;
  smooth.lerp(mouse, 1 - Math.exp(-dt * 2.5));
  _hero.set(CAM.x + smooth.x * 1.0 * par + Math.sin(t * 0.17) * 0.12, CAM.y - smooth.y * 0.22 * par + Math.sin(t * 0.23) * 0.04, CAM.z);
  _close.set(CLOSE.x + smooth.x * 0.5 + Math.sin(t * 0.17) * 0.06, CLOSE.y - smooth.y * 0.15 + Math.sin(t * 0.23) * 0.03, CLOSE.z - Math.min(since, 8) * 0.06);
  camera.position.lerpVectors(_hero, _close, e);
  camera.position.y += Math.sin(Math.PI * e) * room.arc;
  _look.set(TGT.x + smooth.x * 0.8, TGT.y - smooth.y * 0.55, TGT.z).lerp(_p.set(CLOSE_TGT.x + smooth.x * 0.6, CLOSE_TGT.y - smooth.y * 0.4, CLOSE_TGT.z), e);
  focus.f = Math.min(1, focus.f + dt / 1.4);
  const glide = focus.f * focus.f * (3 - 2 * focus.f);
  if (focus.to) {
    focus.dest.copy(focus.to.pos); if (!focus.pick.steady) { focus.dest.x += smooth.x * 0.1; focus.dest.y -= smooth.y * 0.06; }
    camera.position.lerpVectors(focus.from.pos, focus.dest, glide); _look.lerpVectors(focus.from.tgt, focus.to.tgt, glide);
  } else if (focus.f < 1) { camera.position.lerpVectors(focus.from.pos, camera.position, glide); _look.lerpVectors(focus.from.tgt, _look, glide); }
  focus.cur.pos.copy(camera.position); focus.cur.tgt.copy(_look);
  camera.lookAt(_look); camera.updateMatrixWorld();

  room.update(t);
  const measureGpu = !calm && !gov.allPinned && timerExt && gpuPending.length < 24 && !gl.isContextLost() && !gl.getQuery(timerExt.TIME_ELAPSED_EXT, gl.CURRENT_QUERY);
  let gpuQuery = null;
  if (measureGpu) {
    gpuQuery = gl.createQuery();
    if (gpuQuery) gl.beginQuery(timerExt.TIME_ELAPSED_EXT, gpuQuery);
  }
  try {
    draw(t);
  } finally {
    if (gpuQuery && !gl.isContextLost()) {
      gl.endQuery(timerExt.TIME_ELAPSED_EXT);
      gpuPending.push({ q: gpuQuery, epoch: gpuEpoch, upload: gov.excluded });
    }
  }
  if (!pointer) over = null; else if (aim || t - aimed > 0.15) { over = pickHit(pointer)?.pick ?? null; aim = false; aimed = t; }
  if (room.turn?.byHand()) display.did('turn');
  display.frame(over && !busy && over !== focus.pick && !over.reads && !focus.pick?.reads && over.name ? over : null,
    !busy && !focus.pick && focus.f >= 1 && view === 0 && since > LIFT);
  if (Q.has('debug')) { series.push(Math.round(brightness(7))); if (series.length > 400) series.shift(); }
}

initLive(content); $('#brand').textContent = content.brand; setInterval(tick, 500);
let touched = false;
const offer = () => new Promise((yes) => {
  const words = Object.fromEntries(Object.entries(content.reader).map(([k, v]) => [k, v.replace('{place}', content.rooms[route().id].place ?? '')])), b = Object.assign(document.createElement('button'), { id: 'stepin', type: 'button' });
  b.innerHTML = `<small>${esc(room ? words.ready : words.offer)}</small>${esc(words.enter)}`; b.addEventListener('click', () => { b.remove(); yes(); }); document.body.append(b);
});
async function stepIn() {
  const read = route().read, at = [...document.querySelectorAll('#page .post-body h2[id]')].filter((h) => h.getBoundingClientRect().top < innerHeight * 0.4).pop()?.id;
  html.className = 'station'; scrollTo(0, 0); resize(); navTouched = true; viewTarget = view = 0; t0 = uTime.value;
  if (at) room.reader?.scrollTo(at);
  await readPost(read, false);
}
if (plain()) {
  for (const type of ['scroll', 'keydown', 'pointerdown', 'wheel']) addEventListener(type, () => { touched = true; }, { once: true, passive: true });
  if (navigator.connection?.saveData) await offer();
}
await enter(roomInUrl(), false);
if (plain()) {
  if (!room.reads?.(route().read)) html.className = '';
  else if (!touched && scrollY < 80) stepIn(); else offer().then(stepIn);
}
camera.position.copy(room.CAM); camera.lookAt(room.TGT); camera.updateMatrixWorld(); room.update(0); draw(0);
if (tier === 0 && !TIER_PINNED && brightness(8) < 2) { setTier(1); gov.tier = 1; applyScale(); }
if (Q.has('focus')) setTimeout(() => setFocus(room.picks[num('focus', 0)]), 300);
frame();
window.__lobby = { renderer, camera, post, gov, series, setFocus, step, enter, ready: () => intro, display: { state: display.state },
  get turn() { const t = room?.turn; return t ? { ...t, grip: () => t.grip(camera) } : null; },
  get scene() { return room?.scene; }, get picks() { return room?.picks ?? []; },
  ...(Q.has('lightcheck') && { lightFrame(eye, at, t) {
    camera.position.fromArray(eye); camera.lookAt(...at); camera.updateMatrixWorld(true);
    uTime.value = t; room.update(t); draw(t);
  }}),
  reader: { state: () => room?.reader?.state() ?? 'closed', url: () => room?.reader?.url() ?? null, slug: () => room?.reader?.url()?.split('#')[0].split('/').filter(Boolean).pop() ?? null,
    read: (what) => readPost(what.startsWith('/') ? what : `/blog/${what}/`, true), close: () => { if (focus.pick?.reads) back(); } },
  volumes: () => (room?.volumes ?? []).map(({ slug, title }) => ({ slug, title })), held: () => room?.volumes?.[room.heldVolume()]?.slug ?? null,
  mode: () => ({ room: room?.id, hdr: HDR_OK, tier, msaa: post.msaa, scale: +gov.scale.toFixed(2), size: `${post.scene.width}x${post.scene.height}`, mirror: `${mirror.size.x}x${mirror.size.y}` }) };
