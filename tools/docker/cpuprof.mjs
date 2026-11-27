// CPU profile of the JavaScript of a frame
import { chromium } from 'playwright';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const [rawUrl = '/', secs = 6, w = 1920, h = 1080] = process.argv.slice(2);
const url = new URL(rawUrl, origin + '/').href;

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
try {
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => { process.exitCode = 1; console.log('[pageerror]', e.message); });
  await p.addInitScript(() => {
    const gc = HTMLCanvasElement.prototype.getContext, raf = window.requestAnimationFrame.bind(window), px = new Uint8Array(4); let ctx2 = null; window.__js = 0; window.__frames = 0;
    HTMLCanvasElement.prototype.getContext = function (t, o) { const c = gc.call(this, t, o); if (t === 'webgl2' && this.id === 'scene') ctx2 = c; return c; };
    window.requestAnimationFrame = (cb) => raf((t) => { const a = performance.now(); cb(t); window.__js += performance.now() - a; window.__frames++; if (!window.__measuring) ctx2?.readPixels(0, 0, 1, 1, ctx2.RGBA, ctx2.UNSIGNED_BYTE, px); });
  });
  await p.goto(url);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 'raf', timeout: 300000 });
  if (process.env.SETUP) await p.evaluate(process.env.SETUP);
  if (process.env.UNTIL) await p.waitForFunction(process.env.UNTIL, null, { timeout: 120000 });
  await p.waitForTimeout(4000);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  const before = await p.evaluate(() => ({ f: window.__frames, js: window.__js, t: performance.now() }));
  await cdp.send('Profiler.start'); await p.waitForTimeout(+secs * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const after = await p.evaluate(() => ({ f: window.__frames, js: window.__js, t: performance.now(), mode: window.__lobby.mode(), calls: window.__lobby.renderer.info.render.calls }));
  const frames = after.f - before.f;
  if (frames <= 0) throw new Error('cpuprof: 0 frames captured');
  const self = new Map(), byFile = new Map(), dts = profile.timeDeltas, idOf = new Map(profile.nodes.map((n) => [n.id, n]));
  let total = 0;
  profile.samples.forEach((id, i) => {
    const n = idOf.get(id), us = dts[i] || 0, cf = n.callFrame, file = (cf.url || '').split('/').slice(-1)[0].split('?')[0] || '(native)';
    const key = cf.functionName ? `${cf.functionName} ${file}:${cf.lineNumber + 1}` : `(anonymous) ${file}:${cf.lineNumber + 1}`;
    total += us; self.set(key, (self.get(key) || 0) + us); byFile.set(file === '(native)' ? cf.functionName || '(native)' : file, (byFile.get(file === '(native)' ? cf.functionName || '(native)' : file) || 0) + us);
  });
  const per = (us) => +(us / 1000 / frames).toFixed(3);
  const top = [...self].sort((a, c) => c[1] - a[1]).slice(0, 45).map(([k, us]) => [per(us), k]);
  const files = [...byFile].sort((a, c) => c[1] - a[1]).slice(0, 22).map(([k, us]) => [per(us), k]);
  console.log(JSON.stringify({ mode: after.mode, calls: after.calls, frames, wall_per_frame: +((after.t - before.t) / frames).toFixed(2), js_in_raf_per_frame: +((after.js - before.js) / frames).toFixed(2), sampled_ms_per_frame: per(total), files, top }));
} finally {
  await b.close();
}
