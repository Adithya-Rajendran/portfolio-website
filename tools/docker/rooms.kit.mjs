// rooms.kit.mjs: what the phase-5 room tests share (rooms.read.mjs, rooms.deeplink.mjs): the profiles, a page with every error
// collected, the state of the reader as a visitor could see it, where the READ glyph is on the screen, the checks every opened
// article must pass, and a spy on canvas text (the rooms draw their words on canvases, so the DOM cannot say what a placard says).
// It never edits anything. docs/v1-contracts.md §8 is what the data looks like; docs/v1-contracts.md §4 the hooks.
import { chromium } from 'playwright';
export const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
export const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, phone: false },
  phone: { viewport: { width: 390, height: 844 }, phone: true, hasTouch: true, isMobile: true },
  reduced: { viewport: { width: 1280, height: 720 }, phone: false, reducedMotion: 'reduce' },
};
const VERBOSE = process.argv.includes('-v');           // every check is counted; only failures (and notes) are printed unless -v
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const json = async (path) => (await fetch(`${ORIGIN}${path}`)).json();
/** The data the rooms are filled from, as the site publishes it. */
export async function load() {
  const [portfolio, profile, content, blog] = await Promise.all([json('/portfolio/index.json'), json('/profile.json'), json('/content.json'), json('/blog/index.json')]);
  return { projects: portfolio.projects, profile, content, posts: blog.posts };
}
export const ROOM_OF = { '/': 'lobby', '/about/': 'about', '/portfolio/': 'projects', '/experience/': 'experience', '/blog/': 'writing', '/contact/': 'comms' };

/** A results collector: "FAIL [profile item] what — detail" for each failure (and "ok" lines with -v), and a summary per item at the end. */
export function suite(title) {
  const results = []; let profile = '';
  return {
    profile: (n) => { profile = n; },
    chk(item, ok, what, detail = '') {
      results.push({ profile, item, ok: !!ok, what, detail });
      if (!ok || VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${profile} ${item}] ${what}${detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
      return !!ok;
    },
    note: (m) => console.log(`  note: ${m}`),
    finish() {
      console.log('\n=== summary');
      const items = [...new Set(results.map((r) => r.item))].sort((a, b) => parseFloat(a) - parseFloat(b) || String(a).localeCompare(String(b)));
      for (const it of items) { const rs = results.filter((r) => r.item === it), bad = rs.filter((r) => !r.ok);
        console.log(`item ${it}: ${bad.length ? 'FAIL' : 'PASS'} (${rs.length - bad.length}/${rs.length})${bad.map((r) => `\n    [${r.profile}] ${r.what}${r.detail !== '' ? ' — ' + (typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)) : ''}`).join('')}`); }
      process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
      console.log(process.exitCode ? `${title} FAILED` : `${title} ok`);
    },
  };
}
export const launch = () => chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
export const context = (b, P, extra = {}) => b.newContext({ viewport: P.viewport, ...(P.phone ? { hasTouch: true, isMobile: true } : {}), ...(P.reducedMotion ? { reducedMotion: P.reducedMotion } : {}),
  permissions: ['clipboard-read', 'clipboard-write'], ...extra });

/** Every canvas 2D text is logged on its canvas (canvas.__t, since the last time the whole canvas was cleared or filled), so a test can read
 *  what a placard or the comms field says right now. Install with context.addInitScript(spy). */
