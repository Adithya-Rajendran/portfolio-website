// turn.mjs [desktop|phone|reduced|all]: Navigation's route map turns under the visitor's hand (js/routemap.js TURN, main.js turning()), and the room's hint.
//   1  the hooks: __lobby.turn has angle/front/settled/moving/byHand/heading/to/nudge/step/grip, the canvas is .turns here and not in Fabrication, the stations carry `station`
//   2  a drag across the room (mouse; a pen by synthetic pointer events; a finger by CDP touch on the phone) follows the pointer by 1/grip() rad a pixel, lets go and settles with a
//      station exactly at the front; less than 6 px, or mostly up and down, is not a turn; a fling coasts and then settles; a click right after a drag is not a click
//   3  a sideways wheel (deltaX), or Shift + a vertical wheel, turns it (and the page does not go "back"); a plain vertical wheel does not and is left to the page
//   4  focusing a station turns the map to it; the tour visits the stations in the line's order first; turning the map by hand with one in focus moves the focus to the one that
//      comes to the front; a wheel and then a station asked for ends on that station; a press that stops a coasting map leaves the station in focus
//   5  not from the nav or the bar, not while reading, not with the pointer moved bare over the room afterwards
//   6  reduced motion: a drag lands at once; a wheel steps a station at a time; a station asked for is there at once
//   7  the hint: the room's own words (DRAG TO TURN THE MAP ... / SWIPE TO TURN THE MAP) until the map has been turned by hand, then the general one until something is inspected, then none
//   8  Fabrication has no turn (null) and its canvas no `turns`; no error through the run
// "ok" / "FAIL [profile item] what"; exit code 1 if any check failed. The synthetic pointermove carries buttons: 1 (main.js lets go of a hand with no button down).
import { PROFILES, load, suite, launch, context, open, inRoom, until, snap, readNow, leave } from './rooms.kit.mjs';
import { sleep, dstate, pickPoint, canvasPoint, pen } from './r2.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('turn'), { chk, note } = S;
const { content } = await load(), D = content.display, HINT = content.rooms.experience.hint;
const b = await launch();

