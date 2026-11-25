// One-off: duplicated (coplanar twin) triangles in each room's baked meshes.
import { chromium } from 'playwright';
const [originArg, ...qs] = process.argv.slice(2);
const origin = (originArg === '-' ? process.env.ORIGIN : originArg).replace(/\/$/, '');
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const q of qs) {
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await p.goto(origin + '/' + q);
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby?.scene && window.__lobby.mode().room)); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 3000));
  const out = await p.evaluate(() => {
    const res = { room: window.__lobby.mode().room, cam: window.__lobby.camera.position.toArray().map((v) => +v.toFixed(2)), meshes: [] };
    window.__lobby.scene.traverse((o) => {
      if (!o.isMesh || !o.userData.grp || o.material?.colorWrite === false) return;
      const g = o.geometry, pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal, idx = g.index;
      const tri = (t, k) => (idx ? idx.getX(3 * t + k) : 3 * t + k), n = (idx ? idx.count : pos.count) / 3;
      const key = (v) => [pos.getX(v), pos.getY(v), pos.getZ(v)].map((x) => Math.round(x * 1e4)).join(',');
      const seen = new Map(); let dups = 0, uvDiff = 0, nFlip = 0, windOk = 0; const where = [];
      const wind = (vv) => { const a = [0,1,2].map((k) => [pos.getX(vv[k]), pos.getY(vv[k]), pos.getZ(vv[k])]); const e1 = a[1].map((x, i) => x - a[0][i]), e2 = a[2].map((x, i) => x - a[0][i]);
        const c = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]]; return nrm ? Math.sign(c[0]*nrm.getX(vv[0]) + c[1]*nrm.getY(vv[0]) + c[2]*nrm.getZ(vv[0])) : 0; };
      for (let t = 0; t < n; t++) {
        const vs = [tri(t, 0), tri(t, 1), tri(t, 2)], k = vs.map(key).sort().join('|');
        if (seen.has(k)) { dups++; const u = seen.get(k);
          const c = (vv) => vv.map((v) => [uv.getX(v), uv.getY(v)]).reduce((a, q) => [a[0] + q[0] / 3, a[1] + q[1] / 3], [0, 0]);
          const cu = c(u), ct = c(vs); if (Math.hypot(cu[0] - ct[0], cu[1] - ct[1]) > 1e-3) uvDiff++;
          if (wind(u) > 0 && wind(vs) > 0) windOk++;
          if (where.length < 4) { const w = new (o.matrixWorld.constructor === Object ? Object : Object)(); const v0 = vs[0]; where.push([pos.getX(v0), pos.getY(v0), pos.getZ(v0)].map((x) => +x.toFixed(2))); }
          if (nrm) { const d = nrm.getX(u[0]) * nrm.getX(vs[0]) + nrm.getY(u[0]) * nrm.getY(vs[0]) + nrm.getZ(u[0]) * nrm.getZ(vs[0]); if (d < 0) nFlip++; }
        } else seen.set(k, vs);
      }
      if (dups) res.meshes.push({ name: o.name, grp: o.userData.grp, tris: n, dups, uvDiff, nFlip, windOk, where });
    });
    return res;
  });
  console.log('DUP', JSON.stringify(out));
  await p.context().close();
}
await b.close();
