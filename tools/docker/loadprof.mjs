// Profile of the time to the first frame with a warm cache or a fast link
import { chromium } from 'playwright';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const [rawUrl = '/'] = process.argv.slice(2);
const url = new URL(rawUrl, origin + '/').href;

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
try {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => { process.exitCode = 1; console.log('[pageerror]', e.message); });
  await p.addInitScript(() => {
    window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch {}
    const W = window.Worker; window.__tasks = [];
    window.Worker = class extends W {
      constructor(...a) {
        super(...a); const pm = this.postMessage.bind(this); let sent = 0;
        this.postMessage = (msg, tr) => { if (msg?.type === 'transcode') sent = performance.now(); return pm(msg, tr); };
        this.addEventListener('message', (e) => { if (e.data?.type === 'transcode' && sent) { window.__tasks.push([Math.round(sent), Math.round(performance.now())]); sent = 0; } });
      }
    };
    const P = WebGL2RenderingContext.prototype, wrap = (name) => { const o = P[name]; let ms = 0, n = 0; P[name] = function () { const t = performance.now(), r = o.apply(this, arguments); ms += performance.now() - t; n++; return r; }; return () => [Math.round(ms), n]; };
    const stats = Object.fromEntries(['compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'compressedTexSubImage2D', 'compressedTexSubImage3D', 'compressedTexImage2D', 'texStorage2D', 'texStorage3D', 'texSubImage2D', 'texImage2D', 'generateMipmap', 'bufferData', 'drawElements', 'drawArrays', 'readPixels', 'getProgramInfoLog', 'getUniformLocation', 'getActiveUniform'].map((k) => [k, wrap(k)]));
    window.__gl = () => Object.fromEntries(Object.entries(stats).map(([k, f]) => [k, f()]).filter(([, v]) => v[1]));
  });
  await p.goto(new URL('/robots.txt', url).href);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 'raf', timeout: 300000 });
  const lifted = Date.now() - t0, { profile } = await cdp.send('Profiler.stop');
  const page = await p.evaluate(() => {
    const es = performance.getEntriesByType('resource'), last = (re) => Math.round(Math.max(0, ...es.filter((e) => re.test(e.name)).map((e) => e.responseEnd))), first = (re) => Math.round(Math.min(1e9, ...es.filter((e) => re.test(e.name)).map((e) => e.startTime)));
    const tasks = window.__tasks, busy = tasks.reduce((a, [s, e]) => a + e - s, 0);
    return {
      now: Math.round(performance.now()), mainJs: [first(/main\.js/), last(/main\.js/)], modulesDone: last(/\.js(\?|$)/), scene: [first(/scene\.json/), last(/scene\.json/)], glb: [first(/room\.glb/), last(/room\.glb/)], ktx: [first(/\.ktx2/), last(/\.ktx2/)], wasm: [first(/\.wasm/), last(/\.wasm/)],
      transcode: { tasks: tasks.length, worker_ms: busy, first: tasks.length ? Math.min(...tasks.map((t) => t[0])) : 0, last: tasks.length ? Math.max(...tasks.map((t) => t[1])) : 0 },
      long: { n: window.__long.length, total: window.__long.reduce((a, [, d]) => a + d, 0), worst: [...window.__long].sort((a, c) => c[1] - a[1]).slice(0, 8) }, gl: window.__gl()
    };
  });
  const self = new Map(), idOf = new Map(profile.nodes.map((n) => [n.id, n])); let total = 0;
  profile.samples.forEach((id, i) => {
    const cf = idOf.get(id).callFrame, us = profile.timeDeltas[i] || 0, file = (cf.url || '').split('/').slice(-1)[0].split('?')[0];
    const key = file ? `${cf.functionName || '(anonymous)'} ${file}:${cf.lineNumber + 1}` : cf.functionName || '(native)'; total += us; self.set(key, (self.get(key) || 0) + us);
  });
  const top = [...self].sort((a, c) => c[1] - a[1]).slice(0, 30).map(([k, us]) => [Math.round(us / 1000), k]);
  console.log(JSON.stringify({ lifted, sampled_ms: Math.round(total / 1000), page, top }));
} finally {
  await b.close();
}
