// Library room check on desktop, phone and reduced motion
import { chromium } from 'playwright';
import { streamAbort } from './reqfail.mjs';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080', which = process.argv[2] || 'all';
const results = [];
let profile = '';
function chk(item, ok, what, detail = '') {
  results.push({ profile, item, ok: !!ok, what, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${profile} ${item}] ${what}${detail !== '' ? ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
  return !!ok;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const index = await (await fetch(`${ORIGIN}/blog/index.json`)).json();

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 }, phone: false },
  phone: { viewport: { width: 390, height: 844 }, phone: true, hasTouch: true, isMobile: true },
  reduced: { viewport: { width: 1280, height: 720 }, phone: false, reducedMotion: 'reduce' },
};

async function open(ctx, path, P) {
  const p = await ctx.newPage(), errs = P.errs;
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
  p.on('requestfailed', (r) => streamAbort(r) || errs.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  await p.goto(`${ORIGIN}${path}${path.includes('?') ? '&' : '?'}shot=hero&rollat=20`);
  await p.waitForFunction(() => window.__lobby?.mode().room === 'writing' && document.querySelector('#loader.done'), null, { timeout: 150000, polling: 250 });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { const l = window.__lobby, log = (window.__log = []); let last = '';
    setInterval(() => { const r = document.querySelector('#reader'), s = [l.reader.state(), l.reader.slug(), location.pathname, l.held()].join('|');
      if (s !== last) { last = s; log.push({ t: Date.now(), state: l.reader.state(), slug: l.reader.slug(), path: location.pathname, held: l.held(), title: document.title, tf: r.style.transform, hidden: r.hidden }); } }, 15); });
  return p;
}
const until = (p, fn, arg, timeout = 90000) => p.waitForFunction(fn, arg, { timeout, polling: 200 }).then(() => true, () => false);
const snap = (p) => p.evaluate(() => { const l = window.__lobby, r = document.querySelector('#reader'), w = document.querySelector('#ways'), vis = (e) => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  return { state: l.reader.state(), slug: l.reader.slug(), path: location.pathname, search: location.search, title: document.title, held: l.held(), mode: document.documentElement.className,
    readerShown: vis(r), shownSlug: r.querySelector('article.post')?.dataset.slug ?? null, h1: r.querySelector('article.post h1')?.textContent.trim() ?? null,
    listShown: vis(w) && w.classList.contains('list') && w.querySelectorAll('[data-option]').length, current: [...w.querySelectorAll('[data-option]')].findIndex((x) => x.hasAttribute('aria-current')),
    barShown: vis(document.querySelector('#inspectbar'))  }; });

