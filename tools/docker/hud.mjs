// hud.mjs [desktop|phone|reduced|all]: the visitor's display (the HUD), driven the way a visitor drives it.
//   Nothing on the display moves by itself; a part of it moves once when it appears, changes or is asked for (docs/v1-contracts.md, the HUD).
//   desktop 1280x720: the glyph has no clock and holds still (1), the scan only when READ is asked and only then (2), the lock on a pick (3),
//     names and verbs in every room (4), the hint: the pointer's words, gone after the first inspect (7).
//   phone 390x844 (touch): a tap brings no lock, the hint is the touch words, the bar's name fits and moves nothing (5), the Library's list
//     clears the bar (3), and the hint goes (7).   reduced 1280x720: the lock has no transition, READ shows no scan (6).
//   All profiles: no console error, page error or failed request (8).
// Every check prints "ok" or "FAIL [profile item] what"; the item numbers are the brief's (the contract's section C).
// It never edits anything: a missing hook is a FAIL line, never an exception. Screenshots go to /out/hud-<profile>-<step>.png. Exit code 1 if any check failed.
// Frames are slow on a shared GPU: no state is waited for with a fixed sleep (only the 1.5 s / 3 s / 1 s of "nothing changes" are measured spans, taken once the display has settled).
import { chromium } from 'playwright';
import { streamAbort } from './reqfail.mjs';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080', which = process.argv[2] || 'all';
const results = [];                                              // { profile, item, ok, what, detail }
let profile = '';
function chk(item, ok, what, detail = '') {
  results.push({ profile, item, ok: !!ok, what, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${profile} ${item}] ${what}${detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  return !!ok;
}
const note = (m) => console.log(`  note: ${m}`);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const content = await (await fetch(`${ORIGIN}/content.json`)).json();

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, phone: false },
  phone: { viewport: { width: 390, height: 844 }, phone: true },
  reduced: { viewport: { width: 1280, height: 720 }, phone: false, reducedMotion: 'reduce' },
};
const ROOMS = [['lobby', '/'], ['about', '/about/'], ['projects', '/portfolio/'], ['experience', '/experience/'], ['writing', '/blog/'], ['comms', '/contact/']];

/** Wait for a condition in the page; false (never an exception) if it did not come true. */
const until = (p, fn, arg, timeout = 90000) => p.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => true, () => false);
/** Run one part of the test; if the page or a hook breaks under it, that is a FAIL line and the next part still runs. */
async function guard(item, what, fn) { try { await fn(); } catch (e) { chk(item, false, `${what}: the test could not go on`, String(e.message).split('\n')[0]); } }

/** What the test reads in the page (installed before the page's own scripts, so it survives room changes: they do not reload). Everything
 *  is guarded: a missing hook gives null, never an exception. A poller (8 ms) records what the scan and the lock do, since 'scanning' lasts seconds. */
const INSTALL = () => {
  const L = () => window.__lobby;
  const T = window.__t = {
    reads: () => L()?.picks?.find((q) => q.reads) ?? null,
    glyph: () => T.reads()?.mesh?.parent ?? null,
    uni() { const u = T.glyph()?.material?.uniforms; if (!u) return null; const o = {}; for (const k of ['uShow', 'uWord', 'uHover', 'uProgress']) o[k] = typeof u[k]?.value === 'number' ? u[k].value : null; return o; },
    shaders() { const m = T.glyph()?.material; return m ? { keys: Object.keys(m.uniforms ?? {}), frag: m.fragmentShader ?? '', vert: m.vertexShader ?? '' } : null; },
    ds: () => { try { return L()?.display?.state?.() ?? null; } catch { return null; } },
    obj: (n) => L()?.scene?.getObjectByName(n) ?? null,
    rec: null,
    mark() { const r = T.rec; T.rec = fresh(); return r; },
    async watch(ms) {                                              // the glyph's four uniforms and the display's state, sampled for ms: min, max, and whether the state changed
      const lo = {}, hi = {}, s0 = JSON.stringify(T.ds()); let changed = false, n = 0;
      await new Promise((res) => { const t0 = performance.now(), iv = setInterval(() => { n++; const u = T.uni() ?? {}; for (const k in u) { if (u[k] === null) continue; lo[k] = Math.min(lo[k] ?? 1e9, u[k]); hi[k] = Math.max(hi[k] ?? -1e9, u[k]); } if (JSON.stringify(T.ds()) !== s0) changed = true; if (performance.now() - t0 > ms) { clearInterval(iv); res(); } }, 30); });
      return { lo, hi, changed, n };
    },
  };
  const fresh = () => ({ states: [], fanSeen: false, sheetSeen: false, fanFound: false, sheetFound: false, both: false, maxUp: null, maxUw: null, lockEver: false, n: 0 });
  T.rec = fresh();
  setInterval(() => {
    const r = T.rec, l = L(); if (!l) return; r.n++;
    const st = l.reader?.state?.() ?? 'closed', fan = T.obj('ScanFan'), sheet = T.obj('ScanSheet'), u = T.uni();
    if (r.states[r.states.length - 1] !== st) r.states.push(st);
    if (fan) r.fanFound = true; if (sheet) r.sheetFound = true;
    if (fan?.visible) r.fanSeen = true; if (sheet?.visible) r.sheetSeen = true;
    if (st === 'scanning') { if (fan?.visible && sheet?.visible) r.both = true; if (u?.uProgress != null) r.maxUp = Math.max(r.maxUp ?? 0, u.uProgress); if (u?.uWord != null) r.maxUw = Math.max(r.maxUw ?? 0, u.uWord); }
    if (T.ds()?.lock) r.lockEver = true;
  }, 8);
};

