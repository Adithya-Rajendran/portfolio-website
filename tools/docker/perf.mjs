// Frame time benchmark on the real GPU
import { chromium } from 'playwright';
const [url, w = 1920, h = 1080, secs = 8, dpr = 1] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
await p.goto(url);
await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 300000 });
if (process.env.UNTIL) await p.waitForFunction(process.env.UNTIL, null, { timeout: 120000 });
await p.waitForTimeout(1500);
const r = await p.evaluate((secs) => new Promise((res) => {
  const L = window.__lobby, gl = L.renderer.getContext(), dt = []; let last = performance.now(), t0 = last;
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  const px = new Uint8Array(4);
  function f(now) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); dt.push(now - last); last = now;
    if (now - t0 < secs * 1000) requestAnimationFrame(f);
    else { dt.shift(); const worst = dt.map((v, i) => [Math.round(v), i]).sort((a, c) => c[0] - a[0]).slice(0, 6); dt.sort((a, c) => a - c); const avg = dt.reduce((a, c) => a + c, 0) / dt.length;
      res({ median_ms: +dt[dt.length >> 1].toFixed(2), worst, gpu: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', frames: dt.length, avg_ms: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95_ms: +dt[Math.floor(dt.length * 0.95)].toFixed(2),
        calls: L.renderer.info.render.calls, tris: L.renderer.info.render.triangles, textures: L.renderer.info.memory.textures, geometries: L.renderer.info.memory.geometries,
        buffer: gl.drawingBufferWidth + 'x' + gl.drawingBufferHeight, mode: L.mode() }); } }
  requestAnimationFrame(f); }), +secs);
console.log(JSON.stringify(r));
await b.close();
