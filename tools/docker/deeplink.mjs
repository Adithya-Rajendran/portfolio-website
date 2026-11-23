// deeplink.mjs <slug> [w] [h]: an article's own URL. It is a readable page at once; the Library then takes over (or offers to).
import { chromium } from 'playwright';
const [slug, W = '1280', H = '720'] = process.argv.slice(2), ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const fail = (...m) => { process.exitCode = 1; console.log('FAIL', ...m); };
async function visit(name, scrollFirst) {
  const p = await b.newPage({ viewport: { width: +W, height: +H }, ...(+W < 600 ? { hasTouch: true, isMobile: true } : {}) });
  p.on('pageerror', (e) => fail(name, 'pageerror', e.message)); p.on('console', (m) => { if (m.type() === 'error') fail(name, 'console', m.text().slice(0, 200)); });
  const t0 = Date.now(); await p.goto(`${ORIGIN}/blog/${slug}/?shot=hero&rollat=20`, { waitUntil: 'domcontentloaded' });
  const first = await p.evaluate(() => ({ mode: document.documentElement.className, h1: document.querySelector('#page h1')?.getBoundingClientRect().top, shown: getComputedStyle(document.querySelector('#page')).display }));
  console.log(name, 'at', Date.now() - t0, 'ms:', JSON.stringify(first)); if (first.mode !== 'reading' || first.shown !== 'block') fail(name, 'the article is not readable at once');
  await p.screenshot({ path: `/out/${name}-1-page.png` });
  if (scrollFirst) { await p.mouse.wheel(0, 2600); await p.waitForTimeout(300); }
  if (scrollFirst) {
    await p.waitForSelector('#stepin', { timeout: 120000 }); await p.screenshot({ path: `/out/${name}-2-offer.png` });
    if (await p.evaluate(() => document.documentElement.className) !== 'reading') fail(name, 'a reader who had scrolled was taken away from the page');
    await p.click('#stepin');
  }
  await p.waitForFunction(() => window.__lobby?.reader.state() === 'open', null, { timeout: 120000 }); await p.waitForTimeout(700);
  const st = await p.evaluate(() => ({ mode: document.documentElement.className, slug: window.__lobby.reader.slug(), path: location.pathname, title: document.title, top: document.querySelector('.reader-scroll').scrollTop,
    inPage: !!document.querySelector('#page article.post'), inReader: !!document.querySelector('#reader article.post'), transform: document.querySelector('#reader').style.transform }));
  console.log(name, 'open after', Date.now() - t0, 'ms:', JSON.stringify(st));
  if (st.mode !== 'station' || st.slug !== slug || !st.inReader || st.inPage || !st.transform.startsWith('translate(')) fail(name, 'not reading in the Library');
  if (scrollFirst && st.top < 200) fail(name, 'the place in the text was lost');
  await p.screenshot({ path: `/out/${name}-3-open.png` }); await p.close();
}
await visit('fresh', false); await visit('scrolled', true);
console.log(process.exitCode ? 'deeplink FAILED' : 'deeplink ok'); await b.close();
