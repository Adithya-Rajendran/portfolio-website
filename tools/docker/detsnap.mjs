// Deterministic snapshots (tools/detsnap.sh).  node detsnap.mjs <origin> <outdir> <frames> name=query ...
// Time is faked (Playwright clock, one 1/60 s step per frame) and Math.random is seeded per calling file, so two
// runs of the same code give the same picture, and the picture does not depend on how many textures three created.
import { chromium } from 'playwright';
const [origin, out, frames, ...jobs] = process.argv.slice(2);
const BUSY = () => {                                               // fetches and image decodes still running in the page
  window.__busy = 0; const track = (f) => function (...a) { window.__busy++; return f.apply(this, a).finally(() => window.__busy--); };
  window.fetch = track(window.fetch); window.createImageBitmap = track(window.createImageBitmap);
};
const SEED = () => {
  const streams = {}, rnd = Math.random;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = function () {
    const line = (new Error().stack.split('\n')[2] || ''), m = line.match(/\/([\w.-]+\.js)/), key = m ? m[1] : '?';
    if (!streams[key]) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; streams[key] = mulberry(h); }
    return streams[key]();
  };
};
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const job of jobs) {
  const name = job.slice(0, job.indexOf('=')), q = job.slice(job.indexOf('=') + 1);
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } }), p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-20T12:00:00Z') }); await p.clock.pauseAt(new Date('2026-11-20T12:00:01Z'));
  await p.addInitScript(SEED); await p.addInitScript(BUSY);
  p.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] error`, m.text().slice(0, 300)); });
  let inflight = 0, last = Date.now(); p.on('request', () => { inflight++; last = Date.now(); }); p.on('requestfinished', () => { inflight--; last = Date.now(); }); p.on('requestfailed', () => { inflight--; });
  await p.goto(`${origin.replace(/\/$/, '')}/${q.replace(/^\/+/, '')}`);
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby)); i++) await new Promise((r) => setTimeout(r, 100));
  while (inflight > 0 || Date.now() - last < 1500) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1500));                    // image decodes
  // files asked for mid-run (sky layers) arrive 'instantly' in fake time: wait for them (and their decode) between frames
  for (let i = 0; i < +frames; i++) { await p.clock.runFor(1000 / 60); while (await p.evaluate(() => window.__busy)) await new Promise((r) => setTimeout(r, 20)); }
  // the first frame's delta depends on where navigation fell within a millisecond: pin the clock, then step 2 frames
  await p.evaluate(async () => { document.getElementById('hud').style.display = 'none'; (await import('./js/kit.js')).uTime.value = 1.5; });
  for (let i = 0; i < 2; i++) { await p.clock.runFor(16); while (await p.evaluate(() => window.__busy)) await new Promise((r) => setTimeout(r, 20)); } await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate(async () => ({ ...window.__lobby.mode(), uTime: (await import('./js/kit.js')).uTime.value, now: performance.now() }))));
  await ctx.close();
}
await b.close();
