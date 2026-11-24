// cue.mjs [desktop|phone|reduced|all]: the Library's cue on the terminal, and the drone's errand (the owner: "add a HUD hint that clicking the terminal allows for reading a book, make this
// subtle but noticeable. Also speed up the drone getting the book").
//   C  the cue (js/hud.js, `#cue`, display.state().cue = { name, words, rect }): it stands on the terminal's screen (its marks
//      are the projected corners of the screen mesh, 6 px out) with a tag CATALOGUE | CLICK TO CHOOSE A BOOK (TAP ... on a phone: rooms.writing.cue); its words and side do not change as
//      the view sways, and the tag is clear of the page's words; it is gone when the lock is on anything and while the terminal is in focus, and for good (this visit) after the terminal
//      has been in focus; a new visit to the room shows it again; a press on the tag's own words opens the terminal (a click, or a tap on a phone); so does a click on the terminal
//   D  the drone: from the press on the farthest title to __lobby.held() being its slug, in the station's own seconds (uTime: capped per frame, so a slow machine gives the same), is at most 5.5 s
//      (it was 7.0 to 9.6; the build measured 3.5 to 4.7 at 1280 x 720)
// "ok" / "FAIL [profile item] what"; exit code 1 if any check failed.
import { PROFILES, load, suite, launch, context, open, inRoom, until, poke, snap } from './rooms.kit.mjs';
import { sleep, camStill, dstate } from './r2.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('cue'), { chk, note } = S;
const { content } = await load(), D = content.display, CUE = content.rooms.writing.cue;
const b = await launch();

