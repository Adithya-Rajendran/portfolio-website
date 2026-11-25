// rooms.deeplink.mjs [desktop|phone|all]: the addresses of things read in the rooms (item 8).
//   /portfolio/<slug>/ for a project with an exhibit and one without: a readable page at once (html.reading, its own <title>), then read in the room by itself,
//     or, for a reader who had scrolled, offered; the place in the text is kept; Escape afterwards; the room it opens is Fabrication
//   /experience/#<id> for each entry: the room, the reader open on it, that entry's heading at the top; Escape returns to the room's own address
//   /about/, /portfolio/, /contact/ and /contact/#availability as rooms (no page first), and an address of a project that does not exist
// Prints FAIL lines (-v: ok lines too) and a summary; exit 1 on failure.
import { PROFILES, ORIGIN, load, suite, launch, context, spy, until, snap, frameChecks, leaveAndSnap, inRoom, sleep } from './rooms.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.deeplink'), { chk, note } = S;
const D = await load(), { projects, profile, content } = D, b = await launch();
const exhibited = new Set(content.rooms.projects.exhibits), withExhibit = projects.find((q) => exhibited.has(q.slug) && q.slug === 'homelab') ?? projects.find((q) => exhibited.has(q.slug)), without = projects.find((q) => !exhibited.has(q.slug) && q.slug !== 'personal-website') ?? projects.find((q) => !exhibited.has(q.slug));

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P); await ctx.addInitScript(spy);
  const shot = (p, n) => p.screenshot({ path: `/out/rooms-${name}-deep-${n}.png` }).catch(() => {});
  const page = async () => { const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
    p.on('requestfailed', (r) => errs.push(`request failed: ${r.url()}`)); p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); }); return p; };

  // ---------------------------------------------------------------- a project's own address: a page first, then the room
  for (const [pr, how] of [[withExhibit, 'exhibited'], [without, 'no exhibit']]) for (const scrolled of [false, true]) {
    const tag = `${pr.slug} (${how}, ${scrolled ? 'scrolled first' : 'left alone'})`, p = await page(), t0 = Date.now();
    await p.goto(`${ORIGIN}${pr.url}?shot=hero&rollat=20`, { waitUntil: 'domcontentloaded' });
    const first = await p.evaluate(() => { const h = document.querySelector('#page h1'), r = h?.getBoundingClientRect(); return { cls: document.documentElement.className, shown: getComputedStyle(document.querySelector('#page')).display, h1: h?.textContent, top: r && Math.round(r.top), left: r && Math.round(r.left), right: r && Math.round(r.right), title: document.title, kind: document.querySelector('#page article')?.className }; });
    chk(8, first.cls === 'reading' && first.shown === 'block', `${tag}: the project is a readable page at once (html.reading, #page shown)`, first);
    chk(8, first.h1 === pr.title && first.kind === 'post project' && first.top >= 0 && first.top < H && first.left >= 0 && first.right <= W, `${tag}: its h1 is the title and lies inside the window`, first);
    chk(8, first.title === `${pr.title} — ${profile.name}`, `${tag}: the tab title is "<title> — <name>" while it is a page`, first.title);
    await shot(p, `${pr.slug}-1-page`);
    let target = null;
    if (scrolled) {                                                          // read well into it: a heading near a quarter of the way down the window
      const ids = await p.evaluate(() => [...document.querySelectorAll('#page .post-body h2[id]')].map((h) => h.id));
      target = ids[Math.min(2, ids.length - 1)];
      await p.mouse.move(W / 2, H / 2); await p.mouse.wheel(0, 100); await p.waitForTimeout(100);
      await p.evaluate(({ id, H }) => { const h = document.getElementById(id); scrollTo(0, scrollY + h.getBoundingClientRect().top - H * 0.22); }, { id: target, H }); await p.waitForTimeout(500);
      const next = await p.evaluate((id) => { const hs = [...document.querySelectorAll('#page .post-body h2[id]')], i = hs.findIndex((h) => h.id === id), n = hs[i + 1]; return n ? Math.round(n.getBoundingClientRect().top / innerHeight * 100) : null; }, target);
      if (next !== null && next < 42) note(`${tag}: the next heading is at ${next}% of the window, so "last heading above 40%" may be that one`);
      const offered = await p.waitForSelector('#stepin', { timeout: 120000 }).then(() => true, () => false);
      chk(8, offered, `${tag}: a reader who has scrolled is offered the room (#stepin), not taken`);
      chk(8, (await p.evaluate(() => document.documentElement.className)) === 'reading', `${tag}: and stays on the page until they say so`);
      await shot(p, `${pr.slug}-2-offer`);
      await p.click('#stepin');
    }
    const ok = await until(p, () => window.__lobby?.reader.state() === 'open', null, 150000); await p.waitForTimeout(1500);
    const s = await snap(p), st = await p.evaluate(() => ({ cls: document.documentElement.className, inPage: !!document.querySelector('#page article'), inReader: !!document.querySelector('#reader article.post.project'), tf: document.querySelector('#reader').style.transform,
      pageShown: getComputedStyle(document.querySelector('#page')).display !== 'none', top: Math.round(document.querySelector('.reader-scroll').scrollTop) }));
    chk(8, ok && s.room === 'projects' && s.url === pr.url && s.path === pr.url && s.shown === pr.slug && s.title === pr.title, `${tag}: the room (Fabrication) takes over and reads it (${Date.now() - t0} ms)`, { room: s.room, state: s.state, url: s.url, path: s.path, title: s.title });
    chk(8, st.cls === 'station' && !st.inPage && st.inReader && /^translate\(/.test(st.tf) && !st.pageShown, `${tag}: html.station, the article moved from the page into the hologram, at rest`, st);
    for (const [fok, what, detail] of await frameChecks(p, W, H)) chk(8, fok, `${tag}: ${what}`, detail);
    if (scrolled) {
      const pos = await p.evaluate((id) => { const h = document.querySelector(`#reader [id="${id}"]`), sc = document.querySelector('.reader-scroll').getBoundingClientRect(); return h && [Math.round(h.getBoundingClientRect().top - sc.top), Math.round(sc.height)]; }, target);
      chk(8, !!pos && pos[0] >= -2 && pos[0] <= pos[1] * 0.3, `${tag}: the place in the text is kept (#${target} is at ${pos?.[0]} px from the top of the frame, which is ${pos?.[1]} px)`, { pos, scrollTop: st.top });
    } else chk(8, st.top < 5, `${tag}: it opens at its top`, st.top);
    await shot(p, `${pr.slug}-3-open${scrolled ? '-scrolled' : ''}`);
    // leaving it: the room, with or without the pick that offered it
    const back = await leaveAndSnap(p, phone);
    chk(8, back.ok && back.s.path === '/portfolio/' && back.s.title === content.rooms.projects.title, `${tag}: Escape closes it; the address is /portfolio/ and the title the room's`, { path: back.s.path, title: back.s.title });
    chk(8, back.s.enter === exhibited.has(pr.slug) && back.s.bar === exhibited.has(pr.slug), `${tag}: ${exhibited.has(pr.slug) ? 'back at the placard or exhibit that offers it (READ offered)' : 'nothing offers it, so the visitor is left in the room (no bar)'}`, { enter: back.s.enter, bar: back.s.bar });
    await p.close();
  }

  // ---------------------------------------------------------------- /experience/#<id>
  for (const e of profile.timeline) {
    const p = await page(), t0 = Date.now(); await p.goto(`${ORIGIN}/experience/#${e.id}?shot=hero&rollat=20`.replace('#' + e.id + '?shot=hero&rollat=20', '?shot=hero&rollat=20#' + e.id));
    const ok = await until(p, () => window.__lobby?.mode().room === 'experience' && window.__lobby.reader.state() === 'open', null, 150000); await p.waitForTimeout(1500);
    const s = await snap(p), g = await p.evaluate((id) => { const sc = document.querySelector('.reader-scroll'), r = sc.getBoundingClientRect(), h = document.querySelector(`#reader section.entry[id="${id}"] h2`);
      return { h2: h?.textContent, top: h && Math.round(h.getBoundingClientRect().top - r.top), scrollTop: Math.round(sc.scrollTop), max: Math.round(sc.scrollHeight - sc.clientHeight), cls: document.documentElement.className }; }, e.id);
    chk(8, ok && s.url === e.url && s.path === '/experience/' && s.hash === `#${e.id}`, `/experience/#${e.id} opens Navigation with the entry read (${Date.now() - t0} ms)`, { room: s.room, state: s.state, url: s.url, at: s.path + s.hash });
    chk(8, g.cls === 'station', `/experience/#${e.id}: it was the station from the first paint (not a page first)`, g.cls);
    chk(8, g.h2 === e.title && g.scrollTop > 0 && (g.top >= -2 && g.top <= 120 || g.scrollTop >= g.max - 2), `/experience/#${e.id}: that entry's heading ("${e.title}") is at the top of the frame, not the page's top`, g);
    if (e === profile.timeline[0]) { await shot(p, 'experience-1'); for (const [fok, what, detail] of await frameChecks(p, W, H)) chk(8, fok, `/experience/#${e.id}: ${what}`, detail); }
    const back = await leaveAndSnap(p, phone);
    chk(8, back.ok && back.s.path === '/experience/' && back.s.hash === '', `/experience/#${e.id}: Escape closes it and the address is /experience/ (the #fragment goes)`, { path: back.s.path + back.s.hash });
    await p.close();
  }
  // ---------------------------------------------------------------- the rooms' own pages, and what does not exist
  for (const [path, room, reads] of [['/about/', 'about', false], ['/portfolio/', 'projects', false], ['/contact/', 'comms', false], ['/contact/#availability', 'comms', '/contact/#availability']]) {
    const p = await page(); await p.goto(`${ORIGIN}${path.replace('#', '?shot=hero&rollat=20#')}${path.includes('#') ? '' : '?shot=hero&rollat=20'}`);
    const ok = await inRoom(p, room, 150000); if (reads) await until(p, () => window.__lobby.reader.state() === 'open', null, 60000); await p.waitForTimeout(1500); const s = await snap(p);
    chk(8, ok && s.cls === 'station' && (reads ? s.state === 'open' && s.url === reads : s.state === 'closed'), `${path} opens ${room}${reads ? ' with the page read' : ' as the room itself'}, with no page first`, { room: s.room, cls: s.cls, state: s.state, url: s.url });
    if (reads) { const t = await p.evaluate(() => { const e = document.querySelector('#reader [id="availability"]'), sc = document.querySelector('.reader-scroll'); return e && [Math.round(e.getBoundingClientRect().top - sc.getBoundingClientRect().top), Math.round(sc.scrollTop), Math.round(sc.scrollHeight - sc.clientHeight)]; });
      chk(8, !!t && (t[0] >= -2 && t[0] <= 120 || t[1] >= t[2] - 2), `${path}: scrolled to #availability`, t); }
    await p.close();
  }
  {
    const p = await ctx.newPage(), r = await p.goto(`${ORIGIN}/portfolio/no-such-project/`); chk(8, r.status() === 404, '/portfolio/no-such-project/ answers 404', r.status()); await p.close();      // (a page without the error listeners: a 404 logs one)
  }
  chk(8, errs.length === 0, 'no pageerror, console error or failed request through the whole run', [...new Set(errs)].slice(0, 8));
  await ctx.close();
}
try { for (const name of which === 'all' ? ['desktop', 'phone'] : [which]) await run(name); } finally { await b.close(); }
S.finish();
