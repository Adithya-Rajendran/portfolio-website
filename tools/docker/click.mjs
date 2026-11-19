// real pointer test: hover + click a point, screenshot, press Escape, screenshot
import { chromium } from 'playwright';
let [url, x, y] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('console', (m) => console.log('[c]', m.text().slice(0, 200)));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto(url); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 }); await p.waitForTimeout(1500);
if (y === undefined) { const idx = +x;      // the camera follows the pointer, so home in on the target in a few steps
  for (let n = 0; n < 4; n++) { [x, y] = await p.evaluate((i) => { const L = window.__lobby, m = L.picks[i].mesh; m.geometry.computeBoundingSphere(); const v = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld).project(L.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, idx);
    await p.mouse.move(+x, +y); await p.waitForTimeout(1500); }
  console.log('target', Math.round(x), Math.round(y)); }
await p.mouse.move(+x, +y); await p.waitForTimeout(300);
console.log('cursor', await p.evaluate(() => document.getElementById('scene').style.cursor), 'picks', await p.evaluate(() => window.__lobby.picks.length));
await p.evaluate(() => { window.__ev = []; for (const t of ['pointerdown','pointerup','click']) addEventListener(t, (e) => window.__ev.push(t + ':' + e.target.tagName + '#' + e.target.id + '.' + e.target.className), true); });
await p.mouse.click(+x, +y); console.log(await p.evaluate(() => window.__ev.join(' | '))); await p.waitForTimeout(2500); await p.screenshot({ path: '/out/click_in.png' });
console.log('back visible', await p.evaluate(() => !document.getElementById('inspectbar').hidden));
await p.keyboard.press('Escape'); await p.waitForTimeout(2500); await p.screenshot({ path: '/out/click_out.png' });
console.log('back visible after esc', await p.evaluate(() => !document.getElementById('inspectbar').hidden));
await b.close();
