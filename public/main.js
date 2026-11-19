// ARCADIA STATION — the page's shell: one renderer, one camera, one set of controls, and whichever room is open.
// Rooms are built by js/room.js from assets/<id>/; everything the site says is in content.json.
//
// How a frame is made (kept deliberately cheap, so moving characters can be added later):
//   1. Lighting is path-traced into linear-HDR atlases (blender/bake.py) and drawn unlit: no realtime lights.
//      The orrery chandelier turns, so its light is baked separately at three rotation phases and blended live.
//   2. The polished floor gets a live planar reflection: the scene is rendered once more from the mirrored camera
//      at reduced size. Anything that moves reflects automatically.
//   3. One HDR scene pass, a small bloom chain and a single full-screen grading/tone-mapping pass (js/post.js).
//   4. The internal resolution follows the frame rate (Governor).
import * as THREE from 'three';
import { Post, Governor } from './js/post.js';
import { Q, SKIP, V, num, uTime, uPx, uMirror, setDistanceScale } from './js/kit.js';
import { loadRoom } from './js/room.js';
import { initLive, live, fill } from './js/screens.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#scene'), loader = $('#loader'), hud = $('#hud'), bar = $('#inspectbar');
function fail(msg) {
  loader.classList.remove('done'); $('#loader .label').textContent = msg;
  $('#loader .bar').style.display = 'none'; $('#loader .mark').style.animation = 'none';
}
addEventListener('error', (e) => fail('ERROR: ' + (e.message || 'failed to start')));
addEventListener('unhandledrejection', (e) => fail('ERROR: ' + (e.reason?.message || e.reason || 'failed to load')));
const content = await (await fetch('content.json')).json();

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
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4 }) };     // MSAA: thin light strips must not alias in it
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

// mirror the camera in the floor plane (y = 0) and render what the floor sees
const _rot = new THREE.Matrix4(), _p = V(), _t = V();
function renderMirror() {
  const c = mirror.cam, dim = (list, on) => { for (const o of list) o.visible = on; };
  camera.updateMatrixWorld();
  _rot.extractRotation(camera.matrixWorld); _p.setFromMatrixPosition(camera.matrixWorld);
  _t.set(0, 0, -1).applyMatrix4(_rot).add(_p);
  c.position.set(_p.x, -_p.y, _p.z);
  c.up.set(0, 1, 0).applyMatrix4(_rot); c.up.y *= -1;
  c.lookAt(_t.x, -_t.y, _t.z);
  c.fov = camera.fov; c.aspect = camera.aspect; c.near = camera.near; c.far = camera.far;
  c.updateProjectionMatrix(); c.updateMatrixWorld();
  mirror.vp.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
  dim(room.floors, false); dim(room.hidden, false);
  uMirror.value = 1; renderer.setRenderTarget(mirror.rt); renderer.render(room.scene, c); uMirror.value = 0;
  dim(room.floors, true); dim(room.hidden, true);
}
function draw(t) {
  renderer.info.reset();
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
function tourOrder() {                                 // a sweep across the room from left to right as seen from the room camera
  const box = new THREE.Box3(), c = V(), azimuth = (p) => { box.setFromObject(p.mesh).getCenter(c); return Math.atan2(c.x - room.CAM.x, room.CAM.z - c.z); };
  return (tour ??= room.picks.map((p) => [azimuth(p), p]).sort((a, b) => a[0] - b[0]).map((a) => a[1]));
}
function setFocus(pick = null) {
  if (pick === focus.pick) return;
  focus.pick?.onFocus?.(false); pick?.onFocus?.(true);
  focus.pick = pick; focus.to = pick?.pose() ?? null; focus.f = 0;
  focus.from.pos.copy(focus.cur.pos); focus.from.tgt.copy(focus.cur.tgt);
  clearTimeout(leaving); leaving = null;
  hud.classList.toggle('inspecting', !!pick); bar.hidden = !pick;
  if (!pick) return;
  navTouched = true; viewTarget = Math.round(view);                         // stop the opening move; it would fight the close-up
  $('#count').textContent = `${tourOrder().indexOf(pick) + 1} / ${room.picks.length}`;
  const door = pick.door, go = $('#enter'); go.hidden = !door;
  if (door) { go.textContent = door.to ? `ENTER ${door.label}  →` : `${door.label}  ·  NOT YET OPEN`; go.disabled = !door.to; }
}
function step(d) { const t = tourOrder(), i = t.indexOf(focus.pick); setFocus(t[((i < 0 ? (d > 0 ? -1 : 0) : i) + d + t.length) % t.length]); }
function travel(id, delay = 0) { if (id && !leaving) leaving = setTimeout(() => enter(id), delay); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(room.picks.map((p) => p.mesh), false)[0];
  return hit ? room.picks.find((p) => p.mesh === hit.object) : null;
}

// ---------------------------------------------------------------- page text and room changes
const tick = () => { const v = live(); for (const el of document.querySelectorAll('[data-live]')) el.textContent = fill(`{${el.dataset.live}}`, v); };
function fillHud(id) {
  const r = content.rooms[id];
  document.title = r.title; $('.kicker').textContent = r.kicker; $('h1').innerHTML = r.headline.join('<br>');
  $('.sub').innerHTML = r.sub.join('<br>').replace(/\{(\w+)\}/g, '<span data-live="$1"></span>');
  $('nav').innerHTML = Object.entries(content.rooms).map(([k, v]) => `<a href="${urlFor(k)}" data-room="${k}"${k === id ? ' class="here"' : ''}>${v.nav}</a>`).join('')
    + `<span class="sep"></span><a data-view="0">WIDE</a><a data-view="1">${r.close}</a>`;
  $('footer').innerHTML = r.facts.map(([k, v]) => `<div><b>${k}</b> ${v}</div>`).join('')
    + `<div class="hint">${content.hint}${r.credit ? `<br><small>${content.credit}</small>` : ''}</div>`;
  tick();
}
const roomInUrl = () => { const id = new URLSearchParams(location.search).get('room'); return content.rooms[id] ? id : 'lobby'; };
function urlFor(id) {
  const p = new URLSearchParams(location.search); if (id === 'lobby') p.delete('room'); else p.set('room', id);
  return `${p}` ? `?${p}` : location.pathname;
}
const progress = (f) => { $('#progress').style.width = `${f * 100}%`; $('#pct').textContent = Math.round(f * 100); };
/** Leave the open room (if any) and open another: cover the view, free the old room, load the new one, start its opening shot. */
async function enter(id, push = true) {
  if (busy || !content.rooms[id] || id === room?.id) return;
  busy = true; setFocus(null); intro = 0;
  $('#what').textContent = content.rooms[id].loading; progress(0); loader.classList.remove('done'); hud.classList.add('hidden');
  if (room) { await new Promise((r) => setTimeout(r, 500)); room.dispose(); room = null; }      // let the cover fade in before the old room goes
  if (push) history.pushState(null, '', urlFor(id));
  room = await loadRoom(id, content.rooms[id], { camera, mirror, maxAniso, onProgress: progress });
  fillHud(id); post.setExposure(room.exposure); resize(); gov.rest(2500);
  tour = null; view = viewTarget = Q.has('shot') ? SHOT : +!still; navTouched = PINNED; t0 = uTime.value;
  loader.classList.add('done'); hud.classList.remove('hidden'); busy = false;
  if (roomInUrl() !== id) enter(roomInUrl(), false);                         // Back / Forward was pressed while this was loading
}

// ---------------------------------------------------------------- input
let downAt = null, hovered = 0;
addEventListener('resize', resize);
addEventListener('popstate', () => enter(roomInUrl(), false));
addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (room && e.timeStamp - hovered > 60) { hovered = e.timeStamp; canvas.style.cursor = pickAt(e) ? 'pointer' : ''; }
});
addEventListener('deviceorientation', (e) => {
  if (e.gamma != null) mouse.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1));
});
addEventListener('click', (e) => {
  if (!room || busy || e.target.closest('nav, #inspectbar, a, button')) return;
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;       // that was a drag
  const pick = pickAt(e); setFocus(pick);
  if (pick?.door) travel(pick.door.to, 1500);                               // clicked a door: walk up to it, then through
});
addEventListener('keydown', (e) => {
  if (!room || busy) return;
  if (e.key === 'Escape') setFocus(null);
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
});
bar.addEventListener('click', (e) => ({ back: () => setFocus(null), prev: () => step(-1), next: () => step(1), enter: () => travel(focus.pick?.door?.to) })[e.target.id]?.());
$('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (a.dataset.room) { e.preventDefault(); enter(a.dataset.room); }
  else { navTouched = true; viewTarget = +a.dataset.view; }
});

