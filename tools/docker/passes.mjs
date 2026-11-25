// GPU ms, JS ms, draw calls and triangles of each render pass, per frame.  node passes.mjs <url> [secs] [w] [h]
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
  const r = await p.evaluate((secs) => new Promise((res, rej) => {
    window.__measuring = true;
    const L = window.__lobby, R = L.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), px = new Uint8Array(4);
    const mode = L.mode(), [mw, mh] = mode.mirror.split('x').map(Number);
    const label = (rt) => (rt === null ? 'final' : rt === L.post.scene ? 'scene' : L.post.bloom.includes(rt) ? 'bloom' : rt.isWebGLCubeRenderTarget ? 'livecube' : rt.depthTexture ? 'shadow'
      : rt.texture.colorSpace === 'srgb' ? 'screens' : rt.width === mw && rt.height === mh ? 'mirror' : 'chart');
    const S = {}, pend = [], render = R.render.bind(R), reset = R.info.reset.bind(R.info); let frames = 0, disjoint = 0;
    const at = (k) => (S[k] ??= { gpu: 0, q: 0, cpu: 0, renders: 0, calls: 0, tris: 0 });
    R.info.reset = () => { reset(); frames++; };
    R.render = (scene, cam) => {
      const s = at(label(R.getRenderTarget())), c0 = R.info.render.calls, t0 = R.info.render.triangles, t = performance.now();
      const q = ext && !gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) ? gl.createQuery() : null;
      let active = false;
      if (q) {
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        active = true;
      }
      try {
        render(scene, cam);
      } finally {
        if (active) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pend.push([s, q]);
        }
      }
      s.cpu += performance.now() - t; s.renders++; s.calls += R.info.render.calls - c0; s.tris += R.info.render.triangles - t0;
    };
    const drain = () => {
      if (!ext) return;
      while (pend.length && gl.getQueryParameter(pend[0][1], gl.QUERY_RESULT_AVAILABLE)) {
        const [s, q] = pend.shift();
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) disjoint++; else { s.gpu += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; s.q++; }
        gl.deleteQuery(q);
      }
    };
    const dt = []; let last = performance.now(), t0 = last, js0 = window.__js, f0 = window.__frames;
    function f(now) {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); drain(); dt.push(now - last); last = now;
      if (now - t0 < secs * 1000) return requestAnimationFrame(f);
      dt.shift();
      if (frames <= 0 || !dt.length || window.__frames - f0 <= 0) {
        while (pend.length) gl.deleteQuery(pend.shift()[1]);
        return rej(new Error(`passes: 0 frames captured (frames=${frames}, dt=${dt.length})`));
      }
      dt.sort((a, c) => a - c);
      const out = {}; let gsum = 0, csum = 0;
      for (const [k, s] of Object.entries(S)) {
        const g = s.q ? s.gpu / s.q * (s.renders / frames) : 0; gsum += g; csum += s.cpu / frames;
        out[k] = { gpu: +g.toFixed(2), js: +(s.cpu / frames).toFixed(2), renders: +(s.renders / frames).toFixed(2), calls: Math.round(s.calls / frames), tris: Math.round(s.tris / frames) };
      }
      while (pend.length) gl.deleteQuery(pend.shift()[1]);
      res({ mode, frames, frame_med: +dt[dt.length >> 1].toFixed(1), gpu_sum: +gsum.toFixed(2), js_in_render: +csum.toFixed(2), js_frame: +((window.__js - js0) / (window.__frames - f0)).toFixed(2), disjoint, passes: out });
    }
    requestAnimationFrame(f);
  }), +secs);
  console.log(JSON.stringify(r));
} finally {
  await b.close();
}
