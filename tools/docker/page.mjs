// A generated page read the way a crawler or a reader without JavaScript sees it:  tools/dtest.sh page.mjs /blog/<slug>/
// Generate the pages first (python3 tools/site.py). Checks the DOM, not the looks: the article has no stylesheet yet and
// the loader overlay covers it when no script runs. Saves /out/page.png (the viewport, as served) and
// /out/page-article.png (the article with #loader and the canvas hidden, after every check has run).
import { chromium } from 'playwright';
const path = process.argv[2] || '/blog/every-construct/';
const b = await chromium.launch();
let failed = 0;
const fail = (...m) => { failed++; console.log('FAIL', ...m); };
try {
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage();
  const requests = [];
  p.on('request', r => requests.push(r.url()));
  p.on('requestfailed', r => fail('request failed', r.url(), r.failure()?.errorText));
  p.on('response', r => { if (r.status() >= 400) fail('http', r.status(), r.url()); });
  const res = await p.goto(process.env.ORIGIN + path, { waitUntil: 'load' });
  if (res.status() !== 200) fail('page status', res.status());
  if (requests.some(u => u.endsWith('/main.js'))) fail('main.js was requested with JavaScript disabled');

  const article = p.locator('article.post');
  if (await article.count() !== 1) fail('article.post count', await article.count());
  const h1 = (await p.locator('article.post header h1').textContent())?.trim();
  if (!h1) fail('no h1 in the article header'); else console.log('h1:', h1);
  if (await p.locator('main#page > article.post').count() !== 1) fail('article.post is not in main#page');
  for (const part of ['header .post-meta time', 'header .post-lede', 'div.post-body', 'div.post-body h2[id]', 'div.post-body p',
                      'div.post-body pre[data-lang] > code', 'div.post-body figure > img']) {
    const n = await p.locator(`article.post ${part}`).count();
    if (!n) fail('missing', part); else console.log(`${part}: ${n}`);
  }
  for (const part of ['ul.post-tags', 'section.post-takeaways', 'footer .post-changelog', 'footer .post-next'])   // optional parts
    console.log(`${part}: ${await p.locator(`article.post ${part}`).count()}`);
  if (await p.locator('script[type="application/ld+json"]').count() !== 1) fail('JSON-LD script count');
  if (!await p.locator('link[rel="canonical"]').getAttribute('href')) fail('no canonical link');

  // Every image in the article has loaded (scroll to each: with scripting off Chromium loads lazy images anyway, but
  // the check should not depend on that).
  const imgs = p.locator('article.post img');
  for (let i = 0; i < await imgs.count(); i++) {
    const img = imgs.nth(i);
    await img.scrollIntoViewIfNeeded();
    await p.waitForFunction(el => el.complete, await img.elementHandle(), { timeout: 15000 }).catch(() => {});
    const [src, nw, nh] = await img.evaluate(el => [el.getAttribute('src'), el.naturalWidth, el.naturalHeight]);
    if (!(nw > 0)) fail('image not loaded', src);
    else if (`${nw}x${nh}` !== `${await img.getAttribute('width')}x${await img.getAttribute('height')}`) fail('width/height attributes differ from the file', src, nw, nh);
    else console.log('image', src, `${nw}x${nh}`);
  }
  await p.evaluate(() => { document.documentElement.scrollTop = document.body.scrollTop = 0; });   // body is the scroller
  await p.screenshot({ path: '/out/page.png' });
  for (const over of ['#loader', '#scene']) await p.locator(over).evaluate(el => { el.style.display = 'none'; });
  const box = await article.boundingBox();                // the shell's style.css does not scroll the page: grow the window
  await p.setViewportSize({ width: 1000, height: Math.ceil(Math.min(box.y + box.height, 16000)) });
  await article.screenshot({ path: '/out/page-article.png' });
  console.log(failed ? `${failed} failed` : 'page ok', path);
} finally { await b.close(); }
process.exitCode = failed ? 1 : 0;