export const spy = () => {
  const P = CanvasRenderingContext2D.prototype, ft = P.fillText, fr = P.fillRect, cr = P.clearRect;
  const reset = (c, x, y, w, h) => { if (x === 0 && y === 0 && w >= c.canvas.width && h >= c.canvas.height) c.canvas.__t = []; };
  P.fillText = function (s, x, y, ...r) { (this.canvas.__t ??= []).push([String(s), x, y]); return ft.call(this, s, x, y, ...r); };
  P.fillRect = function (x, y, w, h) { reset(this, x, y, w, h); return fr.call(this, x, y, w, h); };
  P.clearRect = function (x, y, w, h) { reset(this, x, y, w, h); return cr.call(this, x, y, w, h); };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...a) { (window.__canvases ??= new Set()).add(this); return gc.apply(this, a); };
};
/** Every canvas that has had text drawn on it: its size and the strings of its current drawing, with where each was drawn. */
export const canvasTexts = (p) => p.evaluate(() => [...(window.__canvases ?? [])].filter((c) => c.__t?.length).map((c) => ({ w: c.width, h: c.height, t: c.__t })));
/** Where the point (x, y) of a canvas that a plane shows lies on the screen (the canvas maps to the plane's whole face, y down). */
export const planePoint = (p, pickIndex, cw, ch, x, y) => p.evaluate(async ({ i, cw, ch, x, y }) => { const THREE = await import('three'), l = window.__lobby, m = l.picks[i].mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  const g = m.geometry.parameters, v = new THREE.Vector3((x / cw - 0.5) * g.width, (0.5 - y / ch) * g.height, 0).applyMatrix4(m.matrixWorld).project(l.camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }; }, { i: pickIndex, cw, ch, x, y });

/** A page with every pageerror, console error, failed request and 4xx/5xx collected in errs; opened on a path, waiting for the room (id) to be there. */
export async function open(ctx, path, id, errs, { pin = true, timeout = 150000 } = {}) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
  p.on('requestfailed', (r) => errs.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  await p.goto(`${ORIGIN}${path}${pin ? (path.includes('?') ? '&' : '?') + 'shot=hero&rollat=20' : ''}`);
  await inRoom(p, id, timeout);
  await p.waitForTimeout(1000);
  return p;
}
export const inRoom = (p, id, timeout = 150000) => p.waitForFunction((id) => window.__lobby?.mode().room === id && document.querySelector('#loader.done'), id, { timeout, polling: 250 }).then(() => true, () => false);
/** Wait for a condition in the page; false (never an exception) if it did not come true. */
export const until = (p, fn, arg, timeout = 60000) => p.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => true, () => false);
export const poke = async (p, sel, phone) => { try { await (phone ? p.tap(sel, { timeout: 15000 }) : p.click(sel, { timeout: 15000 })); return true; } catch (e) { return String(e.message).split('\n')[0]; } };
export const tapAt = (p, x, y, phone) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));

/** What the visitor could tell of the reader: its state, what it reads, the address and tab, what is on show in it. */
export const snap = (p) => p.evaluate(() => {
  const l = window.__lobby, r = document.querySelector('#reader'), vis = (e) => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden', en = document.querySelector('#enter');
  return { room: l.mode().room, state: l.reader.state(), url: l.reader.url(), path: location.pathname, hash: location.hash, search: location.search, title: document.title, cls: document.documentElement.className,
    readerShown: vis(r), shown: r.querySelector('article.post')?.dataset.slug ?? (r.querySelector('section.post-list') ? 'list' : null), h1: r.querySelector('h1')?.textContent.trim() ?? null,
    count: document.querySelector('#count')?.textContent ?? null, enter: vis(en), bar: vis(document.querySelector('#inspectbar')), scrollTop: Math.round(document.querySelector('.reader-scroll')?.scrollTop ?? -1) };
});

