// plainpage.mjs: the posts and the list as plain pages.
//   11: JavaScript disabled, at 1280x720 and at 390x844: scrolls, uncovered, one h1, heading levels, alt text, link names,
//       contrast, nothing wider than the window, code scrolls inside itself (checks in plaincheck.mjs)
//   12: WebGL unavailable (Chromium started so that getContext('webgl2') and ('webgl') are null; verified on each page):
//       the same checks, and no error overlay over the text
//   13: /blog/no-such-post/ answers 404
// Findings print as FAIL lines with their evidence; exit code 1 if any. A screenshot of each failing page goes to /out.
import { chromium } from 'playwright';
import { plainChecks } from './plaincheck.mjs';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const index = await (await fetch(`${ORIGIN}/blog/index.json`)).json();
const pages = [['/blog/', 'list'], ...index.posts.map((p) => [`/blog/${p.slug}/`, 'post'])];
const SIZES = [['desktop', { width: 1280, height: 720 }], ['phone', { width: 390, height: 844 }]];
let failed = 0;
const say = (ok, item, where, what) => { if (!ok) failed++; if (!ok || item === 13) console.log(`${ok ? 'ok  ' : 'FAIL'} [${item}] ${where}: ${what}`); };
const guard = new Set();

async function checkPage(ctx, item, path, kind, size) {
  const where = `${path} ${size}`, p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); });
  const res = await p.goto(ORIGIN + path, { waitUntil: 'load' });
  say(res.status() === 200, item, where, `status ${res.status()}`);
  if (item === 12) {                                                          // let main.js give up, and make sure it was WebGL it could not have
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
  if (!bad) console.log(`ok   [${item}] ${where}: ${Object.keys(found).join(', ')}`);
  for (const n of [...new Set(notes.map((x) => x.replace(/\(\d+ in \d+\)/, '')))]) console.log(`     note ${where}: ${n}`);
  if (item === 12) for (const e of [...new Set(errs)]) console.log(`     note ${where}: expected from the failed start: ${e}`);
  else for (const e of [...new Set(errs)]) say(false, item, where, `JavaScript is off but: ${e}`);
  if (bad) await p.screenshot({ path: `/out/plain-${item}-${path.replace(/\W+/g, '_')}-${size}.png` });
  await p.close();
}

// ---- 11: no JavaScript
{
  const b = await chromium.launch();
  for (const [size, viewport] of SIZES) {
    const ctx = await b.newContext({ javaScriptEnabled: false, viewport });
    for (const [path, kind] of pages) await checkPage(ctx, 11, path, kind, size);
    await ctx.close();
  }
  await b.close();
}
// ---- 12: no WebGL
{
  const b = await chromium.launch({ args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis', '--disable-software-rasterizer'] });
  for (const [size, viewport] of SIZES) {
    const ctx = await b.newContext({ viewport });
    for (const [path, kind] of pages) await checkPage(ctx, 12, path, kind, size);
    await ctx.close();
  }
  await b.close();
}
// ---- 13: an unknown post
for (const path of ['/blog/no-such-post/', '/blog/no-such-post']) {
  const r = await fetch(ORIGIN + path, { redirect: 'follow' }), body = await r.text();
  say(r.status === 404, 13, path, `status ${r.status}`);
  say(!/<article|class="post-list"/.test(body), 13, path, 'and the body is not an article or the list (no soft 404)');
}
console.log(failed ? `plainpage FAILED (${failed})` : 'plainpage ok');
process.exitCode = failed ? 1 : 0;
