import { chromium } from 'playwright';
const [originArg, q] = process.argv.slice(2);
const origin = (originArg === '-' ? process.env.ORIGIN : originArg).replace(/\/$/, '');
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await p.goto(origin + '/' + q);
for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby?.scene && window.__lobby.mode().room)); i++) await new Promise((r) => setTimeout(r, 100));
await new Promise((r) => setTimeout(r, 3000));
const out = await p.evaluate(async () => {
  const THREE = await import('three'), res = [], box = new THREE.Box3();
  window.__lobby.scene.traverse((o) => {
    if (!o.isMesh || o.userData.grp || o.material?.colorWrite === false) return;
    const m = o.material; box.setFromObject(o);
    res.push({ name: o.name, parent: o.parent?.name, type: m.type, tr: m.transparent, op: m.opacity, trans: m.transmission ?? null, side: m.side, vis: o.visible, ro: o.renderOrder,
      lo: box.min.toArray().map((v) => +v.toFixed(2)), hi: box.max.toArray().map((v) => +v.toFixed(2)) });
  });
  return res;
});
for (const r of out) console.log('MESH', JSON.stringify(r));
await b.close();
