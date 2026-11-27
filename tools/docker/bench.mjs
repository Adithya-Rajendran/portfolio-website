// Frame, memory and load benchmark for tools/bench.sh
import { chromium } from 'playwright';
const [url, w = 1920, h = 1080, secs = 8, runs = 3] = process.argv.slice(2);
const HOOK = () => {
  const bytes = new Map(); let total = 0, peak = 0;
  const set = (k, b) => { total += b - (bytes.get(k) || 0); bytes.set(k, b); peak = Math.max(peak, total); };
  const P = WebGL2RenderingContext.prototype, bound = new WeakMap();
  const BPP = { 0x8058: 4, 0x8051: 3, 0x881A: 8, 0x8C3A: 4, 0x81A6: 4, 0x81A5: 2, 0x88F0: 4, 0x8CAC: 4, 0x8CAD: 8, 0x8D48: 1, 0x822F: 4, 0x8229: 1, 0x822B: 2, 0x8814: 16, 0x8C43: 4, 0x8F97: 4,
    0x8E8C: 1, 0x8E8D: 1, 0x8E8E: 1, 0x8E8F: 1, 0x93B0: 1, 0x93D0: 1, 0x83F3: 1, 0x9278: 1, 0x83F0: 0.5, 0x83F1: 0.5, 0x9274: 0.5 };
  const fmtBytes = (f) => BPP[f] ?? 4;
  const oBind = P.bindTexture; P.bindTexture = function (t, tex) { bound.set(this, Object.assign(bound.get(this) || {}, { [t]: tex })); return oBind.call(this, t, tex); };
  const oRB = P.bindRenderbuffer; P.bindRenderbuffer = function (t, rb) { bound.set(this, Object.assign(bound.get(this) || {}, { rb })); return oRB.call(this, t, rb); };
  const oS = P.texStorage2D; P.texStorage2D = function (t, levels, fmt, w, h) {
    let b = 0, x = w, y = h; for (let i = 0; i < levels; i++) { b += x * y * fmtBytes(fmt); x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); }
    (window.__fmts ??= new Set()).add(fmt); set(bound.get(this)[t], b * (t === 0x8513 ? 6 : 1)); return oS.apply(this, arguments); };
  const oS3 = P.texStorage3D; P.texStorage3D = function (t, levels, fmt, w, h, depth) {
    let b = 0, x = w, y = h; for (let i = 0; i < levels; i++) { b += x * y * depth * fmtBytes(fmt); x = Math.max(1, x >> 1); y = Math.max(1, y >> 1); }
    (window.__fmts ??= new Set()).add(fmt); set(bound.get(this)[t], b); return oS3.apply(this, arguments); };
  const oI = P.texImage2D; P.texImage2D = function (t, level, fmt) {
    const r = oI.apply(this, arguments); const tex = bound.get(this)?.[t];
    if (tex && level === 0) { const a = arguments; let ww = a[3], hh = a[4]; if (typeof ww !== 'number') { ww = a[5]?.width; hh = a[5]?.height; } if (typeof ww === 'number') set(tex, ww * hh * fmtBytes(fmt) * 4 / 3); }
    return r; };
  const oRS = P.renderbufferStorageMultisample; P.renderbufferStorageMultisample = function (t, s, fmt, w, h) { set(bound.get(this).rb, w * h * fmtBytes(fmt) * Math.max(1, s)); return oRS.apply(this, arguments); };
  const oR = P.renderbufferStorage; P.renderbufferStorage = function (t, fmt, w, h) { set(bound.get(this).rb, w * h * fmtBytes(fmt)); return oR.apply(this, arguments); };
  const oD = P.deleteTexture; P.deleteTexture = function (t) { set(t, 0); return oD.apply(this, arguments); };
  const oDR = P.deleteRenderbuffer; P.deleteRenderbuffer = function (t) { set(t, 0); return oDR.apply(this, arguments); };
  const gc = HTMLCanvasElement.prototype.getContext, raf = window.requestAnimationFrame.bind(window), px = new Uint8Array(4); let ctx2 = null;
  HTMLCanvasElement.prototype.getContext = function (t, o) { const c = gc.call(this, t, o); if (t === 'webgl2' && this.id === 'scene') ctx2 = c; return c; };
  window.requestAnimationFrame = (cb) => raf((t) => { cb(t); if (!window.__measuring) ctx2?.readPixels(0, 0, 1, 1, ctx2.RGBA, ctx2.UNSIGNED_BYTE, px); });
  window.__gpumem = () => ({ mb: +(total / 2 ** 20).toFixed(1), peak_mb: +(peak / 2 ** 20).toFixed(1), objects: [...bytes.values()].filter(Boolean).length, formats: [...(window.__fmts || [])].map((f) => '0x' + f.toString(16)).join(' ') });
};
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
for (let run = 0; run < +runs; run++) {
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await p.addInitScript(HOOK);
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });
  const t0 = Date.now(); await p.goto(url);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 'raf', timeout: 300000 });
  const load = await p.evaluate(() => { const r = performance.getEntriesByType('resource'), n = performance.getEntriesByType('navigation')[0];
    return { ms: Math.round(performance.now()), requests: r.length + 1, kb: Math.round((r.reduce((a, e) => a + e.transferSize, 0) + n.transferSize) / 1024), mem: window.__gpumem() }; });
  let lastReq = Date.now(), inflight = 0; p.on('request', () => { inflight++; lastReq = Date.now(); }); p.on('requestfinished', () => { inflight--; lastReq = Date.now(); }); p.on('requestfailed', () => { inflight--; });
  while (Date.now() - lastReq < 1000 || inflight > 0) await p.waitForTimeout(100);
  const full = await p.evaluate(() => { const r = performance.getEntriesByType('resource'), n = performance.getEntriesByType('navigation')[0];
    return { ms: Math.round(Math.max(...r.map((e) => e.responseEnd))), requests: r.length + 1, kb: Math.round((r.reduce((a, e) => a + e.transferSize, 0) + n.transferSize) / 1024) }; });
  await p.waitForTimeout(2000);
  const r = await p.evaluate((secs) => new Promise((res) => {
    window.__measuring = true; const L = window.__lobby, R = L.renderer, gl = R.getContext(), dt = [], px = new Uint8Array(4); let last = performance.now(), t0 = last;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'), gpu = [], pend = [], reset = R.info.reset.bind(R.info), render = L.post.render.bind(L.post);
    R.info.reset = () => { reset(); const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); pend.push(q); };
    L.post.render = (...a) => { render(...a); gl.endQuery(ext.TIME_ELAPSED_EXT);
      while (pend.length && gl.getQueryParameter(pend[0], gl.QUERY_RESULT_AVAILABLE)) { const q = pend.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); } };
    function f(now) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); dt.push(now - last); last = now;
      if (now - t0 < secs * 1000) requestAnimationFrame(f);
      else { dt.shift(); const s = [...dt].sort((a, c) => a - c), q = (x) => +s[Math.min(s.length - 1, Math.floor(s.length * x))].toFixed(1);
        const g = gpu.sort((a, c) => a - c);
        res({ gpu: +g[g.length >> 1].toFixed(2), med: q(0.5), p95: q(0.95), max: q(1), n: dt.length, calls: L.renderer.info.render.calls, tris: L.renderer.info.render.triangles,
          tex: L.renderer.info.memory.textures, mem: window.__gpumem(), mode: L.mode() }); } }
    requestAnimationFrame(f); }), +secs);
  console.log(JSON.stringify({ ...r, load, full }));
  await ctx.close();
}
await b.close();
