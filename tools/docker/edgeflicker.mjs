// Temporal flicker measure (tools/ci/run.sh script edgeflicker.mjs ...).
//   node edgeflicker.mjs <origin|-> <frames> <name=query[|still]>...
// Loads each state at 1920x1080 under a paused clock (exact 16 ms steps, seeded Math.random, as detsnap.mjs), lets it
// settle, then records <frames> consecutive frames. "|still" holds the camera where it settled (the sun and everything
// else still move); without it the camera keeps its slow sway. Per pixel (luma 0-255):
//   d1 = |L(t) - L(t-1)|               change from frame to frame (smooth motion shows here too)
//   d2 = |L(t) - 2 L(t-1) + L(t-2)|    temporal second difference: near 0 for smooth motion, large where a pixel flips
// "edge" pixels: within 2 px of both a bright pixel (mean luma >= 200) and a darker one (<= 140): the bright window edges.
// Prints one JSON line per state and writes /out/<name>/{heat.png,f000.png,last.png,stats.json}. heat.png: mean d2, x8.
// "|crop=x,y,w,h" also writes strip.png (that region of 8 consecutive frames side by side, enlarged 4x) and reports the
// region on its own: its mean luma, the mean and largest change of that mean between frames (a glow that pulses), d1, d2.
// <origin> "-" means $ORIGIN (the branch's own site); any other origin (a preview) is measured with this branch's script.
import { chromium } from 'playwright';
import fs from 'fs';

const [originArg, framesArg, ...jobs] = process.argv.slice(2);
const origin = (originArg === '-' || !originArg ? process.env.ORIGIN : originArg).replace(/\/$/, '');
const FRAMES = +framesArg || 90, WARM = +(process.env.WARM || 150);

const SEED = () => {
  const streams = {};
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = function () {
    const line = (new Error().stack.split('\n')[2] || ''), m = line.match(/\/([\w.-]+\.js)/), key = m ? m[1] : '?';
    if (!streams[key]) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; streams[key] = mulberry(h); }
    return streams[key]();
  };
};
const BUSY = () => {
  window.__busy = 0;
  const track = (f) => function (...a) { window.__busy++; return f.apply(this, a).finally(() => window.__busy--); };
  window.fetch = track(window.fetch); window.createImageBitmap = track(window.createImageBitmap);
};

