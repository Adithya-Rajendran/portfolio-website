// opening-L-probe.mjs [desktop|reduced] [rounds]: diagnostic for opening.mjs item L. Puts the pointer where item L puts it (the middle of all the books,
// then each book's middle), and every 900 ms logs the lock, the pointer, each book's projected rectangle and what a ray under the pointer hits.
import { PROFILES, load, json, launch, context, open, until } from './rooms.kit.mjs';
import { sleep, boxCorners } from './r2.kit.mjs';
const which = process.argv[2] || 'desktop', rounds = +(process.argv[3] || 12);
const { content } = await load(), scene = await json('/assets/about/scene.json'), books = scene.focus[0].boxes, bookCorners = boxCorners(books);
const b = await launch(); const P = PROFILES[which], errs = [];
const ctx = await context(b, P); const p = await open(ctx, '/about/', 'about', errs);
await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
const bk = await p.evaluate(() => window.__lobby.picks.findIndex((q) => q.source?.().bodies?.length));
const probeAt = (x, y) => p.evaluate(async ({ pts, all, x, y }) => {
  const THREE = await import('three'), l = window.__lobby; l.camera.updateMatrixWorld(true);
  const proj = (set) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of set) { const v = new THREE.Vector3(...c).project(l.camera); const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); } return [x0, y0, x1, y1].map((v) => +v.toFixed(1)); };
  const ray = new THREE.Raycaster(), live = l.picks.filter((q) => !q.live || q.live()); for (const q of live) q.mesh.updateWorldMatrix(true, false);
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), l.camera);
  const hits = ray.intersectObjects(live.map((q) => q.mesh), false).map((h) => l.picks.findIndex((q) => q.mesh === h.object));
  const s = l.display.state();
  return { lock: s.lock ? s.lock.name : null, hits, each: pts.map(proj), all: proj(all), eye: l.camera.position.toArray().map((v) => +v.toFixed(3)) };
}, { pts: bookCorners, all: bookCorners.flat(), x, y });
const inside = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
let lost = { all: 0, 0: 0, 1: 0 }, looks = { all: 0, 0: 0, 1: 0 };
for (let i = 0; i < rounds; i++) {
  for (const target of ['all', 0, 1]) {
    // as opening.mjs onBooks(): move to the target's middle, wait 700 ms, until the lock is on and the target has stayed within 8 px (the view follows the pointer)
    let x = 0, y = 0, got = false, tries = 0;
    for (; tries < 10 && !got; tries++) {
      const s0 = await probeAt(0, 0), r = target === 'all' ? s0.all : s0.each[target]; x = (r[0] + r[2]) / 2; y = (r[1] + r[3]) / 2;
      await p.mouse.move(x, y, { steps: 3 }); await sleep(700);
      const s1 = await probeAt(x, y), f = target === 'all' ? s1.all : s1.each[target]; got = !!s1.lock && Math.abs((f[0] + f[2]) / 2 - x) < 8;
    }
    console.log(JSON.stringify({ i, target, settled: got, tries }));
    for (let k = 0; k < 4; k++) {
      if (k) await sleep(900); const s = await probeAt(x, y); looks[target]++; if (!s.lock) lost[target]++;
      console.log(JSON.stringify({ i, target, k, ptr: [+x.toFixed(1), +y.toFixed(1)], lock: s.lock, hits: s.hits, inBook: s.each.map((e) => inside(e, x, y)), each: s.each, eye: s.eye }));
    }
    await p.mouse.move(P.viewport.width - 4, 4); await until(p, () => !window.__lobby.display.state().lock, null, 15000); await sleep(200 + 300 * (i % 3));
  }
}
console.log('SUMMARY', which, 'pick', bk, 'looks', JSON.stringify(looks), 'lock missing', JSON.stringify(lost), 'books', books.length);
await b.close();

