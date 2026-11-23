// rooms.others.mjs [desktop|phone|all]: the other rooms' content, as the profile fills it (docs/v1-contracts.md §8).
//   4  Navigation: one route-map station per timeline entry, the wall cards the newest ones; reading one opens /experience/#<id> at that entry; the contents rail
//   5  the Lounge: the hero's button reads /about/; the text has the profile's name and introduction; the wall says who
//   6  Comms: the field shows the name and one glyph per link; SEND with no address copies the message and says so; nothing navigates away
// Prints FAIL lines (and ok lines with -v) and a summary per item. A failure is a finding about the site unless the message says the test could not set up.
import { PROFILES, ORIGIN, load, suite, launch, context, spy, open, until, poke, tapAt, snap, sources, frameChecks, canvasTexts, planePoint, readPick, leaveAndSnap, focus } from './rooms.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.others'), { chk, note } = S;
const D = await load(), { profile, content } = D;
const b = await launch(), up = (s) => s.toUpperCase(), norm = (s) => s.replace(/\s+/g, ' ').trim();
const flat = (cv) => norm(cv.flatMap((c) => c.t.map((x) => x[0])).join(' '));

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P), external = [], requests = []; await ctx.addInitScript(spy); ctx.on('request', (q) => requests.push(q.url()));
  await ctx.route((u) => u.origin !== ORIGIN, (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>' }); });     // no network: a link to another site gets an empty page
  const shot = (p, n) => p.screenshot({ path: `/out/rooms-${name}-${n}.png` }).catch(() => {});

  // ---------------------------------------------------------------- 4. Navigation
  {
    const p = await open(ctx, '/experience/', 'experience', errs), src = await sources(p), tl = profile.timeline, N = tl.length;
    const stations = src.filter((q) => q.kind === 'sphere'), cards = src.filter((q) => q.kind === 'screen').sort((a, b) => a.screen - b.screen);
    chk(4, stations.length === N, `one route-map station per timeline entry (${N})`, stations.map((q) => q.url));
    chk(4, tl.every((e) => stations.filter((q) => q.url === e.url).length === 1), 'every entry has exactly one station, at /experience/#<id>', { want: tl.map((e) => e.url), got: stations.map((q) => q.url) });
    const cardCount = await p.evaluate(() => window.__lobby.picks.filter((q) => q.mesh.userData?.screen !== undefined).length), wall = [...tl].reverse().slice(-cardCount);
    chk(4, cards.length === Math.min(cardCount, N) && cards.every((q, i) => q.url === wall[i]?.url), `the wall's cards are the newest entries (${cardCount} cards, oldest of them first)`, { cards: cards.map((q) => q.url), want: wall.map((e) => e.url) });
    // what the cards and the stations say
    const cv = await canvasTexts(p), all = flat(cv);
    for (const [j, q] of cards.entries()) {
      const e = wall[j], t = norm((await p.evaluate((i) => (window.__lobby.picks[i].mesh.material.uniforms.map.value.userData.canvas.__t ?? []).map((x) => x[0]), q.i)).join(' '));
      const want = [up(e.org_short), e.current ? content.rooms.experience.now : up(e.kind), e.year, norm(e.title).slice(0, 20), up(e.period), ...(e.summary ? [norm(e.summary).slice(0, 25)] : [])];
      chk(4, want.every((w) => t.includes(w)), `the wall card for ${e.id} says its organization, kind, year, title, period and summary`, { drawn: t.slice(0, 300), want });
    }
    chk(4, tl.every((e) => all.includes(up(e.org_short)) && all.includes(up(e.period)) && all.toLowerCase().includes(norm(e.title).slice(0, 12).toLowerCase())), "the route map's stations carry each entry's organization, period and role", { missing: tl.filter((e) => !all.includes(up(e.period)) || !all.includes(up(e.org_short))).map((e) => e.id) });
    await shot(p, 'experience');
    // reading each of them: the stations and the cards
    const order = [...stations.map((q) => ({ ...q, what: 'station' })), ...cards.map((q) => ({ ...q, what: 'card' }))];
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
    // the plain page and the room agree on the entries: each section the room scrolls to is there
    chk(4, errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
    await p.close();
  }

  // ---------------------------------------------------------------- 5. the Lounge
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

  // ---------------------------------------------------------------- 6. Comms
  {
    errs.length = 0; external.length = 0;
    const p = await open(ctx, '/contact/', 'comms', errs), popups = []; ctx.on('page', (q) => popups.push(q));
    const before = await snap(p), cmsg = content.rooms.comms.comms.mind;
    chk(6, (await poke(p, '.hero .cta', phone)) === true, "the hero's button (WRITE A MESSAGE) is pressed");
    await p.waitForTimeout(3500);
    // the field: where it is, what it has drawn
    const field = async () => { const cv = (await canvasTexts(p)).filter((c) => c.t.some((x) => x[0] === 'SEND')).sort((a, b) => b.t.length - a.t.length)[0]; return cv ?? null; };
    let f = await field();
    chk(6, !!f, 'the open field is drawn (it has a SEND glyph)', f ? '' : 'no canvas with SEND');
    if (!f) return;
    const texts = f.t.map((x) => x[0]), picks = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.click)), flatT = norm(texts.join(' '));
    chk(6, flatT.includes(up(profile.name)), "the field shows the profile's name (TO ...)", texts.slice(0, 6));
    const want = [...profile.links.map((l) => up(l.label)), ...(profile.resume ? [content.rooms.comms.comms.resume] : [])];
    const row = f.t.find((x) => x[0] === want[0]), glyphs = f.t.filter((x) => row && Math.abs(x[2] - row[2]) < 2).map((x) => x[0]);
    chk(6, row && want.length === glyphs.length && want.every((w) => glyphs.includes(w)), 'one glyph per link of profile.json (and the résumé)', { drawn: glyphs, want });
    chk(6, profile.links.every((l) => f.t.some((x) => x[0] === l.label[0].toUpperCase() || x[0] === l.label[0])), 'each glyph carries its initial');
    chk(6, f.t.filter((x) => x[0] === 'SEND').length === 1 && !flatT.includes('@'), 'no address is shown (none is published)');
    await shot(p, 'comms-open');
    // the glyphs open the links in a new tab
    for (const [k, label] of want.entries()) {
      const g = f.t.find((x) => x[0] === label), pt = await planePoint(p, picks, f.w, f.h, g[1], g[2] - (f.w === 1600 ? 46 : 50) - 36), url = k < profile.links.length ? profile.links[k].url : profile.resume;
      const n0 = popups.length, e0 = external.length, r0 = requests.length; await tapAt(p, pt.x, pt.y, phone); await p.waitForTimeout(1500);
      const q = popups[n0], seen = q ? q.url() : '', full = new URL(url, ORIGIN).href, ok = requests.slice(r0).some((u) => u === full || u.startsWith(full));       // a PDF may be a download, not a page: the request says it was asked for
      chk(6, ok, `a ${phone ? 'tap' : 'click'} on the ${label} glyph (${Math.round(pt.x)}, ${Math.round(pt.y)}) asks for ${url} (in a new tab)`, { popup: seen || null, requested: requests.slice(r0).slice(0, 4), want: full });
      if (q) await q.close(); const same = (await snap(p)).path === '/contact/'; if (!same) chk(6, false, 'the station stayed where it was after the glyph click');
    }
    // typing and SEND with no address published
    const msg = 'Hello — a test of the field.\n\nSecond paragraph: ünïcode ✓, "quotes", <b>tags</b> & 100%.';
    let tag = await p.evaluate(() => document.activeElement?.tagName);
    if (tag !== 'TEXTAREA') { const pt = await planePoint(p, picks, f.w, f.h, f.w / 2, f.h * 0.4); await tapAt(p, pt.x, pt.y, phone); await p.waitForTimeout(500); tag = await p.evaluate(() => document.activeElement?.tagName); }
    chk(6, tag === 'TEXTAREA', 'the message field takes the keyboard (the field was opened, or touched)', tag);
    await p.keyboard.type(msg, { delay: 5 }); await p.waitForTimeout(500);
    const typed = await p.evaluate(() => document.querySelector('textarea').value);
    chk(6, typed === msg, 'typing fills the message', typed.slice(0, 60));
    f = await field(); const sendAt = f.t.find((x) => x[0] === 'SEND'), sp = await planePoint(p, picks, f.w, f.h, sendAt[1], sendAt[2] - 9);
    chk(6, sp.x > 0 && sp.x < W && sp.y > 0 && sp.y < H, 'the SEND glyph lies inside the viewport', [Math.round(sp.x), Math.round(sp.y)]);
    await shot(p, 'comms-typed');
    const nav0 = []; p.on('framenavigated', (fr) => nav0.push(fr.url())); const n0 = popups.length, e0 = external.length;
    await tapAt(p, sp.x, sp.y, phone);
    const said = await until(p, (w) => [...window.__canvases].some((c) => (c.__t ?? []).map((x) => x[0]).join(' ').includes(w)), cmsg.copied.slice(0, 20), 15000);
    await p.waitForTimeout(500);
    const clip = await p.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return '!' + e.message; } });
    chk(6, clip === msg, 'SEND copied exactly that message to the clipboard', { got: clip.slice(0, 80), same: clip === msg });
    f = await field(); const after = norm(f.t.map((x) => x[0]).join(' '));
    chk(6, said && after.includes(cmsg.copied.slice(0, 30)), 'the terminal says so ("copied")', { drawn: after.slice(-160) });
    await p.waitForTimeout(1500);
    chk(6, (await p.evaluate(() => document.querySelector('textarea').value)) === '', 'the message field is empty afterwards');
    const s = await snap(p);
    chk(6, nav0.length === 0 && s.path === '/contact/' && popups.length === n0 && external.length === e0, 'nothing navigated away: no navigation, no mailto, no new tab, no request to another site', { navigations: nav0, popups: popups.length - n0, external: external.slice(e0), path: s.path });
    await shot(p, 'comms-sent');
    // an empty message is not sent: the clipboard keeps what it had
    await tapAt(p, sp.x, sp.y, phone); await p.waitForTimeout(1500); f = await field(); const t2 = norm(f.t.map((x) => x[0]).join(' ')), clip2 = await p.evaluate(() => navigator.clipboard.readText());
    chk(6, t2.includes(cmsg.empty.slice(0, 25)) && clip2 === msg, 'SEND with nothing written says so and copies nothing', { drawn: t2.slice(-120), clipboardKept: clip2 === msg });
    chk(6, errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
    void before; await p.close(); ctx.removeAllListeners('page');
  }
  await ctx.close();
}
try { for (const name of which === 'all' ? ['desktop', 'phone'] : [which]) await run(name); } finally { await b.close(); }
S.finish();