// The analysis runs in a page of its own: PNG decode and per-pixel sums.
const ANALYSE = {
  async add(b64) {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const W = bmp.width, H = bmp.height, c = new OffscreenCanvas(W, H), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, W, H).data, n = W * H, L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = 0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2];
    const s = (window.__s ??= { W, H, n: 0, sum: new Float32Array(n), d1: new Float32Array(n), d2: new Float32Array(n), ev: new Uint16Array(n), k1: 0, k2: 0, p1: null, p2: null, per: [] });
    s.n++; for (let i = 0; i < n; i++) s.sum[i] += L[i];
    let f1 = 0, f2 = 0;
    if (s.p1) { s.k1++; for (let i = 0; i < n; i++) { const a = Math.abs(L[i] - s.p1[i]); s.d1[i] += a; f1 += a; } }
    if (s.p2) { s.k2++; for (let i = 0; i < n; i++) { const a = Math.abs(L[i] - 2 * s.p1[i] + s.p2[i]); s.d2[i] += a; f2 += a; if (a > 24) s.ev[i]++; } }
    s.per.push([+(f1 / n).toFixed(3), +(f2 / n).toFixed(3)]);
    s.p3 = s.p2; s.p2 = s.p1; s.p1 = L;
  },
  region([x, y, w, h]) {                                  // the crop region of the frame just added: its mean luma, and its d1/d2
    const s = window.__s, W = s.W; let m = 0, a = 0, b = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = j * W + i; m += s.p1[k];
      if (s.p2) a += Math.abs(s.p1[k] - s.p2[k]); if (s.p3) b += Math.abs(s.p1[k] - 2 * s.p2[k] + s.p3[k]); }
    const n = w * h; (s.reg ??= []).push([+(m / n).toFixed(2), +(a / n).toFixed(3), +(b / n).toFixed(3)]);
  },
  async strip([b64, f, [x, y, w, h]]) {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const c = (window.__strip ??= new OffscreenCanvas(w * 4 * 8 + 7 * 4, h * 4)), g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.drawImage(bmp, x, y, w, h, f * (w * 4 + 4), 0, w * 4, h * 4);
  },
  async stripPng() {
    const buf = new Uint8Array(await (await window.__strip.convertToBlob({ type: 'image/png' })).arrayBuffer()); window.__strip = null;
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(bin);
  },
  async finish() {
    const s = window.__s, { W, H } = s, n = W * H, M = new Float32Array(n);
    for (let i = 0; i < n; i++) M[i] = s.sum[i] / s.n;
    const near = (pred) => {                              // 5x5 dilation of a predicate on the mean image
      const a = new Uint8Array(n), b = new Uint8Array(n);
      for (let i = 0; i < n; i++) a[i] = pred(M[i]) ? 1 : 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let k = -2; k <= 2 && !v; k++) { const xx = x + k; if (xx >= 0 && xx < W) v = a[y * W + xx]; } b[y * W + x] = v; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = 0; for (let k = -2; k <= 2 && !v; k++) { const yy = y + k; if (yy >= 0 && yy < H) v = b[yy * W + x]; } a[y * W + x] = v; }
      return a;
    };
    const hi = near((v) => v >= 200), lo = near((v) => v <= 140);
    const st = { all: { px: n, d1: 0, d2: 0, ev: 0 }, edge: { px: 0, d1: 0, d2: 0, ev: 0 } };
    for (let i = 0; i < n; i++) {
      const d1 = s.k1 ? s.d1[i] / s.k1 : 0, d2 = s.k2 ? s.d2[i] / s.k2 : 0, ev = s.k2 ? s.ev[i] / s.k2 : 0;
      st.all.d1 += d1; st.all.d2 += d2; st.all.ev += ev;
      if (hi[i] && lo[i]) { st.edge.px++; st.edge.d1 += d1; st.edge.d2 += d2; st.edge.ev += ev; }
    }
    for (const k of ['all', 'edge']) { const p = Math.max(1, st[k].px); st[k].d1 = +(st[k].d1 / p).toFixed(3); st[k].d2 = +(st[k].d2 / p).toFixed(3); st[k].ev = +(100 * st[k].ev / p).toFixed(3); }
    // where: the 64x64 blocks with the largest mean d2
    const B = 64, blocks = [];
    for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
      let t = 0, c = 0; for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) { t += s.d2[y * W + x]; c++; }
      blocks.push([bx, by, +(t / c / Math.max(1, s.k2)).toFixed(2)]);
    }
    blocks.sort((a, b) => b[2] - a[2]); st.top = blocks.slice(0, 6); st.frames = s.n; st.per = s.per;
    if (s.reg) { const r = s.reg, mean = r.reduce((t, v) => t + v[0], 0) / r.length, d = r.slice(1).map((v, i) => Math.abs(v[0] - r[i][0]));
      st.region = { mean: +mean.toFixed(2), dMean: +(d.reduce((t, v) => t + v, 0) / d.length).toFixed(3), dMax: +Math.max(...d).toFixed(2),
        d1: +(r.slice(1).reduce((t, v) => t + v[1], 0) / (r.length - 1)).toFixed(3), d2: +(r.slice(2).reduce((t, v) => t + v[2], 0) / (r.length - 2)).toFixed(3), series: r.map((v) => v[0]) }; }
    const c = new OffscreenCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
    for (let i = 0; i < n; i++) { const v = Math.min(255, 8 * s.d2[i] / Math.max(1, s.k2)), m = Math.min(255, M[i]) * 0.25;
      img.data[4 * i] = Math.max(v, m); img.data[4 * i + 1] = m; img.data[4 * i + 2] = m; img.data[4 * i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' }), buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    window.__s = null;
    return { st, heat: btoa(bin) };
  },
};

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const an = await (await b.newContext()).newPage();
await an.goto('about:blank');
let failed = false;
const step = async (p, k = 1) => { for (let i = 0; i < k; i++) { await p.clock.runFor(16); while (await p.evaluate(() => window.__busy)) await new Promise((r) => setTimeout(r, 20)); } };