const TS = (p) => p.evaluate(() => { const t = window.__lobby.turn, d = window.__lobby.display.state(); return { a: t.angle(), front: t.front(), settled: t.settled(), moving: t.moving(), hand: t.byHand(), head: t.heading(), named: d.named, hint: d.hint, grip: t.grip(), gliding: d.gliding }; });
const rested = (p, t = 90000) => until(p, () => window.__lobby.turn.settled() && !window.__lobby.display.state().gliding, null, t);
/** The map is at rest with station k at the front and the camera has arrived (a frame must have run since the focus changed: wait for the front itself, not for "at rest"). */
const onStation = (p, k, t = 90000) => until(p, (k) => window.__lobby.turn.front() === k && window.__lobby.turn.settled() && !window.__lobby.display.state().gliding, k, t);
const wrap = (x) => { const T = 2 * Math.PI; return x - T * Math.round(x / T); };
/** A synthetic wheel event on the canvas, as one event: [defaultPrevented, deltaX, deltaY, shift]. */
const wheel = (p, dx, dy, shift = false) => p.evaluate(([dx, dy, shift]) => { const e = new WheelEvent('wheel', { deltaX: dx, deltaY: dy, shiftKey: shift, bubbles: true, cancelable: true, clientX: innerWidth * 0.6, clientY: innerHeight * 0.4 }); document.querySelector('#scene').dispatchEvent(e); return e.defaultPrevented; }, [dx, dy, shift]);

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, still = !!P.reducedMotion, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P), kind = phone ? 'touch' : 'pointer';
  const p = await open(ctx, '/experience/', 'experience', errs);
  await until(p, () => window.__lobby.ready() >= 1 && !!window.__lobby.turn && window.__lobby.picks.length > 0, null, 60000);
  const cdp = phone ? await ctx.newCDPSession(p) : null;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const stations = await p.evaluate(() => window.__lobby.picks.map((q, i) => ({ i, s: q.station, name: q.name })).filter((q) => q.s != null).sort((a, b) => a.s - b.s)), N = stations.length;

  // ---------------------------------------------------------------- 1. the hooks
  const hooks = await p.evaluate(() => { const t = window.__lobby.turn; return ['angle', 'front', 'settled', 'moving', 'byHand', 'heading', 'to', 'nudge', 'step', 'grip'].filter((k) => typeof t?.[k] !== 'function'); });
  chk(1, hooks.length === 0, '__lobby.turn has angle, front, settled, moving, byHand, heading, to, nudge, step and grip', hooks);
  chk(1, N > 1 && stations.every((q, i) => q.s === i), `the stations' picks carry station 0..${N - 1}`, stations.map((q) => q.s));
  chk(1, await p.evaluate(() => document.querySelector('#scene').classList.contains('turns')) && /pan-y/.test(await p.evaluate(() => getComputedStyle(document.querySelector('#scene')).touchAction)), 'the canvas is .turns here, and its touch-action leaves up and down (pan-y) to the browser');
  const t0 = await TS(p);
  chk(1, t0.settled && !t0.hand && t0.named === '', 'at the start the map is at rest, not turned by hand, nothing in focus', t0);

  // ---------------------------------------------------------------- 7. the hint, before anything is turned
  chk(7, t0.hint === HINT[kind] && !!HINT[kind], `at the start the hint is the room's own (${kind}): "${HINT[kind]}"`, t0.hint);
  chk(7, (await p.evaluate(() => document.querySelector('#hud .hint .how')?.textContent)) === HINT[kind], 'and it is on the page', await p.evaluate(() => document.querySelector('#hud .hint .how')?.textContent));

  // the angle of each station at the front (the map put there at once; nothing is by hand after it)
  const home = []; for (const q of stations) { await p.evaluate((s) => window.__lobby.turn.to(s, true), q.s); home.push((await TS(p)).a); } await p.evaluate(() => window.__lobby.turn.to(0, true));
  const near = (i, a) => home[i] + 2 * Math.PI * Math.round((a - home[i]) / (2 * Math.PI)), nearest = (a) => stations.map((q, i) => [i, Math.abs(near(i, a) - a)]).sort((x, y) => x[1] - y[1])[0][0];
  chk(2, (await TS(p)).front === 0 && (await TS(p)).settled && !(await TS(p)).hand, 'turn.to(i, true) puts station i at the front at once, at rest, and is not "by hand"');
  const gap = Math.abs(wrap(home[1] - home[0]));
  note(`stations at ${home.map((a) => a.toFixed(2)).join(', ')} rad; grip ${(await TS(p)).grip.toFixed(0)} px per rad`);

  // ---------------------------------------------------------------- 2. a drag
  const spot = await canvasPoint(p, 0.62, 0.3), X0 = Math.round(spot.x), Y0 = Math.round(spot.y);
  /** A drag across the room from (X0, Y0): n moves of dx each (dy: a little up or down), then (after still ms with nothing moving) let go. Returns the angle before, during, after. */
  async function drag(how, n, dx, dy = 0, hold = 160) {
    const sign = dx < 0 ? 1 : -1, x0 = sign > 0 ? X0 + 90 : X0 - 90;                      // (room to move on either side)
    const before = await TS(p); let during;
    const at = (i) => [x0 + i * dx, Y0 + (i * dy) / Math.max(1, n)];
    if (how === 'mouse') { await p.mouse.move(...at(0)); await p.mouse.down(); for (let i = 1; i <= n; i++) { await p.mouse.move(...at(i)); await sleep(20); } during = await TS(p); await sleep(hold); await p.mouse.up(); }
    else if (how === 'pen') { await pen.down(p, ...at(0)); for (let i = 1; i <= n; i++) { await pen.move(p, ...at(i)); await sleep(20); } during = await TS(p); await sleep(hold); await pen.up(p, ...at(n)); }
    else { await touch('touchStart', ...at(0)); for (let i = 1; i <= n; i++) { await touch('touchMove', ...at(i)); await sleep(20); } during = await TS(p); await sleep(hold); await touch('touchEnd'); }
    return { before, during, dist: n * dx };
  }
  for (const how of phone ? ['touch'] : ['mouse', 'pen']) {
    await p.evaluate(() => window.__lobby.turn.to(0, true)); await sleep(300);
    const px = Math.round(gap * (await TS(p)).grip * 0.7 / 8), r = await drag(how, 8, -px);       // 0.7 of a gap to the left, in 8 moves
    const want = r.dist / r.before.grip, got = r.during.a - r.before.a;
    chk(2, r.during.hand && !r.during.settled && Math.abs(got - want) <= Math.abs(want) * 0.12 + 0.01 && Math.sign(got) === Math.sign(want), `${how}: while the pointer is down the map follows it: ${(got).toFixed(3)} rad for ${r.dist} px (grip ${r.before.grip.toFixed(0)}: ${want.toFixed(3)})`, { got, want });
    const target = r.before.a + got; await sleep(100);
    const ok = await until(p, () => window.__lobby.turn.settled(), null, 60000), s = await TS(p);
    chk(2, ok && s.head === s.front && Math.abs(near(s.front, s.a) - s.a) < 1e-3, `${how}: let go, it settles with a station exactly at the front (${s.front})`, s);
    chk(2, s.front === nearest(target), `${how}: and it is the station nearest to where the drag left it (${nearest(target)})`, { front: s.front, from: r.before.a, to: target });
    if (still) chk(6, true, 'a drag lands');
  }
  // less than 6 px; mostly vertical; and the slope
  {
    await p.evaluate(() => window.__lobby.turn.to(0, true)); const a0 = (await TS(p)).a;      // (to() clears "by hand")
    await pen.down(p, X0, Y0); await pen.move(p, X0 - 5, Y0); let s = await TS(p); chk(2, s.a === a0 && !s.hand, 'a move of 5 px is not a turn (it is a click)', s.a - a0);
    await pen.move(p, X0 - 12, Y0); s = await TS(p); chk(2, s.a !== a0 && s.hand, 'a move past 6 px sideways is', s.a - a0); await sleep(150); await pen.up(p, X0 - 12, Y0); await until(p, () => window.__lobby.turn.settled(), null, 60000);
    await p.evaluate(() => window.__lobby.turn.to(0, true)); const a1 = (await TS(p)).a;
    await pen.down(p, X0, Y0); await pen.move(p, X0 - 10, Y0 + 14); await pen.move(p, X0 - 90, Y0 + 15); s = await TS(p);
    chk(2, s.a === a1 && s.settled, 'a move mostly up and down is not a turn, and the hand then lets go for good (more sideways afterwards does nothing)', s.a - a1); await pen.up(p, X0 - 90, Y0 + 15);
  }
  // a fling coasts, then settles; a click right after a drag is not a click
  if (!phone) {
    await p.evaluate(() => window.__lobby.turn.to(0, true)); await sleep(300); const a0 = (await TS(p)).a;
    await p.mouse.move(X0 + 140, Y0); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(X0 + 140 - i * 40, Y0); await sleep(16); } await p.mouse.up();
    const flung = await p.evaluate(() => window.__lobby.turn.moving() || !window.__lobby.turn.settled());
    const ok = await until(p, () => window.__lobby.turn.settled(), null, 60000), s = await TS(p);
    chk(2, still ? true : flung, 'a fling: let go while moving, the map carries on (coasts)', flung);
    chk(2, ok && s.head === s.front && (still || Math.abs(s.a - a0) >= (320 / s.grip) * 0.8) && Math.sign(s.a - a0) === -1, 'and settles on a station, further the same way (left) than the drag alone took it', { from: a0, to: s.a, drag: 320 / s.grip });
    // a click right after a drag is not a click: press on a station's own pick, drag across, let go
    await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p);
    let pt = null, k = -1; for (const q of stations) { const c = await pickPoint(p, q.i); if (c.inside && c.reaches && c.top === 'scene') { pt = c; k = q.i; break; } }
    if (!pt) note('no station can be pressed from the room\'s own view: the click-after-drag check was not made');
    else {
      await p.mouse.move(pt.x, pt.y); await p.mouse.down(); for (let i = 1; i <= 6; i++) { await p.mouse.move(pt.x - i * 8, pt.y); await sleep(20); } await sleep(150); await p.mouse.up();
      await until(p, () => window.__lobby.turn.settled(), null, 60000); await sleep(700);
      chk(2, (await TS(p)).named === '', 'a press on a station that is dragged across (and let go) is not a click: nothing is focused');
      const again = await pickPoint(p, k);
      if (again.inside && again.reaches) { await p.mouse.click(again.x, again.y); chk(2, await until(p, () => !!window.__lobby.display.state().named, null, 20000), 'while a plain click on a station focuses it (the same press, not dragged)'); }
      else note('the station moved from under the pointer; the plain click was not made');
      await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p);
    }
  }

  // ---------------------------------------------------------------- 3. the wheel (a synthetic event: one event, one answer)
  {
    await p.evaluate(() => window.__lobby.turn.to(0, true)); await sleep(300); await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p);
    const y0 = await p.evaluate(() => scrollY);
    const a0 = (await TS(p)).a, pv = await wheel(p, 0, 200); let s = await TS(p);
    chk(3, !pv && s.a === a0, 'a plain vertical wheel does not turn the map, and is not taken from the page (not prevented)', { moved: s.a - a0, prevented: pv });
    if (!still) {
      const sh = await wheel(p, 0, 100, true); s = await TS(p);
      chk(3, sh && Math.abs((s.a - a0) - (-100 * 0.005)) < 1e-6 && s.hand, 'Shift + a vertical wheel turns it (-0.5 rad for 100 px: scrolling on carries the line the other way) and takes the event', { moved: s.a - a0, prevented: sh });
      await until(p, () => window.__lobby.turn.settled(), null, 60000);
      const b0 = (await TS(p)).a; let all = true; for (let i = 0; i < 5; i++) all = (await wheel(p, 60, 0)) && all; s = await TS(p);
      chk(3, all && Math.abs((s.a - b0) - (-300 * 0.005)) < 1e-6 && !s.settled, 'a sideways wheel (5 x 60 px) turns it 1.5 rad and takes every event (no "back" in the browser history)', { moved: s.a - b0, prevented: all });
      const ok = await until(p, () => window.__lobby.turn.settled(), null, 60000); s = await TS(p);
      chk(3, ok && s.head === s.front, 'its last event 160 ms behind, it settles with a station at the front', s);
      // the real wheel, through the browser
      await p.mouse.move(W * 0.6, H * 0.4); const c0 = (await TS(p)).a; for (let i = 0; i < 4; i++) { await p.mouse.wheel(80, 0); await sleep(30); }
      chk(3, await until(p, (a) => Math.abs(window.__lobby.turn.angle() - a) > 0.2, c0, 20000), 'and a real sideways wheel (Playwright mouse.wheel) turns it too');
      await until(p, () => window.__lobby.turn.settled(), null, 60000);
    } else {
      const f0 = (await TS(p)).front;
      await wheel(p, 50, 0); await wheel(p, 50, 0); s = await TS(p);
      chk(6, s.settled && s.front === (f0 + 1) % N && Math.abs(near(s.front, s.a) - s.a) < 1e-6, 'reduced motion: 100 px of sideways wheel steps the map one station, at once and at rest', { from: f0, to: s.front });
      await wheel(p, -100, 0); s = await TS(p); chk(6, s.settled && s.front === f0, 'and the other way steps it back', { front: s.front });
      await wheel(p, 0, 100, true); s = await TS(p); chk(6, s.front === (f0 + 1) % N, 'Shift + a vertical wheel does the same', { front: s.front });
    }
    chk(3, (await p.evaluate(() => scrollY)) === y0, 'the page itself did not scroll');
  }

  // ---------------------------------------------------------------- 4. the focus and the map
  if (N > 1) {
    await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p);
    // the tour: the stations in the line's order, then the rest
    await p.evaluate(() => { const l = window.__lobby; l.setFocus(null); });
    const order = []; for (let k = 0; k <= N; k++) { await p.evaluate(() => window.__lobby.step(1)); order.push(await p.evaluate(() => { const d = window.__lobby.display.state(), n = document.querySelector('#count').textContent; return [n, d.named, window.__lobby.picks.find((q) => q.name === d.named)?.station ?? null]; })); }
    chk(4, order.slice(0, N).every((o, k) => o[2] === k && o[0].startsWith(`${k + 1} / `)), `the tour visits the stations in the line's order (0 to ${N - 1}) first`, order.map((o) => o.join(' ')));
    chk(4, order[N][2] === null && order[N][0].startsWith(`${N + 1} / `), 'and then the rest of the room', order[N]);
    // a station asked for turns the map to it, with the camera
    for (const k of [N - 1, 1, 0]) {
      await p.evaluate((i) => window.__lobby.setFocus(window.__lobby.picks[i]), stations[k].i); const ok = await onStation(p, k); const s = await TS(p);
      chk(4, ok && s.front === k && !s.hand && s.named === stations[k].name, `focusing station ${k} turns the map to it (front ${s.front}) and the bar names it`, s);
    }
    // turning by hand with one in focus: the focus goes to the one that comes to the front
    await wheel(p, -240, 0); const got = await until(p, () => { const t = window.__lobby.turn; return t.front() !== 0; }, null, 60000); await until(p, () => window.__lobby.turn.settled() && !window.__lobby.display.state().gliding && window.__lobby.display.state().named === window.__lobby.picks.find((q) => q.station === window.__lobby.turn.front())?.name, null, 90000);
    { const s = await TS(p), who = stations[s.front]; chk(4, got && s.front !== 0 && s.hand && s.named === who?.name, `turning the map by hand with station 0 in focus moves the focus to the one that comes to the front (${s.front}: ${who?.name})`, s); }
    // a sideways wheel and then a station at once: it ends there
    await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p);
    for (let i = 0; i < 5; i++) await wheel(p, 60, 0);
    await p.evaluate((i) => window.__lobby.setFocus(window.__lobby.picks[i]), stations[0].i); await onStation(p, 0);
    { const s = await TS(p); chk(4, s.front === 0 && s.named === stations[0].name && !s.hand, 'a sideways wheel and then station 0 asked for at once ends with that station at the front and named in the bar', s); }
    // a fling, then a press on empty room while it coasts: the station stays in focus
    if (!phone && !still) {
      const e = await canvasPoint(p, 0.9, 0.12);
      await p.mouse.move(X0 + 140, Y0); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(X0 + 140 - i * 45, Y0); await sleep(16); } await p.mouse.up();
      const coasting = await p.evaluate(() => window.__lobby.turn.moving());
      await p.mouse.move(e.x, e.y); await p.mouse.down(); await sleep(60); await p.mouse.up(); await until(p, () => window.__lobby.turn.settled(), null, 60000); await rested(p);
      const s = await TS(p); chk(4, coasting, 'flung with a station in focus: the map coasts'); chk(4, s.named !== '', 'a press on empty room that stops the coasting map is not a click: a station is still in focus', s.named);
    }
  }

  // ---------------------------------------------------------------- 5. not from the nav, not while reading
  {
    await p.evaluate(() => window.__lobby.setFocus(null)); await rested(p); const a0 = (await TS(p)).a;
    if (!phone) {
      const nav = await p.locator('#hud nav a[data-view="0"]').boundingBox();
      await p.mouse.move(nav.x + 8, nav.y + nav.height / 2); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(nav.x + 8 + i * 6, nav.y + nav.height / 2); await sleep(20); } await p.mouse.up();
      for (let i = 1; i <= 12; i++) { await p.mouse.move(X0 - i * 30, Y0 + i); await sleep(20); }
      const s = await TS(p); chk(5, s.a === a0 && s.settled, 'a press that begins on the nav and is dragged across turns nothing, and the bare pointer moved over the room afterwards turns nothing', s.a - a0);
    }
    // while reading: a drag or a wheel does nothing, over the frame or anywhere
    await p.evaluate(() => window.__lobby.setFocus(window.__lobby.picks.find((q) => q.station === 1))); await rested(p);
    const rd = await readNow(p, phone, 'button', 90000); chk(5, rd.ok, 'a station is read (READ in the bar)');
    if (rd.ok) {
      await sleep(1500); const b0 = (await TS(p)).a, pv = await wheel(p, 300, 0);
      await p.evaluate(() => document.querySelector('#reader').dispatchEvent(new WheelEvent('wheel', { deltaX: 300, bubbles: true, cancelable: true })));
      if (!phone) { await p.mouse.move(X0 + 100, Y0); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(X0 + 100 - i * 30, Y0); await sleep(20); } await p.mouse.up(); }
      const s = await TS(p); chk(5, s.a === b0 && s.settled, 'while a station is read a sideways wheel and a drag across the room do not turn the map', { moved: s.a - b0, wheelPrevented: pv });
      await leave(p, phone); await until(p, () => window.__lobby.reader.state() === 'closed', null, 20000); await rested(p);
    }
  }

  // ---------------------------------------------------------------- 7. the hint, after
  {
    const s = await TS(p), inspected = N > 1;      // a station has been focused above
    chk(7, s.hint === '' || s.hint === D.hint[kind], 'after the map has been turned by hand the room\'s own hint is gone (the general one, or none once something is inspected)', s.hint);
    chk(7, !inspected || s.hint === '', 'and after a station has been inspected, none', s.hint);
    // a fresh page: the first turn by hand brings the general hint (nothing inspected yet)
    const q = await open(ctx, '/experience/', 'experience', errs); await until(q, () => window.__lobby.ready() >= 1 && !!window.__lobby.turn, null, 60000);
    chk(7, (await dstate(q)).hint === HINT[kind], 'a new visit starts with the room\'s hint again (it is remembered for the page\'s life only: a reload is a new page)');
    await q.evaluate(() => window.__lobby.turn.nudge(0.4)); await until(q, (h) => window.__lobby.turn.settled() && window.__lobby.display.state().hint === h, D.hint[kind], 60000);
    chk(7, (await dstate(q)).hint === D.hint[kind], 'the first turn by hand (nudge) puts the general hint in its place, while nothing has been inspected', (await dstate(q)).hint);
    chk(7, (await q.evaluate(() => document.querySelector('#hud .hint .how')?.textContent)) === D.hint[kind], 'on the page too');
    await q.close();
  }

  // ---------------------------------------------------------------- 8. other rooms
  await p.evaluate(() => window.__lobby.enter('projects'));
  const there = await inRoom(p, 'projects', 240000); await until(p, () => window.__lobby.ready() >= 1, null, 60000);
  chk(8, there && (await p.evaluate(() => window.__lobby.turn === null)) && !(await p.evaluate(() => document.querySelector('#scene').classList.contains('turns'))), 'in Fabrication there is no turn (__lobby.turn is null) and the canvas is not .turns');
  chk(8, errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
  await ctx.close();
}
try { for (const n of which === 'all' ? ['desktop', 'phone', 'reduced'] : [which]) await run(n); } finally { await b.close(); }
S.finish();