async function run(name) {
  profile = name; const P = { ...PROFILES[name], errs: [] }, phone = P.phone;
  console.log(`\n=== ${name} ${P.viewport.width}x${P.viewport.height}${P.reducedMotion ? ' reduced-motion' : ''}`);
  const ctx = await b.newContext({ viewport: P.viewport, ...(phone ? { hasTouch: true, isMobile: true } : {}), ...(P.reducedMotion ? { reducedMotion: P.reducedMotion } : {}),
    permissions: ['clipboard-read', 'clipboard-write'] });
  const W = P.viewport.width, H = P.viewport.height, posts = index.posts, shot = (p, n) => p.screenshot({ path: `/out/lib-${name}-${n}.png` }).catch(() => {});
  const poke = async (p, sel) => { try { await (phone ? p.tap(sel, { timeout: 15000 }) : p.click(sel, { timeout: 15000 })); return true; } catch (e) { return String(e.message).split('\n')[0]; } };
  const tapAt = (p, x, y) => (phone ? p.touchscreen.tap(x, y) : p.mouse.click(x, y));
  const title = (slug) => posts.find((q) => q.slug === slug)?.title;
  const log = (p) => p.evaluate(() => window.__log);
  const readBox = (p) => p.evaluate(async () => {
    const THREE = window.__modules.THREE, l = window.__lobby, pick = l.picks.find((q) => q.reads), m = pick.mesh; l.camera.updateMatrixWorld(true); m.updateWorldMatrix(true, false);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([x, y]) => { const g = m.geometry.parameters, v = new THREE.Vector3(x * g.width / 2, y * g.height / 2, 0).applyMatrix4(m.matrixWorld).project(l.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, z: v.z }; });
    const xs = pts.slice(0, 4).map((q) => q.x), ys = pts.slice(0, 4).map((q) => q.y), c = pts[4], top = document.elementFromPoint(c.x, c.y);
    return { live: !!pick.live(), glyph: m.parent.visible, cx: c.x, cy: c.y, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), behind: pts.some((q) => q.z > 1),
      onTop: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}${top.className && typeof top.className === 'string' ? '.' + top.className.split(' ')[0] : ''}` : null };
  });
  const pickVolume = async (p, i) => {
    if (await p.evaluate((i) => { const b = document.querySelector(`#ways [data-option="${i}"]`); return !!b && b.getClientRects().length === 0; }, i)) {
      const again = await poke(p, '#ways [data-option][aria-current]'); if (again !== true) return again;
    }
    const ok = await poke(p, `#ways [data-option="${i}"]`); if (ok !== true) return ok;
    return (await until(p, (s) => window.__lobby.held() === s, posts[i].slug, 120000)) ? true : `held() is ${await p.evaluate(() => window.__lobby.held())}, not ${posts[i].slug}`;
  };
  const readNow = async (p, want) => {
    await until(p, () => { const q = window.__lobby.picks.find((x) => x.reads); return q.live() && q.mesh.parent.visible; }, null, 20000); await p.waitForTimeout(500);
    const r = await readBox(p); await p.mouse.move(r.cx, r.cy); await p.waitForTimeout(100);
    const t = Date.now(); await tapAt(p, r.cx, r.cy);
    let hook = false;
    if (!(await until(p, () => window.__lobby.reader.state() !== 'closed', null, 8000))) {
      hook = true; console.log(`  note: the READ press did nothing (held() is now ${await p.evaluate(() => window.__lobby.held())}); carrying on with setFocus(READ pick)`);
      if (await p.evaluate((w) => window.__lobby.held() !== w, posts[want].slug)) await pickVolume(p, want);
      await until(p, () => window.__lobby.picks.find((x) => x.reads).live(), null, 60000); await p.waitForTimeout(500); await p.evaluate(() => { const l = window.__lobby; l.setFocus(l.picks.find((q) => q.reads)); });
    }
    const ok = await until(p, () => window.__lobby.reader.state() === 'open', null, 60000); return { ok, t, box: r, hook };
  };

  const p = await open(ctx, '/blog/', P);
  const A = posts[0], B = posts[Math.min(2, posts.length - 1)];
  const TERMINAL = () => window.__lobby.setFocus(window.__lobby.picks.find((q) => q.options));
  let opened = false;

  if (!P.reducedMotion) {
    const vols = await p.evaluate(() => window.__lobby.volumes()), mode = await p.evaluate(() => window.__lobby.mode());
    chk(1, mode.room === 'writing', '/blog/ opens the Library', mode.room);
    chk(1, vols.length > 0 && vols.every((v, i) => v.slug === posts[i]?.slug && v.title === posts[i]?.title), 'volumes() are the first posts of blog/index.json, in order',
      { volumes: vols.map((v) => v.slug), index: posts.map((q) => q.slug) });
    if (vols.length < posts.length) console.log(`  note: the shelves hold ${vols.length} of ${posts.length} posts`);

    await p.evaluate(TERMINAL);
    chk(2, await until(p, (n) => document.querySelectorAll('#ways.list [data-option]').length === n, vols.length, 20000), 'focusing the terminal lists one button per volume');
    await p.waitForTimeout(1800); await shot(p, '1-list');
    const items = await p.evaluate(() => [...document.querySelectorAll('#ways [data-option]')].map((x) => { const r = x.getBoundingClientRect(); return { text: x.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height }; }));
    chk(2, items.length === vols.length && vols.every((v, i) => items[i]?.text.includes(v.title)), 'each button is labelled with its post title', items.map((x) => x.text));
    chk(2, items.every((x) => !/^[\d\s.#/]+$/.test(x.text)), 'no label is just a number');
    chk(2, items.every((x, i) => i === 0 || x.top >= items[i - 1].bottom - 0.5), 'each button lies below the previous one', items.map((x) => [Math.round(x.top), Math.round(x.bottom)]));
    chk(2, items.every((x, i) => i === 0 || Math.abs(x.left - items[0].left) < 2), 'the buttons are one column (same left edge)');
    chk(2, items.every((x) => x.left >= -0.5 && x.right <= W + 0.5 && x.top >= -0.5 && x.bottom <= H + 0.5), 'every button lies inside the viewport', items.map((x) => [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]));
    chk(2, items.every((x) => x.h >= (phone ? 40 : 24)), `every button is at least ${phone ? 40 : 24} px tall`, items.map((x) => Math.round(x.h)));
    const inOrder = await p.evaluate(() => { const o = [...document.querySelectorAll('#ways [data-option]')]; return o.map((x) => x.dataset.option).join() === o.map((_, i) => i).join(); });
    chk(2, inOrder, 'the buttons are in shelf order');

    const got = await pickVolume(p, 0);
    chk(3, got === true, `choosing "${A.title}": held() becomes its slug`, got === true ? '' : got);
    await shot(p, '2-held');
    const live = await until(p, () => { const q = window.__lobby.picks.find((x) => x.reads); return q.live() && q.mesh.parent.visible; }, null, 20000);
    chk(3, live, 'the READ pick is live and its glyph shown');
    await p.waitForTimeout(1200);
    const r = await readBox(p);
    chk(3, r.cx > 0 && r.cx < W && r.cy > 0 && r.cy < H && !r.behind, 'the glyph projects inside the viewport', { centre: [Math.round(r.cx), Math.round(r.cy)], W, H });
    chk(3, r.left >= 0 && r.right <= W && r.top >= 0 && r.bottom <= H, 'the whole of the tap area is inside the viewport', [r.left, r.top, r.right, r.bottom].map(Math.round));
    chk(3, r.bottom - r.top >= (phone ? 40 : 20), `the tap area is at least ${phone ? 40 : 20} px tall`, `${(r.bottom - r.top).toFixed(1)} x ${(r.right - r.left).toFixed(1)} px`);
    chk(3, r.onTop === 'canvas#scene', 'nothing but the canvas lies over the READ glyph', r.onTop);

    if (live) {
      const read = await readNow(p, 0); opened = read.ok;
      await shot(p, '3-open');
      if (read.hook) chk(4, read.ok, 'the article opens when READ is asked for through the hook instead');
      const states = (await log(p)).map((e) => e.state).filter((s, i, a) => s !== a[i - 1]);
      chk(4, read.ok && !read.hook && /scanning>open/.test(states.join('>')), 'clicking READ: state goes scanning, then open', read.hook ? 'the press did nothing' : states.join('>'));
      if (read.ok) {
        console.log(`  READ to open: ${Date.now() - read.t} ms`);
        const s = await snap(p), first = (await log(p)).find((e) => e.state === 'open');
        chk(4, s.path === `/blog/${A.slug}/`, 'the address is /blog/<slug>/', `${s.path}${s.search}`);
        chk(4, s.title === A.title, "the tab title is the post's title", s.title);
        chk(4, s.shownSlug === A.slug && s.h1 === A.title, '#reader article.post[data-slug] is there and its h1 is the title', { slug: s.shownSlug, h1: s.h1 });
        chk(4, (await p.evaluate(() => document.querySelectorAll('#reader article.post').length)) === 1, 'exactly one article in the reader');
        const g = await p.evaluate(() => { const r = document.querySelector('#reader'), q = r.getBoundingClientRect(), st = getComputedStyle(r), de = document.documentElement;
          const out = [];
          for (const e of r.querySelectorAll('*')) { if (e.closest('pre')) continue; const b = e.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.right > q.right + 1 || b.left < -1)) out.push(`${e.tagName.toLowerCase()}.${e.className}:${Math.round(b.right)}`); }
          const cover = []; for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95]) for (const fy of [0.05, 0.3, 0.5, 0.7, 0.95]) { const x = q.left + q.width * fx, y = q.top + q.height * fy, t = document.elementFromPoint(x, y); if (!t || !r.contains(t)) cover.push(`${Math.round(x)},${Math.round(y)}:${t?.tagName}#${t?.id}`); }
          return { rect: [q.left, q.top, q.right, q.bottom].map((x) => Math.round(x * 10) / 10), inline: r.style.transform, computed: st.transform, clip: r.style.clipPath, hidden: r.hidden, sw: [de.scrollWidth, document.body.scrollWidth, r.scrollWidth, r.clientWidth, innerWidth], out, cover,
            focus: document.activeElement?.className || document.activeElement?.tagName, sy: [scrollX, scrollY], title: r.querySelector('h1').getBoundingClientRect().top }; });
        chk(4, !g.hidden && g.rect[0] >= -0.5 && g.rect[1] >= -0.5 && g.rect[2] <= W + 0.5 && g.rect[3] <= H + 0.5, 'the reader element lies inside the viewport', g.rect);
        await p.waitForTimeout(1500);
        const tf = await p.evaluate(() => { const r = document.querySelector('#reader'); return { inline: r.style.transform, computed: getComputedStyle(r).transform }; });
        chk(4, /^translate\(-?[\d.]+px, -?[\d.]+px\)$/.test(tf.inline) && /^matrix\(1, 0, 0, 1, -?[\d.]+, -?[\d.]+\)$/.test(tf.computed), 'once open, its transform is a plain translate(...)', tf);
        chk(4, /^translate\(/.test(first.tf), 'the transform was already a translate at the instant the state turned open', first.tf);
        chk(4, !/\./.test(tf.inline), 'the translate is in whole pixels (sharp text)', tf.inline);
        chk(4, g.clip === '' , 'the reveal clip is gone once open', g.clip);
        chk(4, g.sw[0] <= g.sw[4] && g.sw[1] <= g.sw[4] && g.sw[2] <= g.sw[3] + 1 && g.out.length === 0 && g.sy[0] === 0, 'nothing overflows the page horizontally', { scrollWidth: g.sw, out: g.out.slice(0, 5), scroll: g.sy });
        const cb = await p.evaluate(() => { const c = document.querySelector('.reader-close'), r = c.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), onTop: t === c, h: r.height }; });
        chk(4, cb.rect[0] >= 0 && cb.rect[2] <= W && cb.onTop, 'the CLOSE button is on the screen and can be pressed', cb);
        chk(4, g.cover.length === 0, 'nothing but the reader is on top of it (25 points)', g.cover.slice(0, 5));
      } else await shot(p, '3-open-failed');

      if (read.ok) {
        const c = await p.evaluate(() => { const r = document.querySelector('.reader-scroll').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        const prog = () => p.evaluate(() => +(/scaleX\(([\d.e-]+)\)/.exec(document.querySelector('.reader-progress i').style.transform)?.[1] ?? NaN));
        const st = () => p.evaluate(() => [document.querySelector('.reader-scroll').scrollTop, scrollY, document.body.scrollTop]);
        const p0 = await prog(), s0 = await st();
        if (phone) { const cdp = await ctx.newCDPSession(p), x = Math.min(c[0], W - 20), t = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
          await t('touchStart', c[1] + 250); for (let i = 1; i <= 12; i++) { await t('touchMove', c[1] + 250 - 500 * i / 12); await sleep(16); } await t('touchEnd'); await cdp.detach(); }
        else { await p.mouse.move(c[0], c[1]); await p.mouse.wheel(0, 800); }
        const sc = await until(p, (t) => document.querySelector('.reader-scroll').scrollTop > t + 100, s0[0], 8000); await p.waitForTimeout(400);
        const s1 = await st(), p1 = await prog();
        chk(5, sc, `${phone ? 'a touch drag' : 'the mouse wheel'} scrolls the article`, `scrollTop ${Math.round(s0[0])} -> ${Math.round(s1[0])}`);
        chk(5, s1[1] === 0 && s1[2] === 0, 'the page itself does not scroll', s1);
        chk(5, p1 > p0, 'the progress bar moves', `${p0} -> ${p1}`);
        await shot(p, '4-scrolled');
        const secs = A && index.posts[0].sections.filter((x) => x.level === 2);
        const rail = await p.evaluate(() => ({ links: [...document.querySelectorAll('.reader-rail a')].map((a) => a.getAttribute('href')), shown: getComputedStyle(document.querySelector('.reader-rail')).display !== 'none',
          h2: [...document.querySelectorAll('#reader .post-body h2')].map((h) => h.id), allH2: document.querySelectorAll('#reader article h2').length }));
        if (!phone) {
          chk(5, rail.shown, 'the contents rail is shown on the desktop');
          chk(5, rail.links.length === rail.h2.length && rail.links.every((h, i) => h === `#${rail.h2[i]}`), 'the rail has one link per body h2, in order', { links: rail.links.length, h2: rail.h2.length });
          chk(5, rail.links.length === secs.length && rail.links.every((h, i) => h === `#${secs[i].id}`), "the rail matches blog/index.json's level-2 sections");
          if (rail.allH2 !== rail.h2.length) console.log(`  note: the article has ${rail.allH2} h2 in all (Takeaways and Changes among them) and ${rail.h2.length} body h2; the rail lists the body's`);
          for (const [label, i] of [['first', 0], ['middle', rail.links.length >> 1], ['last', rail.links.length - 1]]) {
            if (i < 0) break;
            const hid = rail.h2[i], res = await poke(p, `.reader-rail li:nth-child(${i + 1}) a`);
            const seen = res === true && await until(p, (id) => { const h = document.getElementById(id), r = h.getBoundingClientRect(), s = document.querySelector('.reader-scroll').getBoundingClientRect(); return r.top >= s.top - 2 && r.bottom <= s.bottom + 1; }, hid, 6000);
            await p.waitForTimeout(500);
            const after = await p.evaluate((id) => ({ hash: location.hash, path: location.pathname, cur: document.querySelector('.reader-rail [aria-current]')?.textContent, want: document.getElementById(id).textContent,
              railOk: (() => { const li = document.querySelector('.reader-rail [aria-current]'); if (!li) return null; const r = li.getBoundingClientRect(), q = document.querySelector('.reader-rail').getBoundingClientRect(); return r.top >= q.top - 1 && r.bottom <= q.bottom + 1; })() }), hid);
            chk(5, seen, `clicking the ${label} rail link brings "${hid}" into view`, res === true ? '' : res);
            chk(5, after.hash === '' && after.path === `/blog/${A.slug}/`, 'and leaves the address alone', after);
            if (label !== 'last') chk(5, after.cur === after.want, 'and the rail marks that heading as current', { current: after.cur, want: after.want });
            if (after.railOk === false) console.log(`  note: the rail's current item is out of the rail's own view after the ${label} click (the rail does not follow)`);
          }
          await shot(p, '5-rail');
        } else chk(5, !rail.shown, 'the rail is hidden on the phone (by design: CSS)');
        const pre = await p.evaluate(() => { const a = document.querySelector('#reader article'); return { pres: a.querySelectorAll('pre').length, copies: [...a.querySelectorAll('button.copy')].filter((b) => b.nextElementSibling?.tagName === 'PRE').length, copyAll: a.querySelectorAll('button.copy').length }; });
        chk(5, pre.pres > 0 && pre.copies === pre.pres && pre.copyAll === pre.pres, 'every pre has exactly one copy button right before it', pre);
        if (pre.pres) {
          await p.evaluate(() => { const b = document.querySelector('#reader button.copy'); b.scrollIntoView({ block: 'center' }); });
          await p.waitForTimeout(400);
          const geo = await p.evaluate(() => { const b = document.querySelector('#reader button.copy'), pr = b.nextElementSibling, c = b.getBoundingClientRect(), q = pr.getBoundingClientRect(), k = pr.querySelector('code').getBoundingClientRect(), s = document.querySelector('.reader-scroll').getBoundingClientRect(); const t = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
            return { btn: [c.left, c.top, c.right, c.bottom].map(Math.round), pre: [q.left, q.top, q.right, q.bottom].map(Math.round), onTop: t === b, inside: c.top >= s.top && c.bottom <= s.bottom, h: c.height, prevText: pr.previousElementSibling?.textContent, overlapsCode: !(c.bottom <= k.top || c.top >= k.bottom || c.right <= k.left || c.left >= k.right) }; });
          chk(5, geo.onTop && geo.inside, 'a copy button is visible and clickable', geo);
          chk(5, !geo.overlapsCode, 'the copy button does not lie over the code', geo);
          await shot(p, '6-copy');
          const done = await poke(p, '#reader button.copy'); await p.waitForTimeout(300);
          const clip = await p.evaluate(async () => { try { return [await navigator.clipboard.readText(), document.querySelector('#reader button.copy').textContent, document.querySelector('#reader button.copy').nextElementSibling.textContent]; } catch (e) { return ['!' + e.message]; } });
          chk(5, done === true && clip[0] === clip[2] && clip[1] === 'COPIED', 'clicking copy puts the code on the clipboard and says COPIED', done === true ? { label: clip[1], clipboardOk: clip[0] === clip[2], got: String(clip[0]).slice(0, 60) } : done);
        }
        await p.evaluate(() => { const q = [...document.querySelectorAll('#reader .post-body p')].find((e) => e.textContent.length > 120); q.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(400);
        const para = await p.evaluate(() => { const q = [...document.querySelectorAll('#reader .post-body p')].find((e) => e.textContent.length > 120), r = q.getBoundingClientRect(), t = document.elementFromPoint(r.left + 20, r.top + 8); const rr = document.createRange(); rr.selectNodeContents(q); const l = rr.getClientRects()[0];
          return { l: l.left, r: Math.min(r.right, l.right), y: l.top + l.height / 2, line: l.height, us: getComputedStyle(q).userSelect, covered: !t || !q.contains(t), text: q.textContent.slice(0, 30) }; });
        let selected = '';
        if (!phone) { await p.mouse.move(para.l + 1, para.y); await p.mouse.down(); await p.mouse.move((para.l + para.r) / 2, para.y, { steps: 6 }); await p.mouse.move(para.r - 1, para.y + para.line * 1.2, { steps: 6 }); await p.mouse.up(); selected = await p.evaluate(() => getSelection().toString()); }
        chk(5, para.us !== 'none' && !para.covered, 'article text is not user-select:none and nothing covers it', para);
        if (!phone) chk(5, selected.length > 10 && para.text.startsWith(selected.slice(0, 10)), 'a mouse drag selects text in the article', JSON.stringify(selected.slice(0, 60)));
        const sel = await p.evaluate(() => { const q = [...document.querySelectorAll('#reader .post-body p')].find((e) => e.textContent.length > 120); getSelection().removeAllRanges(); getSelection().selectAllChildren(q); return [getSelection().toString() === q.textContent, document.querySelector('#reader').contains(getSelection().anchorNode)]; });
        chk(5, sel[0] && sel[1], 'selectAllChildren selects the paragraph (getSelection() returns it)', sel);
        await p.evaluate(() => getSelection().removeAllRanges());
      }
    }

    if (opened) {
      if (phone) await poke(p, '.reader-close'); else await p.keyboard.press('Escape');
      let closed = await until(p, () => window.__lobby.reader.state() === 'closed', null, phone ? 4000 : 8000);
      if (!closed && phone) { console.log('  note: CLOSE could not be pressed; leaving with the bar\'s button (#back) so the rest can run'); await poke(p, '#back'); await shot(p, '6-close-failed'); closed = await until(p, () => window.__lobby.reader.state() === 'closed', null, 8000); closed = closed && 'closed via #back'; }
      await p.waitForTimeout(800);
      const s = await snap(p);
      chk(6, closed === true, `${phone ? 'the CLOSE button' : 'Escape'} closes the reader`, closed || s.state);
      chk(6, s.path === '/blog/', 'the address is /blog/', s.path);
      chk(6, s.title === 'Writing — Library', "the tab title is the room's again", s.title);
      chk(6, !s.readerShown && s.slug === null, 'the reader is hidden and reader.slug() is null', { shown: s.readerShown, slug: s.slug });
      chk(6, s.listShown === vols.length && s.current === 0, 'the list is shown with the chosen volume marked aria-current', { list: s.listShown, current: s.current });
      chk(6, s.held === A.slug, 'the book is still the one held', s.held);
      await shot(p, '7-closed');
      const second = await pickVolume(p, posts.indexOf(B));
      chk(6, second === true, `choosing a different volume ("${B.title}") makes held() change to it`, second === true ? '' : second);
      chk(6, (await snap(p)).current === posts.indexOf(B), 'and the list marks it', (await snap(p)).current);
    }

    if (opened) {
      const read = await readNow(p, posts.indexOf(B));
      chk(7, read.ok, `READ opens ${B.slug} (set-up for the link test)`);
      if (read.ok) {
        await p.waitForTimeout(800);
        const top0 = await p.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
        chk(7, top0 < 5, 'a second article, opened after the first was scrolled, starts at its top', top0);
        const next = await p.evaluate(() => document.querySelector('#reader .post-next a')?.getAttribute('href')), nslug = next?.match(/^\/blog\/([^/]+)\/$/)?.[1];
        chk(7, !!nslug, 'the article has a .post-next a link', next);
        if (nslug) {
          await p.evaluate(() => document.querySelector('#reader .post-next a').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
          await shot(p, '8-next');
          const mark = (await log(p)).length, t = Date.now(); await poke(p, '#reader .post-next a');
          const got = await until(p, (s) => window.__lobby.reader.state() === 'open' && window.__lobby.reader.slug() === s, nslug, 150000);
          await p.waitForTimeout(1200); const s = await snap(p), trail = (await log(p)).slice(mark).map((e) => `${e.state}:${e.slug ?? '-'}:${e.path}`);
          console.log(`  link to open: ${Date.now() - t} ms; trail ${trail.join(' > ')}`);
          chk(7, got, `following the link ends with the reader open on ${nslug}`, got ? '' : s);
          chk(7, s.path === next && s.title === title(nslug) && s.shownSlug === nslug && s.h1 === title(nslug) && s.held === nslug, 'the address, tab title, article and held book all follow', s);
          await shot(p, '9-next-open');
          const rail = await p.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
          chk(7, rail < 5, 'and the new article starts at its top', rail);

          const coherent = (s) => {
            const here = s.path.match(/^\/blog\/([^/]+)\/$/)?.[1];
            if (here) return [s.state === 'open' && s.slug === here && s.readerShown && s.shownSlug === here && s.title === title(here) && s.held === here, `address says ${here}`];
            if (s.path === '/blog/') return [s.state === 'closed' && s.slug === null && !s.readerShown && s.listShown && s.title === 'Writing — Library', 'address says the catalogue'];
            return [false, `unexpected address ${s.path}`];
          };
          const settle = async () => { let n = 0, s, t = Date.now(); for (; Date.now() - t < 120000 && n < 5; await sleep(400)) { s = await snap(p); n = coherent(s)[0] ? n + 1 : 0; } return [s, Date.now() - t]; };
          const steps = [['Back', () => p.goBack()], ['Back again', () => p.goBack()], ['Forward', () => p.goForward()], ['Forward again', () => p.goForward()]];
          for (const [i, [what, go]] of steps.entries()) {
            await go().catch((e) => e.message); await sleep(1000); const early = await snap(p);
            console.log(`  ${what} + 1 s: address ${early.path}, state ${early.state}, list ${early.listShown}, held ${early.held}`);
            const [s, took] = await settle(), [ok, why] = coherent(s);
            console.log(`  ${what}: now ${s.path} | state ${s.state} slug ${s.slug} | held ${s.held} | shown ${s.shownSlug} | title "${s.title}" | list ${s.listShown} | agreed after ${took} ms`);
            chk(7, ok, `after ${what}: the address, the reader's state and what is shown agree (${why})`, ok ? '' : s);
            await shot(p, `10-${i + 1}-${what.replace(/ /g, '-')}`);
          }
        }
      }
    }
  }

  if (!P.reducedMotion) {
    const k = await open(ctx, '/blog/', P);
    await k.evaluate(TERMINAL); await until(k, (n) => document.querySelectorAll('#ways.list [data-option]').length === n, posts.length, 20000); await k.waitForTimeout(1800);
    await k.evaluate(() => document.activeElement?.blur());
    let reached = 0; for (; reached < 60; reached++) { await k.keyboard.press('Tab'); if (await k.evaluate(() => document.activeElement?.dataset?.option === '1')) break; }
    chk(8, reached < 60, 'Tab reaches the second volume in the list', `after ${reached + 1} presses`);
    await k.keyboard.press('Enter');
    const heldOk = await until(k, (s) => window.__lobby.held() === s, posts[1].slug, 120000);
    chk(8, heldOk, 'Enter on a volume brings it', await k.evaluate(() => window.__lobby.held()));
    await until(k, () => window.__lobby.picks.find((x) => x.reads).live(), null, 20000); await k.waitForTimeout(1200);
    const mark = (await log(k)).length; await k.keyboard.press('Enter');
    const op = await until(k, () => window.__lobby.reader.state() === 'open', null, 60000); const kl = (await log(k)).slice(mark);
    const ks = await snap(k);
    chk(8, op, 'with a book open at the terminal, Enter starts reading and the article opens', op ? '' : { state: ks.state, trail: kl.map((e) => `${e.state}:${e.held}`).join(' > ') });
    chk(8, !kl.some((e) => e.held !== posts[1].slug), 'and the book stays held while it does (the focused button was activated by the same Enter)', kl.map((e) => `${e.state}:${e.held}`).join(' > '));
    if (op) {
      await k.waitForTimeout(800); await shot(k, '11-keys-open');
      const act = await k.evaluate(() => document.activeElement?.className || document.activeElement?.tagName);
      await k.keyboard.press('PageDown'); await k.waitForTimeout(500);
      const top = await k.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
      if (!phone) chk(8, top > 100, 'PageDown scrolls the article (focus starts in it)', { focus: act, scrollTop: Math.round(top) });
      let n = 0, hit = false; for (; n < 250; n++) { await k.keyboard.press('Tab'); if (await k.evaluate(() => document.activeElement?.classList.contains('reader-close'))) { hit = true; break; } }
      chk(8, hit, 'Tab reaches the CLOSE button', hit ? `after ${n + 1} presses from ${act}` : 'not within 250 presses');
      if (hit && n > 30) console.log(`  note: ${n + 1} Tab presses to reach CLOSE (it comes before the article in the page order)`);
      await k.keyboard.press('Escape'); const cl = await until(k, () => window.__lobby.reader.state() === 'closed', null, 8000); await k.waitForTimeout(600);
      const s = await snap(k);
      chk(8, cl && s.path === '/blog/' && s.listShown, 'Escape closes: state closed, address /blog/, the list shown', s);
      console.log(`  after Escape the focus is on: ${await k.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className)}`);
      await k.keyboard.press('Enter');
      const sc = await until(k, () => window.__lobby.reader.state() === 'scanning', null, 15000); await k.keyboard.press('Escape');
      const stopped = await until(k, () => window.__lobby.reader.state() === 'closed', null, 5000); await k.waitForTimeout(4000);
      const s2 = await snap(k);
      chk(6, sc && stopped && s2.state === 'closed' && !s2.readerShown && s2.path === '/blog/' && s2.slug === null, 'Escape during the scan stops it: closed, nothing shown, address /blog/, and it stays so', { scanning: sc, ...s2 });
      await k.keyboard.press('Enter');
      chk(6, await until(k, () => window.__lobby.reader.state() === 'open', null, 60000), 'and the same book can be read again afterwards');
    }
    await k.close();
  }

  if (P.reducedMotion) {
    const m = await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    chk(9, m, 'prefers-reduced-motion: reduce is in effect');
    await p.evaluate(TERMINAL); await until(p, (n) => document.querySelectorAll('#ways.list [data-option]').length === n, posts.length, 20000); await p.waitForTimeout(1500);
    const got = await pickVolume(p, 0); chk(9, got === true, 'a volume can be called (set-up)', got === true ? '' : got);
    const read = await readNow(p, 0), l = await log(p), tOpen = l.find((e) => e.state === 'open')?.t, tScan = l.find((e) => e.state === 'scanning')?.t;
    chk(9, read.ok && tOpen - read.t <= 1500, 'READ opens the article within about a second (no animation delay)', read.ok ? `${tOpen - read.t} ms from the click (scanning seen after ${tScan - read.t} ms)` : 'never opened');
    if (read.ok) {
      await p.waitForTimeout(2000); await shot(p, '1-open');
      const tf = await p.evaluate(() => document.querySelector('#reader').style.transform);
      chk(9, /^translate\(/.test(tf), 'and its transform is a plain translate once the camera is still', tf);
      const rail = await p.evaluate(() => document.querySelectorAll('.reader-rail a').length);
      if (rail > 2) {
        await poke(p, `.reader-rail li:nth-child(${rail >> 1}) a`); await p.waitForTimeout(150);
        const a = await p.evaluate(() => document.querySelector('.reader-scroll').scrollTop); await p.waitForTimeout(1200);
        const z = await p.evaluate(() => document.querySelector('.reader-scroll').scrollTop);
        chk(9, a > 0 && Math.abs(a - z) < 2, 'a contents link jumps without smooth scrolling', `${Math.round(a)} at 150 ms, ${Math.round(z)} later`);
      }
    }
  }

  const errs = [...new Set(P.errs)];
  chk(10, errs.length === 0, 'no pageerror, console error or failed request', errs.slice(0, 8));
  await ctx.close();
}

try { for (const name of which === 'all' ? ['desktop', 'phone', 'reduced'] : [which]) await run(name); } finally { await b.close(); }
console.log('\n=== summary');
const items = [...new Set(results.map((r) => r.item))].sort((a, b) => a - b);
for (const it of items) { const rs = results.filter((r) => r.item === it), bad = rs.filter((r) => !r.ok); console.log(`item ${it}: ${bad.length ? 'FAIL' : 'PASS'} (${rs.length - bad.length}/${rs.length})${bad.map((r) => `\n    [${r.profile}] ${r.what}${r.detail !== '' ? ' — ' + (typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)) : ''}`).join('')}`); }
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
console.log(process.exitCode ? 'library FAILED' : 'library ok');
