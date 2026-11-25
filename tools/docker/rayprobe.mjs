// One-off: which surfaces lie under given pixels (camera after settling, as edgeflicker.mjs).
import { chromium } from 'playwright';
const [originArg, q, ...px] = process.argv.slice(2);
const origin = (originArg === '-' ? process.env.ORIGIN : originArg).replace(/\/$/, '');
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
await p.clock.pauseAt(new Date('2026-11-20T12:00:00Z'));
await p.goto(origin + '/' + q);
for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby?.scene)); i++) await new Promise((r) => setTimeout(r, 100));
await new Promise((r) => setTimeout(r, 4000));
for (let i = 0; i < 150; i++) await p.clock.runFor(16);
const out = await p.evaluate(async (pts) => {
  const THREE = await import('three'), { camera, scene } = window.__lobby, rc = new THREE.Raycaster(), res = [];
  const list = []; for (const s of pts) { const [a, b2, y, step] = s.split(',').map(Number); for (let x = a; x <= b2 + 1e-9; x += step) list.push([x, y]); }
  for (const [x, y] of list) { const s = x.toFixed(2) + ',' + y;
    rc.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight * 2 - 1)), camera);
    const hits = rc.intersectObjects(scene.children, true).filter((h) => h.object.isMesh && h.object.visible !== false && h.object.material?.colorWrite !== false).slice(0, 2);
    res.push({ px: s, hits: hits.map((h) => h.object.name + '#' + h.faceIndex + '@' + h.distance.toFixed(4)) });
  }
  return res;
}, px);
for (const r of out) console.log('RAY', r.px, JSON.stringify(r.hits));
await b.close();
