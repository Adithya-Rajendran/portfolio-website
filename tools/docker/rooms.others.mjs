// Check of the content of the other rooms from the profile, on desktop and phone
import { PROFILES, ORIGIN, load, suite, launch, context, spy, open, until, poke, tapAt, snap, sources, frameChecks, canvasTexts, planePoint, readPick, leaveAndSnap, focus } from './rooms.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.others'), { chk, note } = S;
const D = await load(), { profile, content } = D;
const b = await launch(), up = (s) => s.toUpperCase(), norm = (s) => s.replace(/\s+/g, ' ').trim();
const flat = (cv) => norm(cv.flatMap((c) => c.t.map((x) => x[0])).join(' '));

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P), external = [], requests = []; await ctx.addInitScript(spy); ctx.on('request', (q) => requests.push(q.url()));
  await ctx.route((u) => u.origin !== ORIGIN, (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' }); });
  const shot = (p, n) => p.screenshot({ path: `/out/rooms-${name}-${n}.png` }).catch(() => {});

  {
    const p = await open(ctx, '/experience/', 'experience', errs), src = await sources(p), tl = profile.timeline, N = tl.length;
    const stations = src.filter((q) => q.kind === 'sphere'), cards = src.filter((q) => q.kind === 'screen');
    chk(4, stations.length === N, `one route-map station per timeline entry (${N})`, stations.map((q) => q.url));
    chk(4, tl.every((e) => stations.filter((q) => q.url === e.url).length === 1), 'every entry has exactly one station, at /experience/#<id>', { want: tl.map((e) => e.url), got: stations.map((q) => q.url) });
    chk(4, cards.length === 0 && await p.evaluate(() => window.__lobby.picks.every((q) => q.mesh.userData?.screen === undefined)), 'the wall cards are not picks and offer nothing to read (the stations are the only sources)', cards.map((q) => q.url));
    const cv = await canvasTexts(p), all = flat(cv), wallN = content.rooms.experience.screens.list.length, wall = [...tl].reverse().slice(-wallN);
    for (const e of wall) {
      const want = [up(e.org_short), e.current ? content.rooms.experience.now : up(e.kind), e.year, norm(e.title).slice(0, 20), up(e.period)];
      chk(4, want.every((w) => all.includes(w)), `the wall has a card for ${e.id} saying its organization, kind, year, title and period`, { missing: want.filter((w) => !all.includes(w)) });
    }
    chk(4, tl.every((e) => all.includes(up(e.org_short)) && all.includes(up(e.period)) && all.toLowerCase().includes(norm(e.title).slice(0, 12).toLowerCase())), "the route map's stations carry each entry's organization, period and role", { missing: tl.filter((e) => !all.includes(up(e.period)) || !all.includes(up(e.org_short))).map((e) => e.id) });
    await shot(p, 'experience');
    const order = stations.map((q) => ({ ...q, what: 'station' }));
    for (const [n, q] of order.entries()) {
      const e = tl.find((x) => x.url === q.url), tag = `${q.what} ${e.id}`;
      await p.evaluate(() => window.__lobby.setFocus(null)); await p.waitForTimeout(700);
      const r = await readPick(p, phone, q.i, n % 2 ? 'button' : 'glyph');
      chk(4, r.ready && r.before.enter, `${tag}: focusing it offers READ (glyph live, #enter shown)`, { ready: r.ready, enter: r.before.enter });
      chk(4, r.box.left >= 0 && r.box.right <= W && r.box.top >= 0 && r.box.bottom <= H && !r.box.behind, `${tag}: the READ glyph lies inside the viewport`, [r.box.left, r.box.top, r.box.right, r.box.bottom].map(Math.round));
      chk(4, r.glyphOk, `${tag}: a ${phone ? 'tap' : 'click'} on the READ glyph reaches the READ pick`, { at: [Math.round(r.box.cx), Math.round(r.box.cy)], hits: r.hits.slice(0, 3), readPickIs: r.reads });
      if (r.how === 'glyph' && !r.glyphOk && !r.fell) note(`${tag}: the glyph was pressed in spite of that`);
      if (!r.ok) { chk(4, false, `${tag}: READ opens the article`); await p.keyboard.press('Escape'); continue; }
      await p.waitForTimeout(1500); const s = await snap(p);
      chk(4, s.url === e.url && s.path + s.hash === e.url, `${tag}: reader.url() and the address are ${e.url}`, { url: s.url, at: s.path + s.hash });
      chk(4, s.h1 === 'Experience' && s.title !== '' && s.title.includes('Experience'), `${tag}: the h1 is "Experience" and the tab title says so`, { h1: s.h1, title: s.title });
      const g = await p.evaluate((id) => { const sc = document.querySelector('.reader-scroll'), r = sc.getBoundingClientRect(), sec = document.querySelector(`#reader section.entry[id="${id}"]`), h = sec?.querySelector('h2');
        return { have: !!sec, secTop: sec && Math.round(sec.getBoundingClientRect().top - r.top), h2Top: h && Math.round(h.getBoundingClientRect().top - r.top), h2: h?.textContent, scrollTop: Math.round(sc.scrollTop), max: Math.round(sc.scrollHeight - sc.clientHeight), frame: Math.round(r.height) }; }, e.id);
      chk(4, g.have && g.h2 === e.title, `${tag}: the page has this entry, its heading "${e.title}"`, g);
      chk(4, g.scrollTop > 0 && g.h2Top >= -2 && g.h2Top <= 120 || (g.scrollTop >= g.max - 2 && g.h2Top >= 0 && g.h2Top < g.frame), `${tag}: the entry's heading is at the top of the frame, not the page's top`, g);
      for (const [ok, what, detail] of await frameChecks(p, W, H)) if (n === 0 || !ok) chk(4, ok, `${tag}: ${what}`, detail);
      if (n === 0) {
        await shot(p, 'experience-open');
        const rail = await p.evaluate(() => ({ shown: getComputedStyle(document.querySelector('.reader-rail')).display !== 'none', links: [...document.querySelectorAll('.reader-rail a')].map((a) => [a.getAttribute('href'), a.textContent]) }));
        if (!phone) {
          chk(4, rail.shown, 'the contents rail is shown on the desktop');
          chk(4, tl.every((x, i) => rail.links[i]?.[1] === x.title), 'the contents rail lists the entries (their titles, newest first) before the other sections', rail.links.slice(0, N + 3).map((l) => l[1]));
          chk(4, rail.links.length > N, 'and then the page\'s other sections (skills, credentials ...)', rail.links.length);
          for (const i of [0, N - 1]) {
            const e2 = tl[i]; await poke(p, `.reader-rail li:nth-child(${i + 1}) a`, false); await p.waitForTimeout(1500);
            const t = await p.evaluate((id) => { const sc = document.querySelector('.reader-scroll').getBoundingClientRect(), h = document.querySelector(`#reader section.entry[id="${id}"] h2`).getBoundingClientRect(); return [Math.round(h.top - sc.top), location.hash, location.pathname]; }, e2.id);
            chk(4, t[0] >= -2 && t[0] <= 120, `a click on the rail's link for ${e2.id} brings its heading to the top`, t);
          }
        } else chk(4, !rail.shown, 'the rail is hidden on the phone (by design)');
      }
      const back = await leaveAndSnap(p, phone);
      chk(4, back.ok && back.s.path === '/experience/' && back.s.hash === '' && back.s.count === r.before.count, `${tag}: Escape closes it: address /experience/ (no #fragment), the same pick offers READ again`, { path: back.s.path + back.s.hash, count: back.s.count, before: r.before.count });
    }
    chk(4, errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
    await p.close();
  }

  {
    errs.length = 0;
    const p = await open(ctx, '/about/', 'about', errs), cta = await p.evaluate(() => document.querySelector('.hero .cta')?.textContent);
    chk(5, cta === content.rooms.about.cta, "the hero's button is there", cta);
    const cv = await canvasTexts(p), all = flat(cv);
    chk(5, all.includes(profile.name), 'the wall says who this is (the name)', all.slice(0, 200));
    chk(5, all.includes(norm(profile.tagline).slice(0, 25)), 'and the tagline');
    if (profile.curiosities[0]) chk(5, all.includes(norm(profile.curiosities[0].title).slice(0, 25)), "and the first curiosity's title on the other card");
    await shot(p, 'about');
    chk(5, (await poke(p, '.hero .cta', phone)) === true && await until(p, () => window.__lobby.reader.state() === 'open', null, 60000), "the hero's button reads");
    await p.waitForTimeout(1500); const s = await snap(p);
    chk(5, s.url === '/about/' && s.path === '/about/' && s.shown === 'about', 'it is /about/: reader.url(), address, and the article about', { url: s.url, path: s.path, shown: s.shown });
    chk(5, s.h1 === profile.name && s.title === profile.name, 'the h1 and the tab title are the name', { h1: s.h1, title: s.title });
    const text = norm(await p.evaluate(() => document.querySelector('#reader article').textContent));
    chk(5, text.includes(profile.name) && text.includes(norm(profile.introduction)), 'the text has the name and the whole introduction', { name: text.includes(profile.name), intro: text.includes(norm(profile.introduction)) });
    chk(5, [profile.headline, profile.location, profile.tagline].every((x) => text.includes(norm(x))), 'and the headline, location and tagline', [profile.headline, profile.location, profile.tagline].filter((x) => !text.includes(norm(x))));
    chk(5, profile.focus.every((x) => text.includes(x)) && profile.links.every((l) => text.includes(l.label)), "and the focus areas and the profile's links", {});
    for (const [ok, what, detail] of await frameChecks(p, W, H)) chk(5, ok, what, detail);
    await shot(p, 'about-open');
    const back = await leaveAndSnap(p, phone);
    chk(5, back.ok && back.s.path === '/about/' && back.s.hash === '' && back.s.title === content.rooms.about.title, 'Escape closes it, the address is /about/ and the tab title the room\'s', { path: back.s.path, title: back.s.title });
    note(`after Escape in the Lounge: bar shown ${back.s.bar}, READ offered ${back.s.enter}, count ${back.s.count}`);
    chk(5, errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
    await p.close();
  }

  await ctx.close();
}
try { for (const name of which === 'all' ? ['desktop', 'phone'] : [which]) await run(name); } finally { await b.close(); }
S.finish();
