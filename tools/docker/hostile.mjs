// hostile.mjs: what the rooms do when the published data is hostile or thin. blog/index.json, portfolio/index.json and profile.json are
// answered with markup in every string, not at all, in the wrong shape, and with no projects and a single timeline entry: nothing may
// run or appear as an element, and every room must still open.
import { chromium } from 'playwright';
const O = process.env.ORIGIN || 'http://127.0.0.1:8080', b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const bad = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>{tminus}';
const taint = (v) => (typeof v === 'string' ? (/^(\/|https?:)/.test(v) || /^\d{4}$/.test(v) ? v : v + bad) : Array.isArray(v) ? v.map(taint) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'id' || k === 'slug' || k === 'v' || k === 'kind' ? x : taint(x)])) : v);
async function run(name, mutate, paths) {
  for (const path of paths) {
    const p = await b.newPage({ viewport: { width: 1100, height: 700 } }), errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errs.push(m.text().slice(0, 160)); });   // (a file answered 404 on purpose is not the page's error)
    await p.route(/\/(profile|portfolio\/index|blog\/index)\.json/, async (r) => { const res = await r.fetch(); const out = mutate(new URL(r.request().url()).pathname, await res.json()); if (out === 404) return r.fulfill({ status: 404, body: 'no' }); r.fulfill({ response: res, json: out }); });
    await p.goto(`${O}${path}?shot=hero`);
    const ok = await p.waitForFunction(() => window.__lobby?.ready() >= 1 && document.querySelector('#loader.done'), null, { timeout: 90000 }).then(() => true, () => false);
    await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ xss: window.__xss ?? 0, imgs: document.querySelectorAll('#hud img, #hud script, #inspectbar img').length, sub: document.querySelector('.sub')?.textContent.slice(0, 90), cta: document.querySelector('.hero .cta')?.textContent ?? null, facts: document.querySelector('#hud > footer')?.textContent.slice(0, 60) }));
    console.log(!ok || r.xss || r.imgs || errs.length ? 'FAIL' : 'ok  ', name, path, ok ? '' : 'DID NOT LOAD', JSON.stringify(r), errs.slice(0, 2).join(' | '));
    if (!ok || r.xss || r.imgs || errs.length) process.exitCode = 1;
    await p.close();
  }
}
const rooms = ['/about/', '/portfolio/', '/experience/', '/contact/', '/blog/', '/'];
await run('markup in every string', (path, j) => taint(j), rooms);
await run('nothing published', () => 404, rooms);
await run('wrong shape', () => ({}), rooms);
await run('no projects, one stop', (path, j) => (path.includes('portfolio') ? { ...j, projects: [] } : path.includes('profile') ? { ...j, timeline: j.timeline.slice(0, 1), links: [...j.links, ...j.links] } : j), ['/portfolio/', '/experience/', '/contact/']);
console.log(process.exitCode ? 'hostile FAILED' : 'hostile ok'); await b.close();