/** In one go: the cue's state, the DOM of #cue, the terminal's screen mesh projected, which side of the marks the tag is on, and whether it meets the page's words. */
const cueNow = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, s = l.display.state(), q = l.picks.find((x) => x.options), m = q.mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
  if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const { min, max } = m.geometry.boundingBox; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(m.matrixWorld).project(l.camera), x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const e = document.querySelector('#cue'), t = e?.querySelector('.lock-tag').getBoundingClientRect(), r = s.cue?.rect, rg = document.createRange(), zones = [];
  for (const el of document.querySelectorAll('#hud .hero > *, #hud > header > *, #hud > footer > *')) { let b = el.getBoundingClientRect(); if (el.matches('p') && b.width) { rg.selectNodeContents(el); b = rg.getBoundingClientRect(); } if (b.width && b.height) zones.push(b); }
  const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const side = !t || !r ? null : t.top >= r[1] + r[3] - 1 ? 'under' : t.left >= r[0] + r[2] - 1 ? 'right' : t.right <= r[0] + 1 ? 'left' : 'over';
  return { cue: s.cue, lock: s.lock, named: s.named, term: { l: x0, t: y0, r: x1, b: y1 }, shown: !!e && !e.hidden, name: e?.querySelector('.lock-name').textContent, verb: e?.querySelector('.lock-verb').textContent, side,
    tag: t && { l: t.left, t: t.top, r: t.right, b: t.bottom }, meets: !!t && zones.some((z) => meets(t, z)), lockShown: !document.querySelector('#lock').hidden };
});
const onTerminal = (c, tol = 2.5, pad = 6) => { const [x, y, w, h] = c.cue.rect, a = c.term; return Math.abs(x - (a.l - pad)) <= tol && Math.abs(y - (a.t - pad)) <= tol && Math.abs(x + w - (a.r + pad)) <= tol && Math.abs(y + h - (a.b + pad)) <= tol; };
const opened = (p) => until(p, () => document.querySelectorAll('#ways.list [data-option]').length > 0 && !window.__lobby.display.state().gliding, null, 90000);

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, still = !!P.reducedMotion, W = P.viewport.width, H = P.viewport.height, errs = [], kind = phone ? 'touch' : 'pointer';
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P);
  const p = await open(ctx, '/blog/?rollat=20', 'writing', errs, { pin: false }); await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
  chk('C', 'cue' in (await dstate(p)), 'display.state() has a `cue` key (null or { name, words, rect })');
  chk('C', await until(p, () => !!window.__lobby.display.state().cue, null, 240000), 'the camera has come to the wide view and the cue stands on the terminal');
  await sleep(1500); const c0 = await cueNow(p);
  chk('C', c0.cue?.name === D.catalogue && c0.cue?.words === CUE[kind], `its tag says ${D.catalogue} | ${CUE[kind]}`, c0.cue);
  chk('C', c0.shown && c0.name === D.catalogue && c0.verb === CUE[kind] && !c0.lockShown, '#cue is on the page with those words, and #lock is not', { shown: c0.shown, name: c0.name, verb: c0.verb, lock: c0.lockShown });
  chk('C', !!c0.cue && onTerminal(c0), "its marks lie on the terminal's screen: the projected corners of the screen mesh, 6 px out", { rect: c0.cue?.rect, terminal: c0.term });
  const [, , cw, ch] = c0.cue?.rect ?? [0, 0, 0, 0]; note(`the terminal on the screen: ${Math.round(cw - 12)} x ${Math.round(ch - 12)} CSS px`);
  chk('C', !c0.meets, "the tag does not meet the page's words", c0.tag);
  // the view sways: look again over a while; the marks follow the terminal, the words and the side do not change
  let still_ = true; const seen = [c0];
  for (let i = 0; i < 4; i++) { await sleep(1300); seen.push(await cueNow(p)); }
  chk('C', seen.every((c) => c.cue && onTerminal(c)), 'over 5 looks as the view sways, the marks stay on the terminal', seen.map((c) => c.cue && [c.cue.rect.map(Math.round), Object.values(c.term).map(Math.round)]));
  chk('C', seen.every((c) => c.cue?.words === c0.cue?.words && c.side === c0.side), 'the tag\'s words and its side do not change', seen.map((c) => [c.side, c.cue?.words]));
  chk('C', seen.every((c) => !c.meets), "and it never meets the page's words", seen.map((c) => c.tag));
  void still_;
  if (still) chk('C', await p.evaluate(() => [...document.querySelectorAll('#cue, #cue *')].every((e) => { const cs = getComputedStyle(e), z = (s) => s.split(',').every((x) => parseFloat(x) === 0); return z(cs.transitionDuration) && z(cs.animationDuration); })), 'reduced motion: #cue has no transition or animation');
  await p.screenshot({ path: `/out/cue-${name}-wide.png` }).catch(() => {});

  if (!phone) {
    // the lock on anything: the cue stands aside; off it again, it returns
    let r = c0.cue.rect; for (let i = 0; i < 12; i++) { const at = [r[0] + r[2] / 2, r[1] + r[3] / 2]; await p.mouse.move(...at, { steps: 4 }); await sleep(900); const s = await dstate(p); r = (s.lock ?? s.cue)?.rect ?? r; if (s.lock && Math.hypot(r[0] + r[2] / 2 - at[0], r[1] + r[3] / 2 - at[1]) < 6) break; }
    let s = await dstate(p); chk('C', !!s.lock && s.cue === null, 'the pointer on the terminal brings the lock, and the cue is gone (one set of marks at a time)', { lock: s.lock?.name, cue: s.cue });
    await p.mouse.move(W - 6, H / 2, { steps: 3 }); chk('C', await until(p, () => !window.__lobby.display.state().lock && !!window.__lobby.display.state().cue, null, 30000), 'the pointer away, the lock is gone and the cue is back (nothing was in focus)');
    // a press on the tag's own words opens the terminal
    let at = null; for (let i = 0; i < 10; i++) { const c = await cueNow(p); if (!c.tag) { await sleep(500); continue; } const nx = [(c.tag.l + c.tag.r) / 2, (c.tag.t + c.tag.b) / 2]; if (at && Math.hypot(nx[0] - at[0], nx[1] - at[1]) < 3) break; at = nx; await p.mouse.move(...at, { steps: 3 }); await sleep(800); }
    const cur = await p.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x, y)).cursor + '|' + document.elementFromPoint(x, y).className, at);
    chk('C', /lock-tag|lock-name|lock-verb/.test(cur) || /cue/.test(cur), 'the pointer on the tag\'s words is on the tag (and shows a pointer cursor)', cur);
    await p.mouse.down(); await p.mouse.up();
    chk('C', (await opened(p)) && (await dstate(p)).named === D.catalogue, 'a click on the tag\'s own words opens the terminal (the catalogue lists the volumes, the bar names it)', (await dstate(p)).named);
  } else {
    const c = await cueNow(p); await p.touchscreen.tap((c.tag.l + c.tag.r) / 2, (c.tag.t + c.tag.b) / 2);
    chk('C', (await opened(p)) && (await dstate(p)).named === D.catalogue, 'a tap on the tag\'s words opens the terminal (the terminal itself is only about 58 x 34 CSS px)', (await dstate(p)).named);
  }
  chk('C', (await dstate(p)).cue === null, 'with the terminal in focus there is no cue');
  await p.screenshot({ path: `/out/cue-${name}-open.png` }).catch(() => {});

  // ---------------------------------------------------------------- D. the drone
  if (!phone && !still) {
    const far = await p.evaluate(() => window.__lobby.volumes().length - 1), slug = await p.evaluate((i) => window.__lobby.volumes()[i].slug, far);
    const now = () => p.evaluate(async () => (await import('/js/kit.js')).uTime.value), t0 = await now();
    chk('D', (await poke(p, `#ways [data-option="${far}"]`, false)) === true, `the farthest title (${slug}) is pressed`);
    const got = await until(p, (s) => window.__lobby.held() === s, slug, 150000), took = (await now()) - t0;
    chk('D', got && took <= 5.5, `from the press to the book held: ${took.toFixed(2)} station seconds (at most 5.5; it was 7.0 to 9.6)`, took);
    note(`the farthest shelf: ${took.toFixed(2)} s of the station's clock`);
  }
  // ---------------------------------------------------------------- C. the cue is spent once the terminal has been in focus; a new visit shows it again
  await p.evaluate(() => window.__lobby.setFocus(null)); await camStill(p); await sleep(2500);
  chk('C', (await dstate(p)).cue === null, 'the terminal has been in focus: back in the wide view the cue does not return (this visit)', (await dstate(p)).cue);
  if (!phone && !still) {
    await p.evaluate(() => window.__lobby.enter('lobby')); await inRoom(p, 'lobby', 240000); await p.evaluate(() => window.__lobby.enter('writing')); await inRoom(p, 'writing', 240000);
    await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
    chk('C', await until(p, () => !!window.__lobby.display.state().cue, null, 240000), 'a new visit to the room (the picks are rebuilt) shows the cue again');
    // a click on the terminal itself
    let r = (await dstate(p)).cue.rect;
    for (let i = 0; i < 14; i++) { const at = [r[0] + r[2] / 2, r[1] + r[3] / 2]; await p.mouse.move(...at, { steps: 4 }); await sleep(900); const s = await dstate(p); r = (s.lock ?? s.cue)?.rect ?? r; if (s.lock && Math.hypot(r[0] + r[2] / 2 - at[0], r[1] + r[3] / 2 - at[1]) < 6) break; }
    await p.mouse.down(); await p.mouse.up();
    chk('C', (await opened(p)) && (await dstate(p)).named === D.catalogue, 'and a click on the terminal itself opens it');
  }
  chk('C', errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 5));
  await ctx.close();
}
try { for (const n of which === 'all' ? ['desktop', 'phone', 'reduced'] : [which]) await run(n); } finally { await b.close(); }
S.finish();
