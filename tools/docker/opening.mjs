// opening.mjs [desktop|phone|reduced|all]: the reader's ways of opening (js/reader.js, js/opening/): each asked for in the room where it applies, and what shows while it works.
//   F  Fabrication: an exhibit is scanned flat (READ, then SCANNING: ScanFan and ScanSheet); no wall card is a source; "ALL n PROJECTS" is RECEIVED: no READ glyph at any time, no
//      ScanFan, ScanSheet or ReadBeam, ReadFlow shows while it arrives (not with reduced motion); after CLOSE nothing is offered (the READ pick is not live), and the button opens it
//      again; a project with no exhibit, read by address, is received the same way
//   L  the Lounge: the books are scanned as things with a shape: two ScanBody and a ScanFan to each, no ScanSheet; the glyph never says SCANNING; the pick's bounds() are the books'
//      corners (scene.json focus[0].boxes); the display's lock lies round the books, with the pointer anywhere on them while the view sways (desktop); a press on each book reaches it
//   N  Navigation: READ is offered under a station; asked, the glyph shuts saying READ (never SCANNING), no ScanFan, ScanSheet or ScanBody at any time, ReadPrint shows, the station's
//      sheet is dark while its print is carried and while it is read, the words come; CLOSE part-way folds the frame where it is, and every sheet has its light back
//   reduced motion, in each: the page of words is in its place from the first moment it shows (the recorder's astray: never outside the viewport)
// "ok" / "FAIL [profile item] what"; exit code 1 if any check failed. Frames are slow here: everything waits on a condition.
import { PROFILES, ORIGIN, load, json, suite, launch, context, spy, open, until, snap, sources, rayHits, readNow, frameChecks, leave, focus } from './rooms.kit.mjs';
import { sleep, WAYS, GATE, gate, look, camStill, boxCorners, dstate, sampled } from './r2.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('opening'), { chk, note } = S;
const { projects, content } = await load(), scene = await json('/assets/about/scene.json'), books = scene.focus[0].boxes, bookCorners = boxCorners(books);
const b = await launch();

