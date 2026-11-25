// writing-alias.mjs: /blog/ opens the Library, the room query names nothing (the Atrium opens, the address stays), and the nav and the
// Back button between the Library and another room agree with the address.
import { chromium } from 'playwright';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`); });
p.on('requestfailed', (r) => errs.push(`request failed: ${r.url()}`)); p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()} ${r.url()}`); });
let failed = 0;
const chk = (ok, what, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail !== '' ? ' — ' + JSON.stringify(detail) : ''}`); };
const room = (id) => p.waitForFunction((r) => window.__lobby?.mode().room === r && document.querySelector('#loader.done'), id, { timeout: 150000, polling: 250 }).then(() => true, () => false);
const where = () => p.evaluate(() => ({ room: window.__lobby.mode().room, path: location.pathname + location.search, title: document.title, volumes: window.__lobby.volumes().length }));

await p.goto(`${ORIGIN}/blog/?shot=hero&rollat=20`);
chk(await room('writing'), '/blog/ opens the Library'); let w = await where();
chk(w.volumes > 0 && w.title === 'Writing — Library', 'with its volumes and title', w);

const gone = new URLSearchParams([['room', 'about'], ['shot', 'hero'], ['rollat', '20']]);
await p.goto(`${ORIGIN}/?${gone}`); chk(await room('lobby'), 'a room-query address opens the Atrium'); w = await where(); chk(w.path === `/?${gone}`, 'and the address stays', w);
await p.goto(`${ORIGIN}/about/?shot=hero&rollat=20`); chk(await room('about'), '/about/ opens the About room');
await p.click('#hud nav a[data-room="writing"]');
chk(await room('writing'), 'the WRITING link in the nav leads to the Library'); w = await where();
chk(w.path.startsWith('/blog/'), 'at /blog/', w);
await p.goBack(); chk(await room('about'), 'Back leads to the About room'); w = await where(); chk(w.path.startsWith('/about/'), 'and the address agrees', w);
await p.goForward(); chk(await room('writing'), 'Forward leads to the Library again'); w = await where(); chk(w.path.startsWith('/blog/'), 'and the address agrees', w);
chk(errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 6));
await b.close(); console.log(failed ? 'writing-alias FAILED' : 'writing-alias ok'); process.exitCode = failed ? 1 : 0;