/** A page on a room, with every console error, page error, failed request and 4xx/5xx collected in errs. */
async function open(ctx, path, id, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
  p.on('requestfailed', (r) => streamAbort(r) || errs.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  await p.goto(`${ORIGIN}${path}?shot=hero&rollat=20`);
  await p.waitForFunction((id) => window.__lobby?.mode().room === id && document.querySelector('#loader.done'), id, { timeout: 150000, polling: 250 });
  await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
  return p;
}
/** Go to another room as the page does (no reload) and wait until it is there. */
async function goRoom(p, id) {
  await p.evaluate((id) => window.__lobby.enter(id), id);
  return until(p, (id) => window.__lobby.mode().room === id && window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, id, 120000);
}
/** Until the camera has stopped (display.state().gliding false, twice), and the glyph's uniforms and the camera are still over three looks. */
async function settle(p, timeout = 90000) {
  let last = null, calm = 0; const end = Date.now() + timeout;
  while (Date.now() < end && calm < 3) {
    const s = await p.evaluate(() => ({ u: JSON.stringify(Object.values(window.__t.uni() ?? {}).map((x) => x === null ? null : +x.toFixed(3))), g: window.__t.ds()?.gliding ?? null, cam: window.__lobby.camera.position.toArray().map((x) => x.toFixed(4)).join() }));
    calm = last && s.u === last.u && s.cam === last.cam && s.g !== true ? calm + 1 : 0; last = s; await p.waitForTimeout(500);
  }
  return calm >= 3;
}
const state = (p) => p.evaluate(() => window.__t.ds());
const glyphLive = (p, t = 25000) => until(p, () => { const q = window.__t.reads(); return !!q && q.live() && q.mesh.parent.visible; }, null, t);

/** Where picks are on the screen, as a visitor could point at them: the projected centre of the mesh's bounding box, the screen rectangle of its
 *  8 corners, whether the nearest live pick along that ray is the pick itself, and what element lies there. */
const cands = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, ray = new THREE.Raycaster(), W = innerWidth, H = innerHeight, live = l.picks.filter((q) => !q.live || q.live());
  l.camera.updateMatrixWorld(true); for (const q of l.picks) q.mesh.updateWorldMatrix(true, false);
  const out = [];
  l.picks.forEach((q, i) => {
    if (q.reads || q.aside || (q.live && !q.live())) return;
    const g = q.mesh.geometry; let pts;
    if (q.bounds) pts = q.bounds().map((v) => v.clone());
    else { if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox; pts = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(q.mesh.matrixWorld)); }
    const xs = [], ys = []; let behind = false;
    for (const v0 of pts) { const v = v0.clone().project(l.camera); if (v.z > 1 || v.z < -1) behind = true; xs.push((v.x * 0.5 + 0.5) * W); ys.push((-v.y * 0.5 + 0.5) * H); }
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2, w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    ray.setFromCamera(new THREE.Vector2(x / W * 2 - 1, -(y / H) * 2 + 1), l.camera);
    const hit = ray.intersectObjects(live.map((p) => p.mesh), false)[0], top = document.elementFromPoint(x, y);
    out.push({ i, x, y, w, h, behind, self: hit?.object === q.mesh, canvas: top?.id === 'scene', name: q.name ?? null, verb: q.verb ?? null, type: g.type,
      ok: !behind && x > 20 && x < W - 20 && y > 20 && y < H - 20 && hit?.object === q.mesh && top?.id === 'scene' && w * h < W * H * 0.4 });
  });
  return out;
});
/** A point where no live pick lies and the canvas is what is there (to leave a pick by). */
const emptyPoint = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, ray = new THREE.Raycaster(), live = l.picks.filter((q) => !q.live || q.live());
  l.camera.updateMatrixWorld(true); for (const q of l.picks) q.mesh.updateWorldMatrix(true, false);
  for (let gy = 0.9; gy > 0.1; gy -= 0.1) for (let gx = 0.1; gx < 0.95; gx += 0.1) { const x = gx * innerWidth, y = gy * innerHeight;
    ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), l.camera);
    if (!ray.intersectObjects(live.map((q) => q.mesh), false).length && document.elementFromPoint(x, y)?.id === 'scene') return { x, y }; }
  return { x: innerWidth / 2, y: innerHeight / 2 };
});
/** Where the READ pick's tap area is on the screen. */
const readBox = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, m = window.__t.reads().mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  const g = m.geometry.parameters, v = new THREE.Vector3(0, 0, 0).applyMatrix4(m.matrixWorld).project(l.camera);
  return { cx: (v.x * 0.5 + 0.5) * innerWidth, cy: (-v.y * 0.5 + 0.5) * innerHeight, w: g.width, h: g.height };
});
/** The rectangles of the bar's parts, and whether each is shown. */
const barBox = (p) => p.evaluate(() => { const o = {}, W = innerWidth, H = innerHeight;
  for (const id of ['back', 'prev', 'next', 'count', 'named', 'ways', 'enter']) { const e = document.getElementById(id); if (!e) { o[id] = null; continue; }
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e); o[id] = { l: r.left, t: r.top, r: r.right, b: r.bottom, shown: !e.hidden && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
      inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= W + 0.5 && r.bottom <= H + 0.5, text: e.textContent.trim(), title: e.title ?? '', over: e.scrollWidth > e.clientWidth + 1 }; }
  return o; });
