// Check that the address, the Back button and the reader agree
import { chromium } from 'playwright';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080', Q = '?shot=hero&rollat=20';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const fail = (...m) => { process.exitCode = 1; console.log('FAIL', ...m); }, ok = (m) => console.log('ok  ', m);
const posts = (await (await fetch(`${ORIGIN}/blog/index.json`)).json()).posts, A = posts.find((p) => posts.some((q) => q.slug !== p.slug)), slugs = posts.map((p) => p.slug);
async function page() {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => fail('pageerror', e.message)); p.on('console', (m) => { if (m.type() === 'error') fail('console', m.text().slice(0, 200)); });
  return p;
}
const state = (p) => p.evaluate(() => ({ path: location.pathname, state: window.__lobby.reader.state(), slug: window.__lobby.reader.slug(), room: window.__lobby.mode().room, shown: document.querySelector('#reader article.post')?.dataset.slug ?? null, title: document.title }));
const open = (p, slug) => p.waitForFunction((s) => window.__lobby?.reader.state() === 'open' && window.__lobby.reader.slug() === s && document.querySelector('#reader article.post')?.dataset.slug === s, slug, { timeout: 90000 });
const room = (p, id) => p.waitForFunction((id) => window.__lobby?.mode().room === id && document.querySelector('#loader.done'), id, { timeout: 120000 });

{
  const p = await page(); await p.goto(`${ORIGIN}/blog/${A.slug}/${Q}`, { waitUntil: 'domcontentloaded' }); await p.mouse.wheel(0, 1800);
  await p.waitForSelector('#stepin', { timeout: 120000 });
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft'); await p.mouse.click(300, 400); await p.waitForTimeout(400);
  const s = await p.evaluate(() => ({ path: location.pathname, mode: document.documentElement.className, bar: !document.querySelector('#inspectbar').hidden }));
  if (s.path !== `/blog/${A.slug}/` || s.mode !== 'reading' || s.bar) fail('1 the hidden room reacted:', JSON.stringify(s)); else ok('1 keys and clicks on the page leave the hidden room alone');
  await p.click('#stepin'); await open(p, A.slug); ok('1 the offer still opens the article there'); await p.close();
}
{
  const p = await page(); await p.goto(`${ORIGIN}/blog/${A.slug}/${Q}`); await open(p, A.slug);
  const B = await p.evaluate(() => document.querySelector('#reader .post-next a')?.getAttribute('href')?.split('/')[2]);
  if (!B) fail('2 the article has no next link'); else {
    const n0 = await p.evaluate(() => history.length); await p.click('#reader .post-next a'); await open(p, B);
    const n1 = await p.evaluate(() => history.length); if (n1 - n0 !== 1) fail('2 following a link added', n1 - n0, 'history entries'); else ok('2 a link to another post adds one history entry');
    await p.goBack(); await open(p, A.slug); let s = await state(p); if (s.path !== `/blog/${A.slug}/`) fail('2 after Back', JSON.stringify(s)); else ok('2 Back reopens the first post');
    await p.goForward(); await open(p, B); s = await state(p); if (s.path !== `/blog/${B}/`) fail('2 after Forward', JSON.stringify(s)); else ok('2 Forward reopens the second');
  }
  await p.click('#hud nav a[data-room="lobby"]'); await room(p, 'lobby'); await p.goBack(); await room(p, 'writing');
  const want = (await state(p)).path.split('/')[2]; await open(p, want); ok('4 Back into the Library reopens the post in the address'); await p.close();
}
{
  const p = await page(); await p.goto(`${ORIGIN}/blog/${Q}`); await room(p, 'writing'); await p.waitForTimeout(800);
  await p.evaluate((s) => { window.__lobby.reader.read(s); }, slugs[1]); await p.waitForTimeout(2500); await p.keyboard.press('Escape');
  await p.waitForTimeout(12000);
  await p.evaluate(() => { const l = window.__lobby; l.setFocus(l.picks.find((q) => q.options)); }); await p.waitForTimeout(600);
  await p.click('#ways [data-option="1"]'); await p.waitForFunction((s) => window.__lobby.held() === s, slugs[1], { timeout: 60000 }); await p.waitForTimeout(3000);
  const s = await state(p); if (s.state !== 'closed' || s.path !== '/blog/') fail('3 the article opened by itself:', JSON.stringify(s)); else ok('3 a called-off request stays called off');
  const shown = await p.evaluate(() => !document.querySelector('#enter').hidden); if (!shown) fail('3 no READ button in the bar while the book lies open'); else ok('3 READ is also a button in the bar');
  await p.click('#enter'); await open(p, slugs[1]); ok('3 and it opens the article'); await p.close();
}
{
  const p = await page(), gone = new URLSearchParams([['room', 'about'], ['shot', 'hero']]); await p.goto(`${ORIGIN}/?${gone}`); await room(p, 'lobby'); ok('5 a room-query address is the Atrium'); if (new URL(p.url()).search !== `?${gone}`) fail('5 the address changed: ' + p.url()); await p.close();
}
{
  const p = await page(), sec = A.sections.filter((x) => x.level === 2).at(-1).id;
  await p.goto(`${ORIGIN}/about/${Q}`); await room(p, 'about');
  await p.goto(`${ORIGIN}/blog/${A.slug}/${Q}#${sec}`);
  await p.waitForSelector('#stepin', { timeout: 120000 }); await p.click('#stepin'); await open(p, A.slug); await p.waitForTimeout(500);
  const at = await p.evaluate((id) => { const h = document.querySelector(`#reader #${CSS.escape(id)}`), s = document.querySelector('.reader-scroll'); return h ? Math.round(h.getBoundingClientRect().top - s.getBoundingClientRect().top) : null; }, sec);
  if (at === null || at < -5 || at > 160) fail('6 the post did not open at the section:', at); else ok('6 a #fragment opens the post at that section');
  await p.goBack(); await room(p, 'about'); const s = await state(p);
  if (s.path !== '/about/' || s.state !== 'closed') fail('6 Back from a #fragment address:', JSON.stringify(s)); else ok('6 Back leaves the post');
  await p.close();
}
console.log(process.exitCode ? 'history FAILED' : 'history ok'); await b.close();
