// Library: focus the terminal, press a volume button, and photograph the drone on its way and on arrival.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message)); p.on('console', (m) => m.type() === 'error' && console.log('[c]', m.text().slice(0, 200)));
await p.goto(url); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 }); await p.waitForTimeout(1500);
const i = await p.evaluate(() => { const L = window.__lobby, i = L.picks.findIndex((q) => q.options); L.setFocus(L.picks[i]); return i; });
console.log('terminal is pick', i, 'buttons', await p.$$eval('#ways button', (bs) => bs.map((x) => x.textContent)));
await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/drone0.png` });
await p.click('#ways button[data-option="1"]');
for (const [k, ms] of [[1, 1500], [2, 2500], [3, 6000]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${out}/drone${k}.png` }); }
await p.click('#ways button[data-option="3"]'); await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/drone4.png` });
await p.keyboard.press('Escape'); await p.waitForTimeout(9000); await p.screenshot({ path: `${out}/drone5.png` });
await b.close();