for (const raw of jobs) {
  const eq = raw.indexOf('='), name = raw.slice(0, eq), [q, ...opts] = raw.slice(eq + 1).split('|'), still = opts.includes('still');
  const crop = opts.find((o) => o.startsWith('crop='))?.slice(5).split(',').map(Number) ?? null;
  const dir = '/out/' + name; fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.clock.pauseAt(new Date('2026-11-20T12:00:00Z'));
  await p.addInitScript(() => { performance.now(); });
  await p.addInitScript(SEED); await p.addInitScript(BUSY);
  p.on('pageerror', (e) => { console.log('[' + name + '] pageerror', e.message); failed = true; });
  let inflight = 0, last = Date.now();
  p.on('request', () => { inflight++; last = Date.now(); }); p.on('requestfinished', () => { inflight--; last = Date.now(); }); p.on('requestfailed', () => { inflight--; });
  await p.goto(origin + '/' + q.replace(/^\/+/, ''));
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby)); i++) await new Promise((r) => setTimeout(r, 100));
  while (inflight > 0 || Date.now() - last < 1500) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1500));
  await step(p, WARM);
  await p.evaluate(() => { const st = document.createElement('style');
    st.textContent = 'body > :not(#scene) { visibility: hidden !important; opacity: 0 !important; transition: none !important; animation: none !important; }'; document.head.append(st); });
  if (still) await p.evaluate(() => {                    // the camera stays where it is: lookAt() and lerps write the same values every frame
    const cam = window.__lobby.camera, pos = cam.position.clone(), quat = cam.quaternion.clone();
    const lock = () => { cam.position.copy(pos); cam.quaternion.copy(quat); };
    cam.lookAt = function () { lock(); }; const upd = cam.updateMatrixWorld.bind(cam); cam.updateMatrixWorld = function (f) { lock(); return upd(f); };
  });
  await step(p, 2);
  const modes = [];
  for (let f = 0; f < FRAMES; f++) {
    await step(p, 1);
    const png = await p.screenshot();
    if (f === 0) fs.writeFileSync(dir + '/f000.png', png);
    if (f === FRAMES - 1) fs.writeFileSync(dir + '/last.png', png);
    await an.evaluate(ANALYSE.add, png.toString('base64'));
    if (crop) await an.evaluate(ANALYSE.region, crop);
    if (crop && f < 8) await an.evaluate(ANALYSE.strip, [png.toString('base64'), f, crop]);
    if (crop && f === 7) fs.writeFileSync(dir + '/strip.png', Buffer.from(await an.evaluate(ANALYSE.stripPng), 'base64'));
    if (f % 15 === 0) modes.push(await p.evaluate(() => { const m = window.__lobby.mode(); return m.scale + '/' + m.tier + '/' + m.size; }));
  }
  const { st, heat } = await an.evaluate(ANALYSE.finish);
  fs.writeFileSync(dir + '/heat.png', Buffer.from(heat, 'base64'));
  st.modes = [...new Set(modes)]; st.query = q; st.still = still; st.origin = originArg === '-' ? 'branch' : 'given';
  fs.writeFileSync(dir + '/stats.json', JSON.stringify(st));
  console.log('EDGEFLICKER', name, JSON.stringify({ edge: st.edge, all: st.all, region: st.region && { ...st.region, series: undefined }, modes: st.modes, top: st.top.slice(0, 3) }));
  await ctx.close();
}
await b.close();
if (failed) process.exit(1);
