// Generated page as a crawler or a reader without JavaScript sees it
import { chromium } from 'playwright';
import { streamAbort } from './reqfail.mjs';
const path = process.argv[2] || '/blog/every-construct/';
const kind = /^\/(blog|portfolio)\/$/.test(path) ? 'list' : /^\/blog\/[^/]+\/$/.test(path) ? 'post' : /^\/portfolio\/[^/]+\/$/.test(path) ? 'project'
  : { '/about/': 'about', '/experience/': 'experience', '/contact/': 'contact' }[path];
if (!kind) { console.log('FAIL not a generated page:', path); process.exit(1); }
const b = await chromium.launch();
let failed = 0;
const fail = (...m) => { failed++; console.log('FAIL', ...m); };
try {
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  const requests = [];
  p.on('request', r => requests.push({ url: r.url(), type: r.resourceType() }));
  p.on('requestfailed', r => streamAbort(r) || fail('request failed', r.url(), r.failure()?.errorText));
  p.on('response', r => { if (r.status() >= 400) fail('http', r.status(), r.url()); });
  const res = await p.goto(process.env.ORIGIN + path, { waitUntil: 'load' });
  if (res.status() !== 200) fail('page status', res.status());
  const scripts = requests.filter(r => r.type === 'script' || /\.m?js$/.test(new URL(r.url).pathname)).map(r => r.url);
  if (scripts.length) fail('scripts were requested with JavaScript disabled:', scripts.join(' '));
  console.log('kind:', kind);

  const root = kind === 'list' ? 'main#page > section.post-list' : kind === 'post' ? 'main#page > article.post'
    : kind === 'project' ? 'main#page > article.post.project[data-slug]' : `main#page > article.post.page[data-slug="${kind}"]`;
  const content = p.locator(root);
  if (await content.count() !== 1) fail(root, 'count', await content.count());
  if (await p.locator('main#page > *').count() !== 1) fail('main#page holds more than its article');
  const h1 = (await p.locator(`${root} h1`).first().textContent())?.trim();
  if (!h1 || await p.locator('main#page h1').count() !== 1) fail('not exactly one h1'); else console.log('h1:', h1);
  const required = {
    list: ['.post-lede', 'ol > li > a', 'ol > li > p.post-meta'],
    post: ['header .post-meta time', 'header .post-lede', 'div.post-body', 'div.post-body h2[id]', 'div.post-body p'],
    project: ['header .post-meta .post-status', 'header .post-lede'],
    about: ['header .post-meta', 'header .post-lede', 'div.post-body h2[id]', 'div.post-body p', 'ul.post-links a'],
    experience: ['header .post-lede', 'section.entry[id] > h2', 'section.entry[id] > p.post-meta', 'div.post-body h2[id]', 'ul.post-tags li'],
    contact: ['header .post-lede', 'ul.post-links a', 'div.post-body h2[id]'],
  }[kind];
  const optional = {
    list: ['h2[id]', 'li.quiet'],
    post: ['div.post-body pre[data-lang] > code', 'div.post-body figure > img', 'ul.post-tags', 'section.post-takeaways', 'footer .post-changelog', 'footer .post-next'],
    project: ['header .post-role', 'header .post-status-note', 'ul.post-tags', 'figure.post-cover > img', 'div.post-body', 'div.post-body h2[id]',
      'dl.post-facts', 'ul.post-links', 'footer .post-next'],
    about: ['ul.post-curiosities > li', 'p.post-availability', 'p.post-cta a', 'p.post-featured a'],
    experience: ['section.entry img.entry-logo', 'ul.post-credentials > li', 'ul.post-credentials img.post-badge', 'ul.post-talks > li'],
    contact: ['p.post-availability'],
  }[kind];
  for (const part of required) {
    const n = await p.locator(`${root} ${part}`).count();
    if (!n) fail('missing', part); else console.log(`${part}: ${n}`);
  }
  for (const part of optional) console.log(`${part}: ${await p.locator(`${root} ${part}`).count()}`);
  if (await p.locator('script[type="application/ld+json"]').count() !== 1) fail('JSON-LD script count');
  const ld = JSON.parse(await p.locator('script[type="application/ld+json"]').textContent());
  console.log('JSON-LD:', ld['@type']);
  const canonical = await p.locator('link[rel="canonical"]').getAttribute('href');
  if (!canonical?.endsWith(path)) fail('canonical link', canonical);
  const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
  if (new Set(ids).size !== ids.length) fail('an id is used twice', ids.filter((x, i) => ids.indexOf(x) !== i));
  if (await p.locator(`${root} form, ${root} input, ${root} script`).count()) fail('a form, an input or a script in the content');

  const imgs = p.locator(`${root} img`);
  for (let i = 0; i < await imgs.count(); i++) {
    const img = imgs.nth(i);
    await img.scrollIntoViewIfNeeded();
    await p.waitForFunction(el => el.complete, await img.elementHandle(), { timeout: 15000 }).catch(() => {});
    const [src, nw, nh] = await img.evaluate(el => [el.getAttribute('src'), el.naturalWidth, el.naturalHeight]);
    if (!(nw > 0)) fail('image not loaded', src);
    else if (`${nw}x${nh}` !== `${await img.getAttribute('width')}x${await img.getAttribute('height')}`) fail('width/height attributes differ from the file', src, nw, nh);
    else console.log('image', src, `${nw}x${nh}`);
  }
  const hrefs = await p.locator(`${root} a[href]`).evaluateAll(as => as.map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
  const site = new Set();
  for (const [h, target, rel] of hrefs) {
    if (/^https?:\/\//.test(h)) { if (target !== '_blank' || rel !== 'noopener') fail('external link without target/rel', h); }
    else if (h.startsWith('/') && !h.startsWith('//')) site.add(h);
    else fail('link not allowed', h);
  }
  const pages = new Map();
  for (const h of site) {
    const [where, frag] = h.split('#');
    if (!pages.has(where)) {
      const r = await ctx.request.get(process.env.ORIGIN + where, { maxRedirects: 0 });
      pages.set(where, r.status() === 200 && where.endsWith('/') ? await r.text() : '');
      if (r.status() !== 200) fail('link', h, r.status());
    }
    if (frag && !pages.get(where).includes(` id="${frag}"`)) fail('link to a missing id', h);
  }
  console.log(`${hrefs.length} links, ${site.size} on the site, all answered`);
  await p.evaluate(() => { document.documentElement.scrollTop = document.body.scrollTop = 0; });
  await p.screenshot({ path: '/out/page.png' });
  for (const over of ['#loader', '#scene']) await p.locator(over).evaluate(el => { el.style.display = 'none'; });
  const box = await content.boundingBox();
  await p.setViewportSize({ width: 1000, height: Math.ceil(Math.min(box.y + box.height, 16000)) });
  await content.screenshot({ path: '/out/page-article.png' });
  console.log(failed ? `${failed} failed` : 'page ok', path);
} finally { await b.close(); }
process.exitCode = failed ? 1 : 0;