const hintShown = (p) => p.evaluate(() => { const e = document.querySelector('#hud .hint'); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e), t = (e.querySelector('.how') ?? e).textContent.trim(); return !e.hidden && !!t && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; });
const overlap = (a, b) => a && b && a.shown && b.shown && Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;

async function run(name) {
  profile = name; const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}${phone ? ' touch' : ''}${P.reducedMotion ? ' reduced-motion' : ''}`);
  const ctx = await b.newContext({ viewport: P.viewport, ...(phone ? { hasTouch: true, isMobile: true } : {}), ...(P.reducedMotion ? { reducedMotion: P.reducedMotion } : {}) });
  await ctx.addInitScript(INSTALL);
  const shot = (p, n) => p.screenshot({ path: `/out/hud-${name}-${n}.png` }).catch(() => {});
  const poke = async (p, sel) => { try { await (phone ? p.tap(sel, { timeout: 15000 }) : p.click(sel, { timeout: 15000 })); return true; } catch (e) { return String(e.message).split('\n')[0]; } };
  const tapAt = (p, x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  const D = content.display ?? null, hintWords = { pointer: D?.hint?.pointer ?? null, touch: D?.hint?.touch ?? null };

  const p = await open(ctx, '/blog/', 'writing', errs);
  await shot(p, '0-library');

  // ---- 7. the hint at the start: the words for how the visitor points; hovering is not inspecting, so it stays
  await guard(7, 'the hint at the start', async () => {
    const want = phone ? hintWords.touch : hintWords.pointer;
    chk(7, !!want, `content.json has display.hint.${phone ? 'touch' : 'pointer'}`, want ?? 'content.display is missing');
    let st = await state(p);
    chk(7, !!st, 'display.state() exists (window.__lobby.display)', st === null ? 'no __lobby.display' : '');
    chk(7, !!want && st?.hint === want, `at the start the hint is the ${phone ? 'touch' : 'pointer'} words`, { hint: st?.hint ?? null, want });
    if (phone) { const sh = await hintShown(p); chk(7, sh === true, 'the hint is shown on a phone-sized screen', sh === null ? 'no #hud .hint' : sh); }
    else {
      await p.mouse.move(W * 0.5, H * 0.35, { steps: 5 }); await p.mouse.move(W * 0.55, H * 0.45, { steps: 5 }); await p.waitForTimeout(800);
      st = await state(p); chk(7, !!want && st?.hint === want, 'moving the pointer about without inspecting does not take the hint away', st?.hint ?? null);
    }
  });

  // ---- 3 (phone) / 5: the Library's terminal on a phone: the list clears the bar, the bar's name fits
  // ---- the Library: the terminal's list, a held volume, the glyph; then 1, 2 and (reduced) 6
  let read = false;
  await guard(1, 'the Library', async () => {
    const lockBefore = await p.evaluate(() => { const l = window.__lobby, q = l.picks.find((x) => x.options); l.setFocus(q); return q?.name ?? null; });
    const listed = await until(p, () => document.querySelectorAll('#ways.list [data-option]').length > 0, null, 30000);
    chk(3, listed, "focusing the Library's terminal lists the volumes");
    await until(p, () => window.__lobby.display?.state().named, null, 15000);
    const bb = await barBox(p); await p.waitForTimeout(600);
    const st = await state(p);
    chk(3, st?.named === lockBefore && !!lockBefore, "the terminal in focus: #named / display.state().named is its name", { named: st?.named ?? null, pickName: lockBefore, bar: bb.named?.text ?? null });
    chk(3, bb.named?.text === lockBefore && bb.named?.shown === true, 'the bar shows #named with that name', bb.named);
    const parts = ['back', 'prev', 'next', 'count', 'named'].filter((k) => bb[k]), clash = [];
    for (const k of parts) if (bb.ways && overlap(bb.ways, bb[k])) clash.push(k);
    chk(3, bb.ways?.shown && clash.length === 0 && parts.length === 5, 'with the volumes listed above the bar, nothing overlaps it', { list: bb.ways && [bb.ways.l, bb.ways.t, bb.ways.r, bb.ways.b].map(Math.round), clash, missing: ['back', 'prev', 'next', 'count', 'named'].filter((k) => !bb[k]) });
    await shot(p, '1-list');
    // choose the first volume, as a visitor does
    const slug = await p.evaluate(() => window.__lobby.volumes()[0]?.slug);
    const folded = await p.evaluate(() => { const x = document.querySelector('#ways [data-option="0"]'); return !!x && x.getClientRects().length === 0; });
    if (folded) await poke(p, '#ways [data-option][aria-current]');
    const ok = await poke(p, '#ways [data-option="0"]');
    const held = ok === true && await until(p, (s) => window.__lobby.held() === s, slug, 150000);
    chk(1, held, `a volume is chosen and held (${slug})`, ok === true ? '' : ok);
    if (!held) return;
    chk(1, await glyphLive(p, 60000), 'the READ glyph is live and shown for the held volume');
    if (!P.reducedMotion) await p.mouse.move(W - 4, 4);          // parked off the glyph (a hover would be a change, and uHover is measured apart)
    const calm = await settle(p); chk(1, calm, 'the camera, the glyph and the display come to rest after choosing the volume');
    await shot(p, '2-held');

    // 1. quiet
    const sh = await p.evaluate(() => window.__t.shaders());
    chk(1, !!sh, 'the READ glyph is the reading pick\'s mesh.parent and has a material with uniforms', sh ? '' : 'no glyph material');
    chk(1, await p.evaluate(() => window.__t.glyph()?.name === 'ReadGlyph'), "the glyph is named 'ReadGlyph'", await p.evaluate(() => window.__t.glyph()?.name ?? null));
    chk(1, !!sh && !sh.keys.includes('uTime') && !/uTime/.test(sh.frag) && !/uTime/.test(sh.vert), "the glyph's material takes no uTime (not in its uniforms, not in its shader text)", sh ? { uniforms: sh.keys, inShader: /uTime/.test(sh.frag + sh.vert) } : 'no glyph material');
    chk(1, !!sh && ['uShow', 'uWord', 'uHover', 'uProgress'].every((k) => sh.keys.includes(k)), 'the glyph has the uniforms uShow, uWord, uHover, uProgress', sh?.keys ?? 'no glyph material');
    const w = await p.evaluate(() => window.__t.watch(1500));
    for (const k of ['uShow', 'uWord', 'uHover', 'uProgress']) {
      const known = w.lo[k] !== undefined;
      chk(1, known && Math.abs(w.hi[k] - w.lo[k]) < 1e-3, `${k} is unchanged over 1.5 s once settled`, known ? { min: +w.lo[k].toFixed(4), max: +w.hi[k].toFixed(4), samples: w.n } : 'the uniform does not exist');
    }
    const hasDs = !!(await state(p)); chk(1, hasDs && !w.changed, 'display.state() is the same over 1.5 s', !hasDs ? 'no display.state()' : w.changed ? 'it changed' : '');
    // no looping animation anywhere on the display
    const loops = await p.evaluate(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity && a.effect.target?.closest?.('#hud, #inspectbar, #lock')).map((a) => `${a.animationName ?? a.constructor.name} on ${a.effect.target.tagName.toLowerCase()}${a.effect.target.id ? '#' + a.effect.target.id : '.' + (a.effect.target.className?.baseVal ?? a.effect.target.className)}`));
    chk(1, loops.length === 0, 'no animation on the display loops for ever (#hud, #inspectbar, #lock)', loops.slice(0, 5));

    // 2. the scan only when asked: standing here, nothing is scanned
    if (!P.reducedMotion) {
      await p.evaluate(() => window.__t.mark()); await p.waitForTimeout(3000); const idle = await p.evaluate(() => window.__t.mark());
      chk(2, idle.fanFound && idle.sheetFound, "'ScanFan' and 'ScanSheet' exist in the scene (so that \"not visible\" means something)", { fan: idle.fanFound, sheet: idle.sheetFound });
      chk(2, !idle.fanSeen && !idle.sheetSeen, 'standing 3 s with nothing asked: ScanFan and ScanSheet are not visible', { fanSeen: idle.fanSeen, sheetSeen: idle.sheetSeen, state: idle.states });
      // the glyph brightens while the pointer is over it, with an ease that ends
      if (!phone) {
      const r0 = await readBox(p); await p.mouse.move(r0.cx - 40, r0.cy - 60); await p.mouse.move(r0.cx, r0.cy, { steps: 6 });
      const hov = await until(p, () => (window.__t.uni()?.uHover ?? 0) > 0.5, null, 15000);
      chk(1, hov, 'the pointer over the glyph raises uHover', await p.evaluate(() => window.__t.uni()?.uHover ?? null));
      await p.waitForTimeout(1500); const w2 = await p.evaluate(() => window.__t.watch(1000));
      chk(1, w2.lo.uHover !== undefined && Math.abs(w2.hi.uHover - w2.lo.uHover) < 1e-3, 'uHover has stopped easing 1.5 s after the pointer arrived', w2.lo.uHover === undefined ? 'no uHover' : { min: +w2.lo.uHover.toFixed(4), max: +w2.hi.uHover.toFixed(4) });
      }
    }
    // READ
    await p.evaluate(() => window.__t.mark());
    const r = await readBox(p); let how = 'click';
    await p.mouse.move(r.cx, r.cy); await p.waitForTimeout(150); await tapAt(p, r.cx, r.cy);
    if (!(await until(p, () => window.__lobby.reader.state() !== 'closed', null, 10000))) { how = 'hook'; note('the READ press did nothing; carrying on with setFocus(READ pick)'); await p.evaluate(() => { const l = window.__lobby; l.setFocus(window.__t.reads()); }); }
    const open_ = await until(p, () => window.__lobby.reader.state() === 'open', null, 90000);
    chk(1, open_, `READ (${how}) opens the article`);
    if (!open_) return;
    read = true; const scan = await p.evaluate(() => window.__t.mark());
    await shot(p, '3-open');
    if (P.reducedMotion) {
      chk(6, scan.fanFound, "'ScanFan' exists in the scene (so that \"never visible\" means something)", { fan: scan.fanFound, sheet: scan.sheetFound });
      chk(6, !scan.fanSeen && !scan.sheetSeen, 'READ opens without ScanFan or ScanSheet ever being visible', { fanSeen: scan.fanSeen, sheetSeen: scan.sheetSeen, states: scan.states, samples: scan.n });
    } else {
      chk(2, scan.states.includes('scanning'), 'after READ the reader is scanning, then open', scan.states);
      chk(2, scan.both, 'ScanFan and ScanSheet are both visible while reader.state() is scanning', { fanFound: scan.fanFound, sheetFound: scan.sheetFound, fanSeen: scan.fanSeen, sheetSeen: scan.sheetSeen });
      chk(2, scan.maxUw !== null && scan.maxUw > 0.5, 'the glyph says SCANNING during the scan (uWord rises)', { maxUWord: scan.maxUw });
      chk(2, scan.maxUp !== null && scan.maxUp > 0.5, 'the glyph shows the scan\'s progress (uProgress rises)', { maxUProgress: scan.maxUp });
      // once open and settled, the scan is gone again
      const calm = await until(p, () => !!window.__t.reads()?.calm?.(), null, 60000); await p.waitForTimeout(500);
      await p.evaluate(() => window.__t.mark()); await p.waitForTimeout(1500); const after = await p.evaluate(() => window.__t.mark());
      const bm = await p.evaluate(async () => { const m = window.__t.obj('ReadBeam')?.material?.uniforms; if (!m) return null; const g = () => [m.uK?.value, m.uFlow?.value]; const a = g(); await new Promise((r) => setTimeout(r, 1500)); return { before: a, after: g() }; });
      chk(2, !!bm && bm.before.every((x) => typeof x === 'number') && bm.before.every((x, i) => Math.abs(x - bm.after[i]) < 1e-4), "once open and calm, the beam's uK and uFlow (ReadBeam) are unchanged over 1.5 s", bm ?? "no 'ReadBeam' with uniforms");
      chk(2, calm && !after.fanSeen && !after.sheetSeen, 'once open and settled, ScanFan and ScanSheet are not visible', { settled: calm, fanSeen: after.fanSeen, sheetSeen: after.sheetSeen });
    }
    await p.keyboard.press('Escape'); if (phone) await poke(p, '.reader-close');
    await until(p, () => window.__lobby.reader.state() === 'closed', null, 20000); await p.waitForTimeout(500);
  });

  // ---- 7. after the first inspect the hint is gone, in the room and in the next
  await guard(7, 'the hint after the first inspect', async () => {
    const st = await state(p), sh = await hintShown(p);
    chk(7, !!st && st.hint === '', 'after the first inspect display.state().hint is empty', st?.hint ?? 'no display.state()');
    chk(7, sh !== true, 'and the hint is not on the screen', sh === null ? 'no #hud .hint (gone)' : sh);
    const there = await goRoom(p, 'projects');
    chk(7, there, 'went on to Fabrication (no page load)');
    await p.waitForTimeout(1500); const s2 = await state(p), sh2 = await hintShown(p);
    chk(7, !!s2 && s2.hint === '', 'in the next room the hint is still gone', s2?.hint ?? 'no display.state()');
    chk(7, sh2 !== true, 'and not on the screen there either', sh2 === null ? 'no #hud .hint (gone)' : sh2);
  });

  // ---- Fabrication: 3 the lock (desktop, reduced), 5 a tap and the bar (phone), 1 an exhibit in focus
  await guard(3, 'Fabrication', async () => {
    await p.evaluate(() => window.__lobby.setFocus(null)); await settle(p, 60000);
    await shot(p, '4-fab');
    const all = await cands(p), good = all.filter((c) => c.ok);
    if (good.length < all.length) note(`Fabrication: ${all.length - good.length} of ${all.length} picks cannot be pointed at from the room's view (behind another pick, off screen or too big); they are skipped: ${all.filter((c) => !c.ok).map((c) => `#${c.i} ${c.type}${c.self ? '' : ' (covered)'}${c.behind ? ' (off view)' : ''}`).join(', ')}`);
    chk(3, 'at least two picks of Fabrication can be pointed at (the test can run)', { picks: all.length, pointable: good.length });
    if (phone) {
      // 5. a tap brings no lock, ever (the poller samples every 8 ms), and still focuses the pick
      const c = good[0]; if (!c) return;
      await p.evaluate(() => window.__t.mark()); await p.touchscreen.tap(c.x, c.y);
      const named = await until(p, (n) => window.__lobby.display?.state().named === n && !!n, c.name, 25000);
      await p.waitForTimeout(1200); const rec = await p.evaluate(() => window.__t.mark()), st = await state(p);
      chk(5, !rec.lockEver && !st?.lock, 'a tap brings no lock (not at any moment)', { everShown: rec.lockEver, lock: st?.lock ?? null, samples: rec.n });
      chk(5, named, `the tap focused the pick and the bar names it (${c.name})`, st?.named ?? 'no display.state()');
      await settle(p, 60000); await shot(p, '5-tapped');
      // the bar's name: shown, inside the window, and nothing moves as the tour steps
      const first = await barBox(p); const nextLeft = first.next?.l, prevLeft = first.prev?.l;
      chk(5, first.named?.shown === true && first.named?.inside === true, '#named is visible and inside the window', first.named);
      const seen = [];
      for (let k = 0; k < 6; k++) {
        const before = (await barBox(p)).count?.text;
        const ok = await poke(p, '#next'); if (ok !== true) { chk(5, false, 'the test could press #next', ok); break; }
        await until(p, (t) => document.querySelector('#count')?.textContent !== t, before, 30000); await p.waitForTimeout(500);
        const bx = await barBox(p), s = await state(p); seen.push({ k, next: bx.next?.l, prev: bx.prev?.l, named: bx.named, st: s?.named });
      }
      chk(5, seen.length > 0 && seen.every((q) => q.next !== undefined && Math.abs(q.next - nextLeft) < 0.5 && Math.abs(q.prev - prevLeft) < 0.5), '#next and #prev stay at the same x while the tour is stepped', { first: [prevLeft, nextLeft], steps: seen.map((q) => [q.prev, q.next]) });
      chk(5, seen.every((q) => q.named?.shown && q.named.inside), '#named is visible and inside the window at every stop', seen.filter((q) => !q.named?.shown || !q.named.inside).map((q) => ({ k: q.k, named: q.named })));
      chk(5, seen.every((q) => q.named?.text && q.named.text === q.st), '#named says the name of the pick in focus at every stop', seen.map((q) => [q.named?.text, q.st]));
      chk(5, seen.every((q) => !q.named?.over || (q.named.title && q.named.title.length >= q.named.text.length)), 'a name that is cut is carried whole in its title', seen.filter((q) => q.named?.over).map((q) => [q.named.text, q.named.title]));
      const lens = seen.map((q) => q.named?.text?.length ?? 0); note(`names met on the tour (${Math.max(0, ...lens)} characters at most): ${seen.map((q) => q.named?.text).join(' | ')}`);
      await shot(p, '6-bar');
      return;
    }
    // 3. the lock: the pointer on a pick brings its name and verb; a click focuses it
    const empty = await emptyPoint(p);
    const sample = [good[0], good[Math.floor(good.length / 2)], good[good.length - 1]].filter((c, i, a) => c && a.findIndex((d) => d.i === c.i) === i).slice(0, P.reducedMotion ? 1 : 3);
    for (const c of sample) {
      await p.mouse.move(empty.x, empty.y, { steps: 4 }); await until(p, () => !window.__lobby.display?.state().lock, null, 15000);
      await p.mouse.move(c.x - 30, c.y - 30); await p.mouse.move(c.x, c.y, { steps: 6 });
      const got = await until(p, () => !!window.__lobby.display?.state().lock, null, 20000), st = await state(p), lk = st?.lock, tag = `pick ${c.i} (${c.type}, ${c.name ?? 'no name'})`;
      chk(3, got, `${tag}: the pointer on it brings the lock`, got ? '' : st ? 'lock stays null' : 'no display.state()');
      chk(3, !!lk && !!c.name && lk.name === c.name && lk.verb === c.verb, `${tag}: the lock names it and its verb`, { lock: lk ? [lk.name, lk.verb] : null, pick: [c.name, c.verb] });
      const [rl, rt, rw, rh] = lk?.rect ?? [0, 0, 0, 0];
      chk(3, !!lk && c.x >= rl - 0.5 && c.x <= rl + rw + 0.5 && c.y >= rt - 0.5 && c.y <= rt + rh + 0.5, `${tag}: its rect holds the pointer`, { rect: lk?.rect ?? null, at: [Math.round(c.x), Math.round(c.y)] });
      chk(3, !!lk && rl >= -0.5 && rt >= -0.5 && rl + rw <= W + 0.5 && rt + rh <= H + 0.5 && rw > 0 && rh > 0 && rw * rh <= 0.6 * W * H, `${tag}: its rect lies inside the window and covers at most 60% of it`, lk?.rect ?? null);
      const dom = await p.evaluate(({ x, y }) => { const e = document.getElementById('lock'); if (!e) return null; const t = e.querySelector('.lock-tag')?.getBoundingClientRect(), q = (s) => e.querySelector(s)?.textContent.trim() ?? null;
        const pe = [e, ...e.querySelectorAll('*')].filter((n) => getComputedStyle(n).pointerEvents !== 'none').length;
        return { hidden: e.hidden, aria: e.getAttribute('aria-hidden'), name: q('.lock-name'), verb: q('.lock-verb'), pe, top: document.elementFromPoint(x, y)?.id ?? document.elementFromPoint(x, y)?.tagName, tag: t && { l: t.left, t: t.top, r: t.right, b: t.bottom }, rect: [0] }; }, c);
      chk(3, !!dom && dom.hidden === false && dom.aria === 'true' && dom.name === c.name && dom.verb === c.verb, `${tag}: #lock is shown, aria-hidden, with .lock-name and .lock-verb`, dom ?? 'no #lock');
      chk(3, !!dom && dom.pe === 0 && dom.top === 'scene', `${tag}: nothing in #lock takes the pointer: what lies there is the canvas`, dom ? { notNone: dom.pe, top: dom.top } : 'no #lock');
      chk(3, !!dom?.tag && dom.tag.l >= -0.5 && dom.tag.t >= -0.5 && dom.tag.r <= W + 0.5 && dom.tag.b <= H + 0.5, `${tag}: the tag lies wholly inside the window`, dom?.tag ?? null);
      if (c === sample[0]) await shot(p, '7-lock');
      if (P.reducedMotion) {
        const tr = await p.evaluate(() => [document.getElementById('lock'), ...document.querySelectorAll('#lock *')].filter(Boolean).map((e) => { const cs = getComputedStyle(e), z = (s) => s.split(',').every((x) => parseFloat(x) === 0); return z(cs.transitionDuration) && z(cs.animationDuration) ? null : `${e.tagName.toLowerCase()}${e.className ? '.' + e.className : e.id ? '#' + e.id : ''}: transition ${cs.transitionDuration}, animation ${cs.animationDuration}`; }).filter(Boolean));
        chk(6, !!dom && tr.length === 0, 'with the lock shown, #lock and everything in it has a transition and animation duration of 0 s', dom ? tr : 'no #lock');
      }
      await p.mouse.move(empty.x, empty.y, { steps: 4 });
      const gone = await until(p, () => !window.__lobby.display?.state().lock, null, 20000), st2 = await state(p);
      chk(3, !!st2 && gone, `${tag}: off the pick the lock is null`, st2 ? '' : 'no display.state()');
    }
    // a press takes the lock away; a click focuses the pick
    const c = good[0]; if (!c) return;
    await p.mouse.move(c.x - 30, c.y - 30); await p.mouse.move(c.x, c.y, { steps: 6 });
    await until(p, () => !!window.__lobby.display?.state().lock, null, 20000);
    await p.mouse.down(); const pressedGone = await until(p, () => !window.__lobby.display?.state().lock, null, 8000);
    chk(3, pressedGone && !!(await state(p)), 'pressing on the pick takes the lock away', 'lock still shown, or no display.state()');
    await p.mouse.up();
    const named = await until(p, (n) => !!n && document.getElementById('named')?.textContent.trim() === n, c.name, 30000);
    chk(3, named, `the click focuses the pick: #named is its name (${c.name})`, await p.evaluate(() => document.getElementById('named')?.textContent ?? 'no #named'));
    const cnt = await p.evaluate(() => document.getElementById('count')?.textContent.trim()), mm = /^(\d+) \/ (\d+)$/.exec(cnt ?? '');
    chk(3, !!mm && +mm[1] >= 1 && +mm[1] <= +mm[2], '#count says "i / n"', cnt);
    chk(3, !(await state(p))?.lock, 'after the click the lock is null', JSON.stringify((await state(p))?.lock ?? null));
    await settle(p, 90000); await p.waitForTimeout(600);
    const resting = await state(p);
    chk(3, !!resting && !resting.lock && resting.named === c.name, 'with the pointer resting on the pick in focus there is no lock, and the display still names it', resting);
    await shot(p, '8-clicked');
  });

  // ---- 1. an exhibit (a source in Fabrication; the wall cards are not picks) in focus is as quiet as the held volume (desktop)
  if (!phone && !P.reducedMotion) await guard(1, 'an exhibit in Fabrication', async () => {
    const i = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.source && !q.reads));
    chk(1, i >= 0, 'Fabrication has a pick that offers something to read', i);
    if (i < 0) return;
    await p.evaluate((i) => { const l = window.__lobby; l.setFocus(null); l.setFocus(l.picks[i]); }, i);
    chk(1, await glyphLive(p), 'an exhibit in focus: the READ glyph is live and shown');
    await p.mouse.move(W - 4, 4); const calm = await settle(p); chk(1, calm, 'an exhibit in focus: the display comes to rest');
    await shot(p, '9-exhibit');
    const sh = await p.evaluate(() => window.__t.shaders());
    chk(1, !!sh && !sh.keys.includes('uTime') && !/uTime/.test(sh.frag + sh.vert), "an exhibit in focus: the glyph's material takes no uTime", sh ? { uniforms: sh.keys } : 'no glyph material');
    const w = await p.evaluate(() => window.__t.watch(1500));
    for (const k of ['uShow', 'uWord', 'uHover', 'uProgress']) { const known = w.lo[k] !== undefined; chk(1, known && Math.abs(w.hi[k] - w.lo[k]) < 1e-3, `an exhibit in focus: ${k} is unchanged over 1.5 s`, known ? { min: +w.lo[k].toFixed(4), max: +w.hi[k].toFixed(4) } : 'the uniform does not exist'); }
    chk(1, !!(await state(p)) && !w.changed, 'an exhibit in focus: display.state() is the same over 1.5 s');
    await p.evaluate(() => window.__t.mark()); await p.waitForTimeout(3000); const idle = await p.evaluate(() => window.__t.mark());
    chk(2, !idle.fanSeen && !idle.sheetSeen, 'an exhibit in focus 3 s with nothing asked: ScanFan and ScanSheet are not visible', { fanSeen: idle.fanSeen, sheetSeen: idle.sheetSeen });
  });

  // ---- 4. names and verbs, in every room (desktop)
  if (!phone && !P.reducedMotion) await guard(4, 'names and verbs', async () => {
    const need = ['read', 'inspect', 'catalogue', 'choose', 'open', 'write', 'enter', 'stops', 'sealed'], missing = need.filter((k) => typeof D?.[k] !== 'string' || !D[k]);
    chk(4, !!D && missing.length === 0 && !!D.hint?.pointer && !!D.hint?.touch, 'content.json has a "display" object with the verbs, the catalogue name and the hint', D ? { missing } : 'no "display" in content.json');
    const verbs = new Set(need.filter((k) => k !== 'stops' && typeof D?.[k] === 'string').map((k) => D[k]));
    for (const [id, path] of ROOMS) {
      if (!(await goRoom(p, id))) { chk(4, false, `${path} opens (${id})`); continue; }
      await p.waitForTimeout(500);
      const picks = await p.evaluate(() => window.__lobby.picks.map((q, i) => ({ i, reads: !!q.reads, name: q.name ?? null, verb: q.verb ?? null, door: !!q.door, type: q.mesh?.geometry?.type ?? null })));
      const rest = picks.filter((q) => !q.reads), bad = rest.filter((q) => typeof q.name !== 'string' || !q.name.trim() || typeof q.verb !== 'string' || !q.verb.trim());
      chk(4, rest.length > 0 && bad.length === 0, `${path}: every pick (${rest.length}) has a non-empty name and verb`, bad.slice(0, 6).map((q) => `#${q.i} ${q.type} name=${JSON.stringify(q.name)} verb=${JSON.stringify(q.verb)}`));
      const loud = rest.filter((q) => q.name && q.verb && (q.name !== q.name.toUpperCase() || q.verb !== q.verb.toUpperCase()));
      chk(4, rest.length > 0 && loud.length === 0 && rest.every((q) => q.name), `${path}: names and verbs are in capitals, as shown`, loud.slice(0, 4).map((q) => [q.name, q.verb]));
      const odd = rest.filter((q) => q.verb && !verbs.has(q.verb) && !/^\d+ /.test(q.verb) && !(D?.stops && q.verb === D.stops));
      chk(4, rest.length > 0 && D && odd.length === 0, `${path}: every verb is one of content.json's display verbs (or "n STOPS")`, odd.slice(0, 4).map((q) => [q.name, q.verb]));
      for (const q of picks.filter((x) => x.reads)) chk(4, q.name === '', `${path}: the reading pick has the name ''`, JSON.stringify(q.name));
      // 7. the hint: Navigation's own words until its map has been turned by hand; in every other room the visitor has inspected something, so none
      const hs = (await state(p))?.hint, own = content.rooms[id].hint?.pointer;
      chk(7, hs === (own ?? ''), own ? `${path}: the room's own hint stands (the map has not been turned by hand)` : `${path}: no hint (something has been inspected)`, hs);
      const cue = (await state(p))?.cue;      // (the Library's, on a new visit, comes once the view is wide: it may or may not be there yet)
      chk(4, id === 'writing' ? cue === null || cue.words === D.cue?.pointer || cue.name === D.catalogue : cue === null, `${path}: ${id === 'writing' ? 'the cue, if there, is the catalogue\'s' : 'no cue stands on anything (only the Library has one)'}`, cue);
    }
    // the named exhibits of the Lounge and Fabrication, and the terminal
    await goRoom(p, 'writing'); const term = await p.evaluate(() => { const q = window.__lobby.picks.find((x) => x.options); return q ? [q.name, q.verb] : null; });
    chk(4, !!D && term?.[0] === D.catalogue && term?.[1] === D.choose, "the Library's terminal is the catalogue: it chooses a volume", term);
    await goRoom(p, 'comms'); const cm = await p.evaluate(() => { const q = window.__lobby.picks.find((x) => x.cta); return q ? [q.name, q.verb, document.querySelector('#comms')?.dataset.mode] : null; });
    chk(4, !!D && cm?.[0] === content.rooms?.comms?.comms?.title.toUpperCase() && cm?.[1] === (cm?.[2] === 'links' ? D.open : D.write), "Comms' field is named by comms.title (upper case) and says OPEN (links only) or WRITE (a message box: mail or send)", cm);
    await goRoom(p, 'lobby'); const dr = await p.evaluate(() => window.__lobby.picks.filter((q) => q.door).map((q) => [q.door.label, q.name, q.verb, !!q.door.stops, !!q.door.to]));
    chk(4, !!D && dr.length > 0 && dr.every(([label, n, v, st, to]) => n === label && (v === (st ? D.stops.replace('{n}', '') : to ? D.enter : D.sealed) || (st && /^\d+ /.test(v)))), "Atrium's doors are named by their label and say ENTER, n STOPS or sealed", dr);
    await shot(p, 'atrium');
  });

  // ---- 8. nothing went wrong
  chk(8, errs.length === 0, 'no console error, page error or failed request', errs.slice(0, 5));
  await ctx.close();
}

const todo = which === 'all' ? ['desktop', 'phone', 'reduced'] : [which];
const t0 = Date.now();
for (const n of todo) { if (!PROFILES[n]) { console.log(`unknown profile ${n} (desktop|phone|reduced|all)`); process.exitCode = 1; continue; } try { await run(n); } catch (e) { profile = n; chk(0, false, 'the run could not go on', String(e.message).split('\n')[0]); } }
await b.close();
console.log('\n=== summary');
for (const it of [...new Set(results.map((r) => r.item))].sort((a, b) => a - b)) {
  const rs = results.filter((r) => r.item === it), bad = rs.filter((r) => !r.ok);
  console.log(`item ${it}: ${bad.length ? 'FAIL' : 'PASS'} (${rs.length - bad.length}/${rs.length})${bad.map((r) => `\n    [${r.profile}] ${r.what}${r.detail !== '' ? ' — ' + (typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)) : ''}`).join('')}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} ok, ${failed} FAIL of ${results.length} checks in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exitCode = failed ? 1 : 0;
console.log(failed ? 'hud FAILED' : 'hud ok');
