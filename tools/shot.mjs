// node shot.mjs out.png [width height] [mouseX mouseY] [?query]  — screenshot of the running site (http://localhost:8123)
import { chromium } from 'playwright';
const [out = '/tmp/shot.png', w = 1280, h = 720, mx = '', my = '', hud = '1'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('requestfailed', (r) => console.log('[failed]', r.url()));
await p.goto('http://localhost:8123/', { waitUntil: 'load' });
await p.waitForFunction(() => window.__lobby && window.__lobby.ready() > 0, null, { timeout: 120000 });
if (mx !== '') await p.mouse.move((+mx * 0.5 + 0.5) * w, (+my * 0.5 + 0.5) * h);
await p.waitForFunction(() => window.__lobby.ready() >= 1, null, { timeout: 900000 });
await p.waitForTimeout(3000);
if (hud === '0') await p.evaluate(() => (document.getElementById('hud').style.display = 'none'));
await p.screenshot({ path: out, timeout: 300000 });
await b.close();
