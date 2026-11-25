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
  for (const s of pts) { const [x, y] = s.split(',').map(Number);
    rc.setFromCamera(new THREE.Vector2((x + 0.5) / innerWidth * 2 - 1, -((y + 0.5) / innerHeight * 2 - 1)), camera);
    const hits = rc.intersectObjects(scene.children, true).filter((h) => h.object.isMesh && h.object.visible !== false).slice(0, 6);
    res.push({ px: s, hits: hits.map((h) => ({ d: +h.distance.toFixed(5), name: h.object.name, ud: JSON.stringify(h.object.userData).slice(0, 80), id: h.object.id, mat: h.object.material?.type,
      n: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).toArray().map((v) => +v.toFixed(3)) : null, fi: h.faceIndex })) });
  }
  return res;
}, px);
for (const r of out) console.log('RAY', r.px, JSON.stringify(r.hits));
await b.close();