const readPick = (p) => p.evaluate(() => window.__lobby.picks.findIndex((q) => q.reads));
const sheets = (p) => p.evaluate(() => { const o = []; window.__lobby.scene.traverse((n) => { if (n.isSprite && n.userData.pane) o.push(n.material.opacity); }); return o; });
const none = (r, names) => names.filter((k) => (r.max[k] || 0) > 0);
const rest = (p) => until(p, () => !window.__lobby.display.state().gliding, null, 90000);
const closed = async (p, phone) => { await leave(p, phone); await until(p, () => window.__lobby.reader.state() === 'closed', null, 30000); await rest(p); await p.waitForTimeout(1500); };

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, still = !!P.reducedMotion, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P), external = []; await ctx.addInitScript(spy); await ctx.addInitScript(WAYS); await ctx.addInitScript(GATE);
  await ctx.route((u) => u.origin !== new URL(ORIGIN).origin, (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' }); });

  // ================================================================ F. Fabrication
  {
    const p = await open(ctx, '/portfolio/', 'projects', errs); await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
    const src = await sources(p);
    chk('F', src.length > 0 && src.every((q) => q.kind === 'sphere'), 'every source of Fabrication is an exhibit (a sphere): no wall card is a source', src.map((q) => [q.kind, q.url]));
    chk('F', await p.evaluate(() => window.__lobby.picks.every((q) => q.mesh.userData?.screen === undefined)), 'and no wall screen is a pick');
    // scan, flat: an exhibit
    const ex = src[0]; await focus(p, ex.i); await camStill(p); await until(p, () => window.__lobby.picks.find((q) => q.reads).live(), null, 30000);
    let l = await look(p); chk('F', l.live && l.glyph, 'an exhibit in focus: READ is offered (the glyph is shown)', l);
    await p.evaluate(() => window.__w.mark()); let r = await readNow(p, phone, 'glyph'); await sleep(300); let rec = await p.evaluate(() => window.__w.mark());
    sampled(S, 'F', rec, 'an exhibit being read'); chk('F', r.ok, 'READ on an exhibit opens its article');
    if (still) chk('F', rec.astray < 1, 'an exhibit: reduced motion: the page of words is in its place from the first moment it shows (never outside the viewport)', rec.astray);
    if (!still) {
      chk('F', rec.states.includes('scanning') && rec.states.at(-1) === 'open', 'an exhibit: the reader goes scanning, then open', rec.states);
      chk('F', (rec.byState.scanning?.ScanSheet || 0) >= 1 && (rec.byState.scanning?.ScanFan || 0) === 1 && !rec.max.ScanBody, 'a flat thing is scanned: ScanSheet and one ScanFan while scanning, no ScanBody', rec.byState.scanning);
      chk('F', rec.word > 0.5, 'and the glyph says SCANNING under it (uWord rises)', rec.word);
    } else chk('F', !rec.max.ScanFan && !rec.max.ScanSheet, 'reduced motion: no ScanFan or ScanSheet is ever shown', rec.max);
    await closed(p, phone);
    // the list: received
    for (const via of ['button', 'address']) {
      const nonEx = projects.find((q) => !content.rooms.projects.exhibits.includes(q.slug)), url = nonEx?.url ?? projects[0].url, tag = via === 'button' ? 'the list ("ALL n PROJECTS")' : `a project with no exhibit (${url})`;
      await p.evaluate(() => { window.__lobby.setFocus(null); }); await rest(p); await p.waitForTimeout(800);
      const pre = await look(p); chk('F', !pre.live && !pre.glyph, `${tag}: before it, no READ is offered`, pre);
      await p.evaluate(() => window.__w.mark());
      if (via === 'button') await p.evaluate(() => document.querySelector('.hero .cta').click()); else await p.evaluate((u) => window.__lobby.reader.read(u), url);
      const ok = await until(p, () => window.__lobby.reader.state() === 'open', null, 120000); await sleep(300); rec = await p.evaluate(() => window.__w.mark());
      sampled(S, 'F', rec, tag); chk('F', ok, `${tag}: it opens`);
      if (still) chk('F', rec.astray < 1, `${tag}: reduced motion: the page of words is in its place from the first moment it shows (never outside the viewport)`, rec.astray);
      chk('F', (still || rec.states.includes('scanning')) && none(rec, ['ReadGlyph', 'ScanFan', 'ScanSheet', 'ScanBody', 'ReadBeam']).length === 0 && !rec.live,      // (reduced motion: a cut, the state between may last less than a look)
        `${tag}: no READ glyph at any time, no ScanFan, ScanSheet, ScanBody or ReadBeam, and the READ pick is never live`, { max: rec.max, live: rec.live, states: rec.states });
      if (!still) chk('F', (rec.byState.scanning?.ReadFlow || 0) >= 1, `${tag}: ReadFlow shows while it arrives`, rec.byState); else chk('F', !rec.max.ReadFlow, `${tag}: reduced motion: it is a cut (no ReadFlow)`, rec.max);
      if (ok) {
        const s = await snap(p); chk('F', s.shown === (via === 'button' ? 'list' : nonEx.slug) && s.readerShown, `${tag}: the reader shows ${via === 'button' ? 'the list' : nonEx.slug}`, [s.shown, s.url]);
        if (via === 'button') for (const [k, what, d] of await frameChecks(p, W, H)) chk('F', k, `list: ${what}`, d);
        await closed(p, phone);
        const post = await look(p), enterShown = (await snap(p)).enter;
        chk('F', !post.live && !post.glyph && !enterShown && !(post.ReadGlyph > 0), `${tag}: after CLOSE nothing is offered (READ pick not live, ReadGlyph not visible, no READ in the bar)`, { ...post, enter: enterShown });
      }
    }
    await p.evaluate(() => document.querySelector('.hero .cta').click());
    chk('F', await until(p, () => window.__lobby.reader.state() === 'open', null, 120000), 'and the button opens the list again');
    await closed(p, phone);
    chk('F', errs.length === 0 && external.length === 0, 'no error, and nothing asked of another site', [...errs, ...external].slice(0, 5));
    await p.close();
  }

  // ================================================================ L. the Lounge
  {
    errs.length = 0;
    const p = await open(ctx, '/about/', 'about', errs); await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
    const bk = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.source?.().bodies?.length));
    chk('L', bk >= 0, 'the Lounge has a source that names things with a shape (source.bodies)', bk);
    if (bk < 0) { await p.close(); } else {
      const bodies = await p.evaluate((i) => window.__lobby.picks[i].source().bodies.length, bk);
      chk('L', bodies === books.length && bodies >= 2, `it has ${books.length} bodies, the books of scene.json focus[0].boxes`, bodies);
      // bounds(): the books' corners
      const bnd = await p.evaluate((i) => window.__lobby.picks[i].bounds().map((v) => v.toArray()), bk), near = (a) => bnd.some((q) => Math.hypot(q[0] - a[0], q[1] - a[1], q[2] - a[2]) < 0.004);
      chk('L', bnd.length === 8 * books.length && bookCorners.flat().every(near), "the pick's bounds() are the corners of the books (all 8 of each, within 4 mm)", { n: bnd.length, missing: bookCorners.flat().filter((c) => !near(c)).length });
      // the projected corners, and the lock, read in one go
      const rectOf = (p) => p.evaluate(async ({ pts, all }) => {
        const THREE = await import('three'), l = window.__lobby; l.camera.updateMatrixWorld(true);
        const proj = (set) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, ok = true; for (const c of set) { const v = new THREE.Vector3(...c).project(l.camera); if (v.z > 1) ok = false; const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { l: x0, t: y0, r: x1, b: y1, ok }; };
        return { lock: l.display.state().lock, all: proj(all), each: pts.map(proj), eye: l.camera.position.toArray() };
      }, { pts: bookCorners, all: bookCorners.flat() });
      const rx = await rectOf(p), small = (rx.all.r - rx.all.l) * (rx.all.b - rx.all.t) / (W * H);
      note(`the books on the screen from the room's view: ${Math.round(rx.all.r - rx.all.l)} x ${Math.round(rx.all.b - rx.all.t)} px (${(small * 100).toFixed(1)}% of the window)`);
      // a press on each book reaches the pick
      for (const [k, e] of rx.each.entries()) { const x = (e.l + e.r) / 2, y = (e.t + e.b) / 2, hits = await rayHits(p, x, y); chk('L', e.ok && x > 0 && x < W && y > 0 && y < H && hits[0]?.[0] === bk, `a ${phone ? 'tap' : 'click'} at the middle of book ${k + 1} (${Math.round(x)}, ${Math.round(y)}) reaches the pick`, { hits: hits.slice(0, 3), pick: bk }); }
      if (!phone) {
        // the lock lies on the books, with the pointer on them and the view swaying under it
        let ptr = [0, 0];                                         // where the pointer was put last, for the detail of a FAIL
        // what lies under the pointer now (one ray, no retry), the books' rectangles, and the display's state: said when the lock is not where it should be
        const under = (p) => p.evaluate(async ({ pts, x, y }) => {
          const THREE = await import('three'), l = window.__lobby, ray = new THREE.Raycaster(), live = l.picks.filter((q) => !q.live || q.live()); l.camera.updateMatrixWorld(true);
          for (const q of live) q.mesh.updateWorldMatrix(true, false); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), l.camera);
          const proj = (set) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of set) { const v = new THREE.Vector3(...c).project(l.camera), px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return [x0, y0, x1, y1].map(Math.round); };
          const d = l.display.state();
          return { pointer: [x, y].map(Math.round), hits: ray.intersectObjects(live.map((q) => q.mesh), false).map((h) => l.picks.findIndex((q) => q.mesh === h.object)), books: pts.map(proj), mode: l.mode(), gliding: d.gliding, named: d.named, hint: d.hint };
        }, { pts: bookCorners, x: ptr[0], y: ptr[1] });
        const onBooks = async (target) => {
          for (let i = 0; i < 10; i++) {
            const s = await rectOf(p), e = target === 'all' ? s.all : s.each[target]; ptr = [(e.l + e.r) / 2, (e.t + e.b) / 2]; await p.mouse.move(ptr[0], ptr[1], { steps: 3 }); await sleep(700);
            // the view follows the pointer: settled once the lock is on and the target has stayed under the pointer, across and up and down
            const t = await rectOf(p), f = target === 'all' ? t.all : t.each[target]; if (t.lock && Math.abs((f.l + f.r) / 2 - ptr[0]) < 8 && Math.abs((f.t + f.b) / 2 - ptr[1]) < 8) return true;
          }
          return false;
        };
        for (const [what, target] of [['the middle of the books', 'all'], ['the first book', 0], ['the second book', 1]]) {
          const got = await onBooks(target); chk('L', got, `the pointer on ${what} brings the lock`, await dstate(p).then((s) => s.lock));
          for (let k = 0; k < 3 && got; k++) {
            await sleep(900); const s = await rectOf(p), [x, y, w, h] = s.lock?.rect ?? [0, 0, 0, 0], a = s.all, tol = 2.5, pad = 6;
            chk('L', !!s.lock && x <= a.l - pad + tol && x >= a.l - pad - tol && y <= a.t - pad + tol && y >= a.t - pad - tol && x + w >= a.r + pad - tol && x + w <= a.r + pad + tol && y + h >= a.b + pad - tol && y + h <= a.b + pad + tol,
              `${what} (look ${k + 1}): the lock's rectangle is the projected corners of focus[0].boxes, 6 px out (eye ${s.eye.map((v) => v.toFixed(3)).join(',')})`, { lock: s.lock, books: [a.l, a.t, a.r, a.b].map(Math.round), ...(s.lock ? {} : { under: await under(p) }) });
          }
        }
        await p.mouse.move(W - 4, 4); await until(p, () => !window.__lobby.display.state().lock, null, 15000);
      }
      // READ: the books are scanned
      await focus(p, bk); await camStill(p); await until(p, () => window.__lobby.picks.find((q) => q.reads).live(), null, 30000);
      const l = await look(p); chk('L', l.live && l.glyph, 'the books in focus: READ is offered', l);
      await p.evaluate(() => window.__w.mark()); const r = await readNow(p, phone, 'glyph'); await sleep(300); const rec = await p.evaluate(() => window.__w.mark());
      sampled(S, 'L', rec, 'the books being read'); chk('L', r.ok, 'READ opens the article');
      if (still) chk('L', rec.astray < 1, 'reduced motion: the page of words is in its place from the first moment it shows (never outside the viewport)', rec.astray);
      if (!still) {
        chk('L', rec.states.includes('scanning') && rec.states.at(-1) === 'open', 'the reader goes scanning, then open', rec.states);
        chk('L', (rec.byState.scanning?.ScanBody || 0) === books.length, `${books.length} ScanBody are shown while scanning (one box per book)`, rec.byState.scanning);
        chk('L', (rec.byState.scanning?.ScanFan || 0) >= books.length, 'and a ScanFan to each of them (at the same time)', rec.byState.scanning);
        chk('L', !rec.max.ScanSheet, 'no ScanSheet at any time (nothing flat is scanned)', rec.max);
        chk('L', rec.word < 0.5, 'the READ glyph never says SCANNING (it shuts when the scan starts)', rec.word);
      } else chk('L', !rec.max.ScanFan && !rec.max.ScanSheet && !rec.max.ScanBody, 'reduced motion: no scan is ever shown', rec.max);
      await p.waitForTimeout(1500);
      for (const [k, what, d] of await frameChecks(p, W, H)) chk('L', k, what, d);
      await closed(p, phone);
      const after = await look(p); chk('L', !after.ScanBody && !after.ScanFan && !after.ScanSheet, 'after CLOSE no part of the scan is left', after);
      chk('L', errs.length === 0, 'no error', [...new Set(errs)].slice(0, 5));
      await p.close();
    }
  }

  // ================================================================ N. Navigation: a station unfolds
  {
    errs.length = 0;
    const p = await open(ctx, '/experience/', 'experience', errs); await until(p, () => window.__lobby.ready() >= 1 && !!window.__lobby.turn && window.__lobby.picks.length > 0, null, 60000);
    const st = await p.evaluate(() => window.__lobby.picks.map((q, i) => ({ i, s: q.station, how: q.source?.().how })).filter((q) => q.s != null)), N = st.length;
    chk('N', N > 1 && st.every((q) => q.how === 'unfold'), 'every station is a source that opens by unfolding (source.how === "unfold")', st);
    chk('N', (await sheets(p)).length === N && (await sheets(p)).every((o) => o === 1), `each station has its sheet (a sprite with userData.pane), at full light`, await sheets(p));
    const src = await sources(p); chk('N', src.length === N && src.every((q) => q.kind === 'sphere'), 'the stations are the only sources of Navigation (the wall cards are not)', src.map((q) => q.kind));
    await p.evaluate((i) => window.__lobby.setFocus(window.__lobby.picks[i]), st[1].i); await camStill(p); await until(p, () => window.__lobby.turn.settled(), null, 60000);
    await until(p, () => window.__lobby.picks.find((q) => q.reads).live(), null, 30000);
    let l = await look(p); chk('N', l.live && l.glyph, 'a station in focus: READ is offered under it', l);
    await p.evaluate(() => window.__w.mark()); const r = await readNow(p, phone, 'glyph', 120000); await sleep(300); const rec = await p.evaluate(() => window.__w.mark());
    sampled(S, 'N', rec, 'a station being read'); chk('N', r.ok, 'READ on a station opens its entry');
    if (still) chk('N', rec.astray < 1, 'reduced motion: the page of words is in its place from the first moment it shows (never outside the viewport)', rec.astray);
    chk('N', (still || rec.states.includes('scanning')) && rec.states.at(-1) === 'open', still ? 'the reader is open (reduced motion: a cut)' : 'the reader goes scanning, then open', rec.states);
    chk('N', rec.word < 0.5, 'asked, the glyph shuts saying READ: it never says SCANNING', rec.word);
    chk('N', !rec.max.ScanFan && !rec.max.ScanSheet && !rec.max.ScanBody, 'no ScanFan, ScanSheet or ScanBody at any time (nothing is scanned)', rec.max);
    if (!still) chk('N', (rec.max.ReadPrint || 0) >= 1, 'ReadPrint shows while the sheet\'s print is carried', rec.max);
    chk('N', rec.dark >= 1, 'the station\'s own sheet is dark while the frame carries its print (and while it is read)', rec.dark);
    await p.waitForTimeout(1200); const s = await snap(p), sh = await sheets(p);
    chk('N', s.readerShown && !!s.shown && sh.filter((o) => o < 0.01).length === 1, 'the frame is at rest and the words are there; exactly one sheet (the station\'s) is dark', { shown: s.shown, sheets: sh });
    for (const [k, what, d] of await frameChecks(p, W, H)) chk('N', k, what, d);
    await closed(p, phone);
    const sh2 = await sheets(p); chk('N', sh2.every((o) => o === 1), 'after CLOSE all four sheets have their light back (opacity 1)', sh2);
    const after = await look(p); chk('N', !after.ReadPrint && !after.ReadFrame, 'and ReadPrint and ReadFrame are not shown', after);
    // CLOSE part-way folds the frame where it is
    if (!phone && !still) {
      await p.evaluate((i) => window.__lobby.setFocus(window.__lobby.picks[i]), st[2].i); await camStill(p); await until(p, () => window.__lobby.turn.settled(), null, 60000);
      await until(p, () => window.__lobby.picks.find((q) => q.reads).live(), null, 30000); await sleep(1500);
      const frame = () => p.evaluate(() => { const f = window.__lobby.scene.getObjectByName('ReadFrame'); let v = true; for (let e = f; e; e = e.parent) if (!e.visible) v = false; return { vis: v, w: +f.scale.x.toFixed(3), x: +f.position.x.toFixed(3), y: +f.position.y.toFixed(3) }; });
      await gate.shut(p); await p.evaluate(() => window.__lobby.setFocus(window.__lobby.picks.find((q) => q.reads))); await gate.step(p, 6);
      const mid = await frame(); await p.evaluate(() => window.__lobby.reader.close()); await gate.step(p, 2); const fold = await frame();
      chk('N', mid.vis && mid.w > 0 && fold.vis && Math.abs(fold.w - mid.w) < 1e-3 && Math.abs(fold.x - mid.x) < 1e-3 && Math.abs(fold.y - mid.y) < 1e-3, 'READ, a few frames, then CLOSE: the frame folds where it was (its position and scale are kept)', { mid, fold });
      await gate.step(p, 3); await gate.open(p);
      const gone = await until(p, () => { const f = window.__lobby.scene.getObjectByName('ReadFrame'); for (let e = f; e; e = e.parent) if (!e.visible) return true; return false; }, null, 60000);
      chk('N', gone, 'then the frame is not shown'); const sh3 = await sheets(p); chk('N', sh3.length === N && sh3.every((o) => o === 1), 'and all four sheets are at opacity 1', sh3);
    }
    chk('N', errs.length === 0, 'no error', [...new Set(errs)].slice(0, 5));
    await p.close();
  }
  await ctx.close();
}
try { for (const n of which === 'all' ? ['desktop', 'phone', 'reduced'] : [which]) await run(n); } finally { await b.close(); }
S.finish();
