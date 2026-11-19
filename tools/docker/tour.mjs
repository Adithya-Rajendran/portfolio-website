import { chromium } from 'playwright';
const [url, n = 2] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 }); await p.waitForTimeout(3500);
await p.screenshot({ path: '/out/tour_0.png' }); console.log('0', await p.evaluate(() => document.getElementById('count').textContent));
for (let i = 1; i <= +n; i++) { if (i % 2) await p.keyboard.press('ArrowRight'); else await p.click('#next'); await p.waitForTimeout(3200); await p.screenshot({ path: `/out/tour_${i}.png` });
  console.log(i, await p.evaluate(() => document.getElementById('count').textContent)); }
await b.close();