// ---------------------------------------------------------------- frame
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05), t = (uTime.value += dt), since = t - t0;
  if (!room) return;
  if (gov.update(dt * 1000)) {
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
    focus.dest.copy(focus.to.pos); focus.dest.x += smooth.x * 0.1; focus.dest.y -= smooth.y * 0.06;
    camera.position.lerpVectors(focus.from.pos, focus.dest, glide); _look.lerpVectors(focus.from.tgt, focus.to.tgt, glide);
  } else if (focus.f < 1) { camera.position.lerpVectors(focus.from.pos, camera.position, glide); _look.lerpVectors(focus.from.tgt, _look, glide); }
  focus.cur.pos.copy(camera.position); focus.cur.tgt.copy(_look);
  camera.lookAt(_look);

  room.update(t); draw(t);
  if (Q.has('debug')) { series.push(Math.round(brightness(7))); if (series.length > 400) series.shift(); }
}

// ---------------------------------------------------------------- start
initLive(content); $('#brand').textContent = content.brand; setInterval(tick, 500);
await enter(roomInUrl(), false);
// Safety net: if nothing reached the canvas (seen with multisampled float targets on some drivers), drop MSAA.
camera.position.copy(room.CAM); camera.lookAt(room.TGT); room.update(0); draw(0);
if (tier === 0 && brightness(8) < 2) { setTier(1); applyScale(); }
if (Q.has('focus')) setTimeout(() => setFocus(room.picks[num('focus', 0)]), 300);
frame();
window.__lobby = { renderer, camera, post, gov, series, setFocus, step, enter, ready: () => intro,
  get scene() { return room?.scene; }, get picks() { return room?.picks ?? []; },
  mode: () => ({ room: room?.id, hdr: HDR_OK, tier, msaa: post.msaa, scale: +gov.scale.toFixed(2), size: `${post.scene.width}x${post.scene.height}`, mirror: `${mirror.size.x}x${mirror.size.y}` }) };
