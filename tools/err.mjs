import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
let n = 0;
p.on('console', (m) => { if (m.type() === 'error' && n++ < 4) console.log(m.text().slice(0, 1800)); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:8123/'); await p.waitForTimeout(25000); await b.close();
