// Check of the posts, projects, room pages and lists as plain pages
import { chromium } from 'playwright';
import { plainChecks } from './plaincheck.mjs';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const index = await (await fetch(`${ORIGIN}/blog/index.json`)).json();
const projects = (await (await fetch(`${ORIGIN}/portfolio/index.json`)).json()).projects;
const pages = [['/blog/', 'list'], ...index.posts.map((p) => [`/blog/${p.slug}/`, 'post']), ['/about/', 'post'], ['/portfolio/', 'list'], ...projects.map((p) => [p.url, 'post']), ['/experience/', 'post'], ['/contact/', 'post']];
const SIZES = [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]];
let failed = 0;
const say = (ok, item, where, what) => { if (!ok) failed++; if (!ok || item === 13) console.log(`${ok ? 'ok  ' : 'FAIL'} [${item}] ${where}: ${what}`); };
const guard = new Set();

async function imageChecks(p) {
  const tall = await p.evaluate(() => [document.scrollingElement.scrollHeight, innerHeight]);
  for (let y = 0; y <= tall[0]; y += tall[1] * 0.7) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
  for (let n = 0; n < 80 && !(await p.evaluate(() => [...document.querySelectorAll('main#page img')].every((i) => i.complete))); n++) await p.waitForTimeout(100);
  return p.evaluate(() => {
    const found = [], notes = [], imgs = [...document.querySelectorAll('main#page img')], W = innerWidth;
    for (const i of imgs) {
      const name = `${i.className || 'img'} ${(i.getAttribute('src') || '').split('/').pop().slice(0, 36)}`, r = i.getBoundingClientRect(), box = i.parentElement.closest('li, figure, section, article, p, div') ?? i.parentElement, c = box.getBoundingClientRect(), cs = getComputedStyle(box);
      const inner = { left: c.left + parseFloat(cs.paddingLeft), right: c.right - parseFloat(cs.paddingRight) };
      if (!i.naturalWidth) found.push(`${name}: did not load`);
      if (r.width > W + 0.5 || r.right > W + 0.5 || r.left < -0.5) found.push(`${name}: ${Math.round(r.left)}..${Math.round(r.right)} in a ${W} px window`);
      if (r.width > inner.right - inner.left + 1 || r.left < c.left - 1 || r.right > c.right + 1) found.push(`${name}: ${Math.round(r.width)} px wide in a container ${Math.round(c.width)} px wide (${box.tagName.toLowerCase()}.${box.className}, content ${Math.round(inner.right - inner.left)})`);
      const aw = +i.getAttribute('width'), ah = +i.getAttribute('height');
      if (aw && ah && r.width && r.height && Math.abs(r.width / r.height - aw / ah) / (aw / ah) > 0.03) found.push(`${name}: shown ${Math.round(r.width)}x${Math.round(r.height)}, written ${aw}x${ah} (distorted)`);
      if (r.width && r.height && Math.max(r.width, r.height) > 0.6 * Math.max(innerWidth, 400) && /logo|badge/.test(i.className)) notes.push(`${name}: a ${/logo/.test(i.className) ? 'logo' : 'badge'} shown ${Math.round(r.width)}x${Math.round(r.height)} in a ${W} px window`);
      if (/logo|badge/.test(i.className)) notes.push(`${i.className}: ${Math.round(r.width)}x${Math.round(r.height)} (written ${aw}x${ah}, file ${i.naturalWidth}x${i.naturalHeight})`);
    }
    scrollTo(0, 0); return { found, notes: [...new Set(notes)], n: imgs.length };
  });
}
async function checkPage(ctx, item, path, kind, size) {
  const where = `${path} ${size}`, p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); });
  const res = await p.goto(ORIGIN + path, { waitUntil: 'load' });
  say(res.status() === 200, item, where, `status ${res.status()}`);
  if (item === 12) {
    const gl = await p.evaluate(() => { const c = document.createElement('canvas'); return [c.getContext('webgl2'), document.createElement('canvas').getContext('webgl')].map((x) => !!x); });
    say(!gl[0] && !gl[1], 12, where, `canvas.getContext('webgl2') / ('webgl') exist: ${gl}`);
    const done = await p.waitForFunction(() => document.querySelector('#loader')?.dataset.failed, null, { timeout: 60000 }).then(() => true, () => false);
    say(done, 12, where, 'main.js gave up on WebGL (#loader[data-failed])'); await p.waitForTimeout(1200);
    const o = await p.evaluate(() => { const l = document.querySelector('#loader'), s = getComputedStyle(l); return { cls: document.documentElement.className, loader: s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || l.getClientRects().length === 0, what: document.querySelector('#what')?.textContent }; });
    say(o.cls === '' && o.loader, 12, where, `no loader or error cover over the page (html class "${o.cls}", loader hidden ${o.loader}, its text "${o.what}")`);
  }
  const { found, notes } = await plainChecks(p, kind);
  let bad = 0;
  for (const [name, list] of Object.entries(found)) { say(list.length === 0, item, where, name + (list.length ? ': ' + list.slice(0, 6).join(' | ') + (list.length > 6 ? ` | (+${list.length - 6})` : '') : '')); bad += list.length; }
  const imgs = await imageChecks(p);
  for (const f of imgs.found) say(false, item, where, f);
  bad += imgs.found.length;
  for (const n of imgs.notes) console.log(`     note ${where}: ${n}`);
  if (!bad) console.log(`ok   [${item}] ${where}: ${Object.keys(found).join(', ')}`);
  for (const n of [...new Set(notes.map((x) => x.replace(/\(\d+ in \d+\)/, '')))]) console.log(`     note ${where}: ${n}`);
  if (item === 12) for (const e of [...new Set(errs)]) console.log(`     note ${where}: expected from the failed start: ${e}`);
  else for (const e of [...new Set(errs)]) say(false, item, where, `JavaScript is off but: ${e}`);
  if (bad) await p.screenshot({ path: `/out/plain-${item}-${path.replace(/\W+/g, '_')}-${size}.png` });
  await p.close();
}

{
  const b = await chromium.launch();
  for (const [size, viewport] of SIZES) {
    const ctx = await b.newContext({ javaScriptEnabled: false, viewport });
    for (const [path, kind] of pages) await checkPage(ctx, 11, path, kind, size);
    await ctx.close();
  }
  await b.close();
}
{
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis', '--disable-software-rasterizer'] });
  for (const [size, viewport] of SIZES) {
    const ctx = await b.newContext({ viewport });
    for (const [path, kind] of pages) await checkPage(ctx, 12, path, kind, size);
    await ctx.close();
  }
  await b.close();
}
for (const path of ['/blog/no-such-post/', '/blog/no-such-post', '/portfolio/no-such-project/', '/portfolio/no-such-project']) {
  const r = await fetch(ORIGIN + path, { redirect: 'follow' }), body = await r.text();
  say(r.status === 404, 13, path, `status ${r.status}`);
  say(!/<article|class="post-list"/.test(body), 13, path, 'and the body is not an article or the list (no soft 404)');
}
console.log(failed ? `plainpage FAILED (${failed})` : 'plainpage ok');
process.exitCode = failed ? 1 : 0;
