// Regression snapshots.  node snap.mjs <prefix>   (jobs, one "name=url" per line, are read from /out/<prefix>.jobs)
// For each: a 1280x720 screenshot after a fixed wait, plus every wall-screen canvas, into /out/<prefix>_<name>*.png
import { chromium } from 'playwright';
import fs from 'fs';
const prefix = process.argv[2], origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, ''), jobs = fs.readFileSync(`/out/${prefix}.jobs`, 'utf8').split('\n').filter(Boolean);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const job of jobs) {
  const [name, url] = [job.slice(0, job.indexOf('=')), job.slice(job.indexOf('=') + 1)];
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] error`, m.text().slice(0, 300)); });
  await p.goto(`${origin}/${url.replace(/^\//, '')}`);
  await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
  await p.screenshot({ path: `/out/${prefix}_${name}.png` });
  if (name.endsWith('hero')) {
    const shots = await p.evaluate(() => { const out = []; window.__lobby.scene.traverse((o) => { const t = o.userData?.fx === 'screen' && o.material?.uniforms?.map?.value;
      if (t) out.push([o.userData.name || o.name, (t.userData.canvas ?? t.image).toDataURL('image/png')]); }); return out; });
    for (const [n, d] of shots) fs.writeFileSync(`/out/${prefix}_${name}_${n}.png`, Buffer.from(d.split(',')[1], 'base64'));
    console.log(name, 'screens:', shots.map((s) => s[0]).join(' '));
  }
  const info = await p.evaluate(() => ({ mem: window.__lobby.renderer.info.memory, picks: window.__lobby.picks.length }));
  console.log(name, JSON.stringify(info));
  await p.close();
}
await b.close();