/** Where the READ pick is on the screen: live, its glyph drawn, the corners of its tap area, and what is on top of it. */
export const readBox = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, pick = l.picks.find((q) => q.reads), m = pick.mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([x, y]) => { const g = m.geometry.parameters, v = new THREE.Vector3(x * g.width / 2, y * g.height / 2, 0).applyMatrix4(m.matrixWorld).project(l.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }; });
  const xs = pts.slice(0, 4).map((q) => q.x), ys = pts.slice(0, 4).map((q) => q.y), c = pts[4], top = document.elementFromPoint(c.x, c.y);
  return { live: !!pick.live(), glyph: m.parent.visible, cx: c.x, cy: c.y, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), behind: pts.some((q) => q.z > 1),
    onTop: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}` : null };
});
/** readBox once the glyph has stopped moving (the camera's glide and the glyph's own easing take a couple of seconds). */
export async function settledBox(p) {
  let a = await readBox(p);
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(250); const b = await readBox(p); const still = Math.hypot(a.cx - b.cx, a.cy - b.cy) < 0.5; a = b; if (still && b.live && b.glyph) break; }
  return a;
}
/** What a click at (x, y) would hit among the room's live picks, nearest first: [pick index, geometry, distance]. main.js takes the first. */
export async function rayHits(p, x, y) {
  let hits = [];
  for (let n = 0; n < 4 && !hits.length; n++) {                // the glyph eases for a moment after the camera stops; look again before saying nothing is there
    if (n) await p.waitForTimeout(400);
    hits = await p.evaluate(async ({ x, y }) => { const THREE = await import('three'), l = window.__lobby, ray = new THREE.Raycaster(), live = l.picks.filter((q) => !q.live || q.live());
      l.camera.updateMatrixWorld(true); for (const q of live) q.mesh.updateWorldMatrix(true, false);
      ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), l.camera);
      return ray.intersectObjects(live.map((q) => q.mesh), false).map((h) => [l.picks.findIndex((q) => q.mesh === h.object), h.object.geometry.type, +h.distance.toFixed(2)]); }, { x, y });
  }
  return hits;
}
/** Press the READ glyph (or the bar's READ button: how = 'glyph' | 'button') and wait for the article. */
export async function readNow(p, phone, how = 'glyph', timeout = 60000) {
  await until(p, () => { const q = window.__lobby.picks.find((x) => x.reads); return q.live() && q.mesh.parent.visible; }, null, 20000);
  await p.waitForTimeout(500);
  const t = Date.now(); let pressed = true;
  if (how === 'button') pressed = await poke(p, '#enter', phone);
  else { const r = await settledBox(p); await p.mouse.move(r.cx, r.cy); await p.waitForTimeout(100); await tapAt(p, r.cx, r.cy, phone); }
  const ok = await until(p, () => window.__lobby.reader.state() === 'open', null, timeout);
  return { ok, t, pressed };
}
/** Focus a pick of the room, as the tour does (the hook is `__lobby.setFocus`; clicks are tested apart). */
export const focus = (p, i) => p.evaluate((i) => { const l = window.__lobby; l.setFocus(l.picks[i]); }, i);
/** The picks that offer something to read, with what they are: kind 'screen' (a placard), 'sphere' (an exhibit or a station) and the url offered. */
export const sources = (p) => p.evaluate(() => window.__lobby.picks.map((q, i) => ({ i, kind: q.mesh.userData?.screen !== undefined ? 'screen' : q.mesh.geometry.type === 'SphereGeometry' ? 'sphere' : q.mesh.geometry.type, screen: q.mesh.userData?.screen ?? null,
  url: q.source?.()?.url ?? null })).filter((q) => q.url));

/** The checks every opened article must pass: where the frame is, its transform at rest, overflow, what covers it, CLOSE. Returns [[ok, what, detail]...]. */
export async function frameChecks(p, W, H) {
  const out = [];
  const g = await p.evaluate(() => { const r = document.querySelector('#reader'), q = r.getBoundingClientRect(), de = document.documentElement, over = [];
    for (const e of r.querySelectorAll('*')) { if (e.closest('pre')) continue; const b = e.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.right > q.right + 1 || b.left < -1)) over.push(`${e.tagName.toLowerCase()}.${e.className}:${Math.round(b.right)}`); }
    const cover = []; for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) for (const fy of [0.05, 0.3, 0.5, 0.7, 0.95]) { const x = q.left + q.width * fx, y = q.top + q.height * fy, t = document.elementFromPoint(x, y); if (!t || !r.contains(t)) cover.push(`${Math.round(x)},${Math.round(y)}:${t?.tagName}#${t?.id}`); }
    const c = document.querySelector('.reader-close'), cr = c.getBoundingClientRect(), ct = document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2);
    return { rect: [q.left, q.top, q.right, q.bottom].map((x) => Math.round(x * 10) / 10), hidden: r.hidden, clip: r.style.clipPath, sw: [de.scrollWidth, document.body.scrollWidth, r.scrollWidth, r.clientWidth, innerWidth], over, cover, sx: scrollX, sy: scrollY,
      close: { rect: [cr.left, cr.right].map(Math.round), onTop: ct === c } }; });
  out.push([!g.hidden && g.rect[0] >= -0.5 && g.rect[1] >= -0.5 && g.rect[2] <= W + 0.5 && g.rect[3] <= H + 0.5, 'the reader element lies inside the viewport', g.rect]);
  await p.waitForTimeout(1500);
  const tf = await p.evaluate(() => { const r = document.querySelector('#reader'); return { inline: r.style.transform, computed: getComputedStyle(r).transform }; });
  out.push([/^translate\(-?[\d.]+px, -?[\d.]+px\)$/.test(tf.inline) && /^matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$/.test(tf.computed), 'once open, its transform is a plain translate(...)', tf]);
  out.push([g.clip === '', 'the reveal clip is gone once open', g.clip]);
  out.push([g.sw[0] <= g.sw[4] && g.sw[1] <= g.sw[4] && g.sw[2] <= g.sw[3] + 1 && g.over.length === 0 && g.sx === 0, 'nothing overflows the page horizontally', { scrollWidth: g.sw, out: g.over.slice(0, 5), scrollX: g.sx }]);
  out.push([g.close.rect[0] >= 0 && g.close.rect[1] <= W && g.close.onTop, 'the CLOSE button is on the screen and can be pressed', g.close]);
  out.push([g.cover.length === 0, 'nothing but the reader is on top of it (25 points)', g.cover.slice(0, 5)]);
  return out;
}
/** Escape or CLOSE, whichever the profile has, and wait for the reader to be closed. */
export async function leave(p, phone) {
  if (phone) await poke(p, '.reader-close', true); else await p.keyboard.press('Escape');
  let ok = await until(p, () => window.__lobby.reader.state() === 'closed', null, 8000);
  if (!ok && phone) { await poke(p, '#back', true); ok = await until(p, () => window.__lobby.reader.state() === 'closed', null, 8000); }
  await p.waitForTimeout(800); return ok;
}
/** Focus pick i, wait for its READ glyph to settle, and read it with the glyph (how = 'glyph') or the bar's button. A tap on the glyph that
 *  does nothing is reported (glyphOk false, with what lay in the way) and the article is then read with the button so the rest can be checked. */
export async function readPick(p, phone, i, how) {
  await focus(p, i);
  const ready = await until(p, () => { const q = window.__lobby.picks.find((x) => x.reads); return q.live() && q.mesh.parent.visible; }, null, 20000);
  const box = await settledBox(p), before = await snap(p), reads = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.reads)), hits = await rayHits(p, box.cx, box.cy);
  let r = await readNow(p, phone, how), fell = false;
  if (!r.ok && how === 'glyph') { fell = true; await focus(p, i); await p.waitForTimeout(1500); r = await readNow(p, phone, 'button'); }
  return { ready, box, before, hits, reads, glyphOk: hits[0]?.[0] === reads, ok: r.ok, fell, how };
}
/** Escape (or CLOSE on a phone) and the state afterwards, after the camera has settled. */
export async function leaveAndSnap(p, phone) { const ok = await leave(p, phone); await p.waitForTimeout(1000); return { ok, s: await snap(p) }; }
