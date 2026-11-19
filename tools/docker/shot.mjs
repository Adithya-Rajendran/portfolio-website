// Runs inside mcr.microsoft.com/playwright.  node shot.mjs <url> <out.png> [engine] [w] [h] [mouseX] [mouseY] [hud 0|1]
import { chromium, webkit, firefox } from 'playwright';
const [url, out, eng = 'chromium', w = 1600, h = 900, mx = '', my = '', hud = '1'] = process.argv.slice(2);
const b = await ({ chromium, webkit, firefox })[eng].launch(eng === 'chromium' ? { args: process.env.SOFT ? ['--enable-unsafe-swiftshader'] : ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] } : {});
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 400)); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url);
await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { timeout: 300000 });
if (mx !== '') await p.mouse.move((+mx * 0.5 + 0.5) * w, (+my * 0.5 + 0.5) * h);
await p.waitForFunction(() => window.__lobby.ready() >= 1, null, { timeout: 900000 });
await p.waitForTimeout(4000);
if (hud === '0') await p.evaluate(() => (document.getElementById('hud').style.display = 'none'));
await p.screenshot({ path: out, timeout: 600000 });
console.log('saved', out, JSON.stringify(await p.evaluate(() => window.__lobby.mode())));
await b.close();
