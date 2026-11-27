// Check of travel between rooms on desktop and phone
import { PROFILES, ORIGIN, load, suite, launch, context, spy, open, inRoom, until, poke, snap, sources, readPick, sleep } from './rooms.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.cross'), { chk, note } = S;
const D = await load(), { projects, posts, profile, content } = D, P_ = new Map(projects.map((p) => [p.url, p])), B_ = new Map(posts.map((p) => [p.url, p]));
const linksOf = async (path) => [...new Set([...(await (await fetch(ORIGIN + path)).text()).match(/<main id="page">[\s\S]*<\/main>/)[0].matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]))];
const b = await launch();
const what = (u) => P_.get(u) ?? B_.get(u.split('#')[0]) ?? null;

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, W = P.viewport.width, H = P.viewport.height, errs = [];
  console.log(`\n=== ${name} ${W}x${H}`);
  const ctx = await context(b, P), requests = []; await ctx.addInitScript(spy); ctx.on('request', (q) => requests.push(q.url()));
  const shot = (p, n) => p.screenshot({ path: `/out/rooms-${name}-cross-${n}.png` }).catch(() => {});
  const roomOf = (url) => ({ '/blog/': 'writing', '/portfolio/': 'projects', '/about/': 'about', '/experience/': 'experience', '/contact/': 'comms' })[`/${url.split('/')[1]}/`];
  const reading = (s, url) => { const [path, hash] = url.split('#'), w = what(url), h1 = w?.title ?? ({ '/about/': profile.name, '/contact/': 'Contact', '/experience/': 'Experience', '/portfolio/': 'Projects' })[path];
    return [s.room === roomOf(url) && s.state === 'open' && s.url === url && s.path === path && s.hash === (hash ? `#${hash}` : '') && s.h1 === h1 && s.readerShown, `room ${s.room}, ${s.state}, url ${s.url}, address ${s.path}${s.hash}, title "${s.title}", h1 "${s.h1}"`]; };
  const settle = async (p, test, ms = 150000) => { let n = 0, s, t = Date.now(); for (; Date.now() - t < ms && n < 4; await sleep(400)) { s = await snap(p).catch(() => s); n = s && test(s)[0] ? n + 1 : 0; } return [s, Date.now() - t, n >= 4]; };
  async function openProject(url) {
    const p = await open(ctx, '/portfolio/', 'projects', errs), src = await sources(p), q = src.find((x) => x.url === url);
    if (!q) throw new Error(`no place offers ${url}`);
    const r = await readPick(p, phone, q.i, 'button'); if (!r.ok) throw new Error(`could not open ${url}`);
    await p.waitForTimeout(1200); return p;
  }
  async function openAbout() { const p = await open(ctx, '/about/', 'about', errs); await poke(p, '.hero .cta', phone); await until(p, () => window.__lobby.reader.state() === 'open', null, 60000); await p.waitForTimeout(1500); return p; }
  const link = async (p, href) => { await p.evaluate((h) => document.querySelector(`#reader a[href="${h}"]`)?.scrollIntoView({ block: 'center' }), href); await p.waitForTimeout(500); return poke(p, `#reader a[href="${href}"]`, phone); };
  async function follow(p, tag, origin, href, { backTo = origin, backOpen = true } = {}) {
    const t0 = Date.now(), got = await link(p, href); chk(7, got === true, `${tag}: the link ${href} can be pressed`, got === true ? '' : got); if (got !== true) return;
    const [s, ms, ok] = await settle(p, (x) => reading(x, href)); await p.waitForTimeout(800);
    chk(7, ok, `${tag}: following ${href} ends with it read in ${roomOf(href)}, the address, tab title and article agreeing (${ms} ms)`, ok ? '' : reading(s, href)[1]);
    if (await p.evaluate(() => !!document.querySelector('#reader')) && ok) { const w = what(href); if (w) chk(7, s.title === w.title, `${tag}: the tab title is the title of what is read`, s.title); }
    if (B_.has(href.split('#')[0]) && ok) chk(7, (await p.evaluate(() => window.__lobby.held())) === href.split('/')[2], `${tag}: the Library holds that volume`, await p.evaluate(() => window.__lobby.held()));
    if (ok && href.includes('#')) { const id = href.split('#')[1], t = await p.evaluate((id) => { const e = document.querySelector(`#reader [id="${id}"]`), sc = document.querySelector('.reader-scroll'); return e ? [Math.round(e.getBoundingClientRect().top - sc.getBoundingClientRect().top), Math.round(sc.scrollTop), Math.round(sc.scrollHeight - sc.clientHeight)] : null; }, id);
      chk(7, !!t && (t[0] >= -2 && t[0] <= 120 || t[1] >= t[2] - 2), `${tag}: the page is scrolled to #${id}`, t); }
    await shot(p, `${tag.replace(/\W+/g, '-')}-opened`);
    await p.goBack(); const test = backOpen ? (x) => reading(x, backTo) : (x) => [x.room === roomOf(backTo) && x.path === backTo.split('#')[0] && (x.state === 'closed' ? !x.readerShown : x.state === 'open' && x.readerShown && x.url === backTo), `room ${x.room}, ${x.state}, address ${x.path}${x.hash}`];
    const [b1, ms2, ok2] = await settle(p, test); await p.waitForTimeout(500);
    chk(7, ok2, `${tag}: Back returns to ${backTo}: the room, the reader and the address agree (${ms2} ms)`, ok2 ? '' : test(b1)[1]);
    if (!backOpen && ok2) note(`${tag}: Back lands in ${roomOf(backTo)} with the reader ${b1.state}${b1.state === 'closed' ? ' (what was being read there is not reopened: its address is the room\'s own)' : ''}`);
    await shot(p, `${tag.replace(/\W+/g, '-')}-back`);
    await p.goForward(); const [f1, ms3, ok3] = await settle(p, (x) => reading(x, href)); await p.waitForTimeout(500);
    chk(7, ok3, `${tag}: Forward leads to ${href} again, in agreement (${ms3} ms)`, ok3 ? '' : reading(f1, href)[1]);
  }

  const homelab = projects.find((q) => q.slug === 'homelab'), hl = await linksOf(homelab.url);
  for (const href of hl.filter((h) => h.startsWith('/blog/') && !h.startsWith('/blog/files/'))) {
    const p = await openProject(homelab.url); await follow(p, `homelab -> ${href.split('/')[2]}`, homelab.url, href); await p.close();
  }
  for (const [from, href] of [['gb10-memory-guard', '/portfolio/juju-agent-mcps/'], ['homelab', '/portfolio/kubernetes-cluster/']]) {
    const p = await openProject(`/portfolio/${from}/`); await follow(p, `${from} -> ${href.split('/')[2]} (same room)`, `/portfolio/${from}/`, href); await p.close();
  }
  const al = await linksOf('/about/'), feat = `/blog/${profile.featured_post ?? 'my-homelab'}/`;
  chk(7, al.includes(feat) && al.some((h) => h.startsWith('/portfolio/')) && al.includes('/contact/'), '/about/ links to a project, the featured post and /contact/', al);
  for (const href of al.filter((h) => h.startsWith('/portfolio/') || h === feat)) {
    const p = await openAbout(); await follow(p, `about -> ${href}`, '/about/', href, { backTo: '/about/', backOpen: false }); await p.close();
  }
  if (al.includes('/contact/')) {
    const p = await openAbout(), at = (room, path) => (x) => [x.room === room && x.path === path && x.state === 'closed' && !x.readerShown, `room ${x.room}, ${x.state}, address ${x.path}${x.hash}`];
    const got = await link(p, '/contact/'); chk(7, got === true, 'about -> /contact/: the link /contact/ can be pressed', got === true ? '' : got);
    if (got === true) {
      const [s, ms, ok] = await settle(p, at('comms', '/contact/')); await p.waitForTimeout(800);
      chk(7, ok && s.title === content.rooms.comms.title, `about -> /contact/: following /contact/ enters comms (${ms} ms)`, ok ? '' : at('comms', '/contact/')(s)[1]);
      await p.goBack(); const [b1, ms2, ok2] = await settle(p, at('about', '/about/')); await p.waitForTimeout(500);
      chk(7, ok2, `about -> /contact/: Back returns to /about/ (${ms2} ms)`, ok2 ? '' : at('about', '/about/')(b1)[1]);
      await p.goForward(); const [f1, ms3, ok3] = await settle(p, at('comms', '/contact/')); await p.waitForTimeout(500);
      chk(7, ok3, `about -> /contact/: Forward leads to /contact/ again (${ms3} ms)`, ok3 ? '' : at('comms', '/contact/')(f1)[1]);
    }
    await p.close();
  }
  const xl = (await linksOf('/experience/')).filter((h) => h.startsWith('/portfolio/'));
  for (const href of xl.slice(0, 1)) {
    const p = await open(ctx, '/experience/', 'experience', errs), src = await sources(p), q = src.find((x) => x.kind === 'sphere');
    await readPick(p, phone, q.i, 'button'); await p.waitForTimeout(1500); const from = (await snap(p)).url;
    await follow(p, `experience (${from}) -> ${href}`, from, href); await p.close();
  }
  {
    const url = '/blog/files/Driving-Detection-Course-Report.pdf', pr = projects.find((q) => q.slug === 'driving-detection-evaluation');
    const p = await openProject(pr.url), s0 = await snap(p), r0 = requests.length;
    const got = await link(p, url); await p.waitForTimeout(2500); const s1 = await snap(p);
    chk(7, got === true && requests.slice(r0).some((u) => u === ORIGIN + url), 'a link to a file asks for the file (in a new tab)', { got, requested: requests.slice(r0).slice(0, 3) });
    chk(7, s1.state === 'open' && s1.url === s0.url && s1.path === s0.path, 'and the station stays where it was, reading', { before: [s0.url, s0.path], after: [s1.state, s1.url, s1.path] });
    await p.close();
  }
  chk(7, errs.length === 0, 'no pageerror, console error or failed request through the whole run', [...new Set(errs)].slice(0, 8));
  await ctx.close();
}
try { for (const name of which === 'all' ? ['desktop', 'phone'] : [which]) await run(name); } finally { await b.close(); }
S.finish();
