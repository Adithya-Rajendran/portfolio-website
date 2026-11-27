// Door pick check with labels, cursor and screenshots
import { chromium } from 'playwright';
const [url, idx] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 }); await p.waitForTimeout(1500);
let x, y; for (let n = 0; n < 4; n++) { [x, y] = await p.evaluate((i) => { const L = window.__lobby, v = L.picks[i].mesh.getWorldPosition(new L.picks[i].mesh.position.constructor()).project(L.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, +idx); await p.mouse.move(x, y); await p.waitForTimeout(1200); }
console.log('labels', await p.evaluate(() => window.__lobby.picks.map((q) => q.door ? q.door.label : '-').join(',')), 'cursor', await p.evaluate(() => document.getElementById('scene').style.cursor));
await p.mouse.click(x, y); await p.waitForTimeout(1300); await p.screenshot({ path: '/out/door_at.png' });
console.log('enter:', await p.evaluate(() => document.getElementById('ways').textContent).catch(() => '(page already leaving)'));
await p.waitForTimeout(2500); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(3000);
console.log('now at', p.url()); await p.screenshot({ path: '/out/door_after.png' }); await b.close();
