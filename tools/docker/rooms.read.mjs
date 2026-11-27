// Check of the room paths and of reading the projects in Fabrication, on desktop, phone and reduced motion
import { PROFILES, ORIGIN, load, suite, launch, context, spy, open, inRoom, until, poke, tapAt, snap, readBox, readNow, focus, sources, rayHits, settledBox, frameChecks, leave, sleep, ROOM_OF } from './rooms.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.read'), { chk, note } = S;
const D = await load(), { projects, content } = D, byUrl = new Map(projects.map((p) => [p.url, p]));
const b = await launch();
const ROOMS = Object.entries(content.rooms).map(([id, r]) => ({ id, path: r.path, title: r.title, alias: id }));


async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}${P.reducedMotion ? ' reduced-motion' : ''}`);
  const ctx = await context(b, P); await ctx.addInitScript(spy);
  const shot = (p, n) => p.screenshot({ path: `/out/rooms-${name}-${n}.png` }).catch(() => {});
  const poke_ = (p, sel) => poke(p, sel, phone), snap_ = snap;

  if (!P.reducedMotion) {
    for (const r of ROOMS) for (const [how, path] of [['path', r.path]]) {
      const e0 = errs.length, p = await open(ctx, path, r.id, errs, { pin: false });
      await p.waitForTimeout(1500);
      const s = await snap_(p), nav = await p.evaluate(() => [...document.querySelectorAll('#hud nav a[data-room]')].map((a) => [a.dataset.room, new URL(a.href).pathname, a.classList.contains('here')]));
      chk(1, s.room === r.id, `${path} opens ${r.id}`, s.room);
      chk(1, s.title === r.title, `${path}: the tab title is "${r.title}"`, s.title);
      if (how === 'path') chk(1, s.path === r.path, `${path} stays at its own address`, s.path + s.search);
      else note(`${path}: the address after loading is ${s.path}${s.search}`);
      chk(1, nav.length === ROOMS.length && ROOMS.every((q, i) => nav[i][0] === q.id && nav[i][1] === q.path), `${path}: the nav's links carry the rooms' paths`, nav.map((n) => n.slice(0, 2).join(' ')));
      chk(1, nav.filter((n) => n[2]).map((n) => n[0]).join() === r.id, `${path}: only the open room is marked "here"`, nav.filter((n) => n[2]).map((n) => n[0]));
      chk(1, errs.length === e0, `${path}: no pageerror, console error, failed request or 4xx`, errs.slice(e0, e0 + 4));
      await p.close();
    }
    {
      const e0 = errs.length, p = await open(ctx, '/about/', 'about', errs, { pin: false }), seq = ['projects', 'experience', 'writing', 'comms', 'lobby'], trail = ['about'];
      for (const id of seq) {
        if (phone) await p.evaluate((id) => window.__lobby.enter(id), id); else await p.click(`#hud nav a[data-room="${id}"]`);
        const ok = await inRoom(p, id); const s = await snap_(p); trail.push(id);
        chk(1, ok && s.path === content.rooms[id].path, `${phone ? 'entering' : 'clicking'} ${id.toUpperCase()} ${phone ? '' : 'in the nav '}opens it at ${content.rooms[id].path}`, ok ? s.path : `room is ${s.room}`);
      }
      for (let k = trail.length - 2; k >= 0; k--) {
        await p.goBack(); const ok = await inRoom(p, trail[k]); await p.waitForTimeout(400); const s = await snap_(p);
        chk(1, ok && s.path === content.rooms[trail[k]].path && s.title === content.rooms[trail[k]].title, `Back: ${trail[k]}, with its address and title`, ok ? `${s.path} "${s.title}"` : `room is ${s.room}, at ${s.path}`);
      }
      for (let k = 1; k < trail.length; k++) {
        await p.goForward(); const ok = await inRoom(p, trail[k]); await p.waitForTimeout(400); const s = await snap_(p);
        chk(1, ok && s.path === content.rooms[trail[k]].path && s.title === content.rooms[trail[k]].title, `Forward: ${trail[k]}, with its address and title`, ok ? `${s.path} "${s.title}"` : `room is ${s.room}, at ${s.path}`);
      }
      chk(1, errs.length === e0, 'no error while moving between the rooms', errs.slice(e0, e0 + 4));
      await p.close();
      const q = await open(ctx, '/portfolio/', 'projects', errs, { pin: false });
      if (phone) await q.evaluate(() => window.__lobby.enter('experience')); else await q.click('#hud nav a[data-room="experience"]'); await inRoom(q, 'experience'); await q.goBack(); const back = await inRoom(q, 'projects');
      chk(1, back, 'Back from another room leads to the room whose path was opened', back ? '' : (await snap_(q)).room);
      await q.close();
    }
  }

  const p = await open(ctx, '/portfolio/', 'projects', errs), src = await sources(p);
  const placards = src.filter((q) => q.kind === 'screen'), exhibits = src.filter((q) => q.kind === 'sphere');
  const named = content.rooms.projects.exhibits.map((slug) => projects.find((q) => q.slug === slug) ?? null);
  chk(2, placards.length === 0 && exhibits.length === named.length, `Fabrication's wall cards are not sources (0 of them offer anything to read); its ${named.length} exhibits do`, { placards: placards.length, exhibits: exhibits.length });
  chk(2, await p.evaluate(() => window.__lobby.picks.every((q) => q.mesh.userData?.screen === undefined)), 'no wall screen of Fabrication is a pick at all (not clickable, not on the tour)');
  chk(2, exhibits.every((q, i) => q.url === named[i]?.url), "each exhibit offers the project content.json's exhibits names for it", { exhibits: exhibits.map((q) => q.url), want: named.map((q) => q?.url) });
  const countOf = {};
  const places = exhibits.map((q, i) => ({ ...q, what: `exhibit ${i + 1}`, project: named[i] }));
  for (const [n, pl] of places.entries()) {
    const pr = pl.project; if (!pr) continue;
    await focus(p, pl.i); const ready = await until(p, () => { const q = window.__lobby.picks.find((x) => x.reads); return q.live() && q.mesh.parent.visible; }, null, 20000); await p.waitForTimeout(1600);
    const s0 = await snap_(p); countOf[pl.i] = s0.count;
    chk(2, s0.enter && s0.bar, `${pl.what} (${pr.slug}): focusing it shows READ (#enter) in the bar`, { enter: s0.enter, bar: s0.bar });
    chk(2, ready, `${pl.what}: the READ pick is live and its glyph shown`);
    const r = await settledBox(p);
    chk(2, r.cx > 0 && r.cx < W && r.cy > 0 && r.cy < H && !r.behind && r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H, `${pl.what}: the READ glyph and its whole tap area lie inside the viewport`, { box: [r.left, r.top, r.right, r.bottom].map(Math.round), W, H });
    chk(2, r.bottom - r.top >= (phone ? 40 : 20), `${pl.what}: the tap area is at least ${phone ? 40 : 20} px tall`, `${(r.bottom - r.top).toFixed(1)} px`);
    chk(2, r.onTop === 'canvas#scene', `${pl.what}: nothing but the canvas lies over the glyph`, r.onTop);
    if (n === 4) await shot(p, 'exhibit');
    const how = n % 2 ? 'button' : 'glyph', t0 = Date.now(), reads = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.reads)), hits = await rayHits(p, r.cx, r.cy);
    chk(2, hits.some((h) => h[0] === reads), `${pl.what}: a ${phone ? 'tap' : 'click'} on the READ glyph reaches the READ pick (main.js gives it the click over anything behind it)`, { at: [Math.round(r.cx), Math.round(r.cy)], hits: hits.slice(0, 3), readPickIs: reads });
    let read = await readNow(p, phone, how);
    chk(2, read.ok, `${pl.what}: READ (${how}) opens the article`, read.ok ? '' : read.pressed !== true ? read.pressed : { tapAt: [Math.round(r.cx), Math.round(r.cy)], nearestPickThere: hits[0], hits: hits.slice(0, 3), readPickIs: reads, focusNow: (await snap_(p)).count });
    if (!read.ok && how === 'glyph') { await shot(p, `glyph-fail-${n}`); await focus(p, pl.i); await p.waitForTimeout(1500); read = await readNow(p, phone, 'button'); note(`${pl.what}: read through the bar's button so that the rest could be checked`); }
    if (!read.ok) { await shot(p, `fail-${n}`); await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); continue; }
    await p.waitForTimeout(700); const s = await snap_(p);
    if (n === 0 && how === 'glyph' && read.t) console.log(`  READ to open: ${Date.now() - read.t} ms`);
    chk(2, s.url === pr.url && s.path === pr.url && s.title === pr.title && s.h1 === pr.title && s.shown === pr.slug, `${pl.what}: reader.url(), address, tab title, h1 and article all say ${pr.slug}`, { url: s.url, path: s.path + s.hash, title: s.title, h1: s.h1, shown: s.shown });
    for (const [ok, what, detail] of await frameChecks(p, W, H)) chk(2, ok, `${pl.what}: ${what}`, detail);
    if (n === 0 || n === 4) await shot(p, `open-${n}`);
    await p.keyboard.press('Escape'); if (phone) { }
    const closed = await until(p, () => window.__lobby.reader.state() === 'closed', null, 8000); await p.waitForTimeout(1800); const a = await snap_(p);
    const live = await readBox(p);
    chk(2, closed && a.path === '/portfolio/' && a.title === content.rooms.projects.title, `${pl.what}: Escape closes it; the address is /portfolio/ and the tab title the room's`, { closed, path: a.path + a.hash, title: a.title });
    chk(2, a.count === s0.count && a.enter && live.live && live.glyph, `${pl.what}: and the visitor is back at the pick that offered it (same position in the tour, READ offered again)`, { before: s0.count, after: a.count, enter: a.enter, glyph: live.glyph });
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  }

  await p.evaluate(() => window.__lobby.setFocus(null)); await p.waitForTimeout(1800);
  for (const pl of places) {
    if (!pl.project || !countOf[pl.i]) continue;
    const at = await p.evaluate(async (i) => { const THREE = await import('three'), l = window.__lobby, m = l.picks[i].mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
      m.geometry.computeBoundingSphere(); const v = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(l.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }; }, pl.i);
    if (!(at.x > 4 && at.x < W - 4 && at.y > 4 && at.y < H - 4 && at.z < 1)) { note(`${pl.what} is off the screen in the room's own view (${Math.round(at.x)}, ${Math.round(at.y)}): reached with the arrow keys instead`); continue; }
    await tapAt(p, at.x, at.y, phone); await p.waitForTimeout(1200); const s = await snap_(p);
    chk(2, s.count === countOf[pl.i] && s.enter, `a ${phone ? 'tap' : 'click'} on ${pl.what} at ${Math.round(at.x)},${Math.round(at.y)} focuses it and offers READ`, { count: s.count, want: countOf[pl.i], enter: s.enter });
    await p.evaluate(() => window.__lobby.setFocus(null)); await p.waitForTimeout(600);
  }

  {
    await p.evaluate(() => window.__lobby.setFocus(null)); await p.waitForTimeout(800);
    const cta = await p.evaluate(() => document.querySelector('.hero .cta')?.textContent ?? null);
    chk(3, cta === content.rooms.projects.cta.replace('{count}', projects.length), "the hero's button counts the projects", cta);
    chk(3, (await poke_(p, '.hero .cta')) === true && await until(p, () => window.__lobby.reader.state() === 'open', null, 60000), "the hero's button reads the list");
    await p.waitForTimeout(800); const s = await snap_(p);
    chk(3, s.url === '/portfolio/' && s.path === '/portfolio/' && s.shown === 'list' && s.h1 === 'Projects', 'the list is /portfolio/: reader.url(), address and h1 ("Projects")', { url: s.url, path: s.path, shown: s.shown, h1: s.h1 });
    await shot(p, 'list');
    for (const [ok, what, detail] of await frameChecks(p, W, H)) chk(3, ok, `list: ${what}`, detail);
    const links = await p.evaluate(() => [...document.querySelectorAll('#reader .post-list li > a')].map((a) => [a.getAttribute('href'), a.textContent.trim()]));
    chk(3, links.length === projects.length && projects.every((q) => links.some((l) => l[0] === q.url && l[1] === q.title)), 'every project of portfolio/index.json is listed, by its title', { listed: links.length, missing: projects.filter((q) => !links.some((l) => l[0] === q.url)).map((q) => q.slug) });
    chk(3, new Set(links.map((l) => l[0])).size === links.length, 'and each only once');
    await p.keyboard.press('Escape'); await until(p, () => window.__lobby.reader.state() === 'closed', null, 8000); await p.waitForTimeout(800);
    const s1 = await snap_(p);
    chk(3, s1.state === 'closed' && s1.path === '/portfolio/' && !s1.readerShown && !s1.enter && !s1.bar, 'Escape closes the list: the room alone, no bar, address /portfolio/', { state: s1.state, path: s1.path, bar: s1.bar, enter: s1.enter });

    const exhibited = new Set(named.filter(Boolean).map((q) => q.slug));
    for (const pr of projects) {
      await p.evaluate(() => { const l = window.__lobby; if (l.reader.state() !== 'closed') l.reader.close(); l.setFocus(null); }); await p.waitForTimeout(900);
      await poke_(p, '.hero .cta'); await until(p, () => window.__lobby.reader.state() === 'open' && window.__lobby.reader.url() === '/portfolio/', null, 30000); await p.waitForTimeout(900);
      const sel = `#reader .post-list li > a[href="${pr.url}"]`;
      await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(500);
      const res = await poke_(p, sel); const ok = res === true && await until(p, (u) => window.__lobby.reader.state() === 'open' && window.__lobby.reader.url() === u, pr.url, 30000);
      await p.waitForTimeout(900); const t = await snap_(p);
      chk(3, ok && t.path === pr.url && t.title === pr.title && t.h1 === pr.title && t.shown === pr.slug, `the list's link opens ${pr.slug} (${exhibited.has(pr.slug) ? 'exhibited' : 'no exhibit'})`, ok ? { path: t.path, title: t.title, h1: t.h1, shown: t.shown } : res === true ? { state: t.state, url: t.url } : res);
      if (pr.slug === 'homelab' || !exhibited.has(pr.slug)) for (const [fok, what, detail] of await frameChecks(p, W, H)) chk(3, fok, `${pr.slug}: ${what}`, detail);
    }
    await p.evaluate(() => { const l = window.__lobby; if (l.reader.state() !== 'closed') l.reader.close(); l.setFocus(null); }); await p.waitForTimeout(900);
    const exh = projects.find((q) => exhibited.has(q.slug)), free = projects.find((q) => !exhibited.has(q.slug));
    for (const pr of [exh, free]) {
      await poke_(p, '.hero .cta'); await until(p, () => window.__lobby.reader.state() === 'open' && window.__lobby.reader.url() === '/portfolio/', null, 30000); await p.waitForTimeout(900);
      await p.evaluate((u) => document.querySelector(`#reader .post-list li > a[href="${u}"]`).scrollIntoView({ block: 'center' }), pr.url);
      await poke_(p, `#reader .post-list li > a[href="${pr.url}"]`); await until(p, (u) => window.__lobby.reader.url() === u && window.__lobby.reader.state() === 'open', pr.url, 30000); await p.waitForTimeout(900);
      const n0 = await p.evaluate(() => history.length);
      const coherent = (s) => s.path === '/portfolio/' ? (s.state === 'closed' && !s.readerShown && s.shown !== null ? [!s.readerShown, 'closed'] : s.state === 'closed' ? [!s.readerShown && !s.cls.includes('reading'), 'the room, the list closed'] : [s.state === 'open' && s.url === '/portfolio/' && s.readerShown && s.shown === 'list', 'the list open'])
        : [s.state === 'open' && s.url === s.path && s.readerShown && s.title === byUrl.get(s.path)?.title && s.shown === byUrl.get(s.path)?.slug, `the project at ${s.path}`];
      for (const [what, go] of [['Back', () => p.goBack()], ['Forward', () => p.goForward()], ['Back again', () => p.goBack()]]) {
        await go(); let s; const t0 = Date.now(); let stable = 0;
        for (; Date.now() - t0 < 20000 && stable < 4; await sleep(300)) { s = await snap_(p); stable = coherent(s)[0] ? stable + 1 : 0; }
        const [ok, why] = coherent(s);
        chk(3, ok, `${pr.slug} from the list, then ${what}: the address, the reader and what is shown agree (${why})`, ok ? `${s.path} | ${s.state} | ${s.shown}` : s);
        if (what === 'Back' && s.path === '/portfolio/') note(`Back from ${pr.slug} (opened from the list) leaves the reader ${s.state}: ${s.state === 'closed' ? 'the list the visitor came from is not shown again' : 'the list is shown again'}`);
        await shot(p, `back-${pr.slug}-${what.replace(/ /g, '-')}`);
      }
      await p.evaluate(() => { const l = window.__lobby; if (l.reader.state() !== 'closed') l.reader.close(); l.setFocus(null); }); await p.waitForTimeout(900);
      if (n0 === undefined) break;
    }
  }
  chk(2, errs.length === 0, 'no pageerror, console error or failed request through the whole run', [...new Set(errs)].slice(0, 6));
  await p.close();

  {
    const kerrs = [], k = await open(ctx, '/portfolio/', 'projects', kerrs);
    if (P.reducedMotion) chk(10, await k.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'prefers-reduced-motion: reduce is in effect');
    await k.evaluate(() => document.activeElement?.blur());
    let reached = -1, seen = [];
    for (let n = 0; n < 30 && reached < 0; n++) {
      await k.keyboard.press('ArrowRight'); await k.waitForTimeout(P.reducedMotion ? 250 : 500); seen.push((await snap(k)).count);
      if (await k.evaluate(() => window.__lobby.picks.find((x) => x.reads).live())) reached = n;
    }
    chk(10, reached >= 0, 'the arrow keys reach a pick that offers a project (READ live)', reached >= 0 ? `after ${reached + 1} presses` : seen);
    const before = await snap(k), t0 = Date.now();
    chk(10, before.enter, 'the bar offers READ (#enter) there', before.enter);
    await k.keyboard.press('Enter');
    const opened = await until(k, () => window.__lobby.reader.state() === 'open', null, 60000);
    const s = await snap(k), want = byUrl.get(s.url);
    chk(10, opened && !!want, 'Enter reads what that pick offers: a project of the portfolio', { state: s.state, url: s.url });
    if (P.reducedMotion) chk(10, opened && Date.now() - t0 <= 2500, 'reduced motion: READ opens the article within about two seconds (no show)', `${Date.now() - t0} ms`);
    if (opened && want) {
      await k.waitForTimeout(900);
      chk(10, s.path === want.url && s.title === want.title && s.h1 === want.title, 'the address, tab title and h1 follow', { path: s.path, title: s.title, h1: s.h1 });
      const act = await k.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
      await k.keyboard.press('PageDown'); await k.waitForTimeout(600);
      const top = await k.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
      chk(10, top > 50, 'PageDown scrolls the article (focus starts in it)', { focus: act, scrollTop: Math.round(top) });
      const rail = await k.evaluate(() => document.querySelectorAll('.reader-rail a').length);
      if (P.reducedMotion && rail > 2 && !phone) {
        await poke(k, `.reader-rail li:nth-child(${rail >> 1}) a`, false); await k.waitForTimeout(150);
        const a = await k.evaluate(() => document.querySelector('.reader-scroll').scrollTop); await k.waitForTimeout(1200);
        const z = await k.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
        chk(10, a > 0 && Math.abs(a - z) < 2, 'a contents link jumps without smooth scrolling', `${Math.round(a)} at 150 ms, ${Math.round(z)} later`);
      }
      let n = 0, hit = false; for (; n < 250; n++) { await k.keyboard.press('Tab'); if (await k.evaluate(() => document.activeElement?.classList.contains('reader-close'))) { hit = true; break; } }
      chk(10, hit, 'Tab reaches the CLOSE button', hit ? `after ${n + 1} presses` : 'not within 250 presses');
      await k.keyboard.press('Escape'); const cl = await until(k, () => window.__lobby.reader.state() === 'closed', null, 8000); await k.waitForTimeout(1000);
      const a = await snap(k);
      chk(10, cl && a.path === '/portfolio/' && a.enter && a.count === before.count, 'Escape closes: the address /portfolio/, and the same pick offers READ again', { count: a.count, before: before.count, enter: a.enter });
      await k.evaluate(() => document.activeElement?.blur()); let m = 0, onEnter = false;
      for (; m < 60; m++) { await k.keyboard.press('Tab'); if (await k.evaluate(() => document.activeElement?.id === 'enter')) { onEnter = true; break; } }
      chk(10, onEnter, 'Tab reaches the READ button of the bar', onEnter ? `after ${m + 1} presses` : 'not within 60');
      if (onEnter) { await k.keyboard.press('Enter'); const again = await until(k, (u) => window.__lobby.reader.state() === 'open' && window.__lobby.reader.url() === u, s.url, 60000);
        chk(10, again, 'Enter on the focused READ button reads it again', await k.evaluate(() => [window.__lobby.reader.state(), window.__lobby.reader.url()])); }
      await shot(k, 'keys');
    }
    chk(10, kerrs.length === 0, 'no pageerror, console error or failed request', [...new Set(kerrs)].slice(0, 6));
    await k.close();
  }
  await ctx.close();
}

try { for (const name of which === 'all' ? ['desktop', 'phone', 'reduced'] : [which]) await run(name); } finally { await b.close(); }
S.finish();
