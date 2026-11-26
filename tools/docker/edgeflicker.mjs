// Records consecutive frames of room states and measures their frame-to-frame flicker (tools/ci/run.sh script edgeflicker.mjs).
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
  keep([x, y, w, h]) {
    const s = window.__s, W = s.W, c = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c[j * w + i] = s.p1[(y + j) * W + x + i];
    (s.crops ??= []).push(c); s.cw = w; s.ch = h;
  },
  async jump() {
    const s = window.__s, r = s.reg, w = s.cw, h = s.ch; if (!r || r.length < 3) return null;
    let k = 1; for (let i = 1; i < r.length; i++) if (Math.abs(r[i][0] - r[i - 1][0]) > Math.abs(r[k][0] - r[k - 1][0])) k = i;
    const lo = Math.max(0, k - 2), hi = Math.min(r.length, lo + 5), n = hi - lo, S = 3;
    const c = new OffscreenCanvas((w * S + 4) * (n + 1), h * S), g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
    const put = (col, f) => { for (let j = 0; j < h * S; j++) for (let i = 0; i < w * S; i++) { const v = f(((j / S) | 0) * w + ((i / S) | 0)), o = 4 * (j * c.width + col * (w * S + 4) + i);
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.min(255, v); img.data[o + 3] = 255; } };
    for (let f = lo; f < hi; f++) put(f - lo, (q) => s.crops[f][q]);
    put(n, (q) => 4 * Math.abs(s.crops[k][q] - s.crops[k - 1][q]));
    g.putImageData(img, 0, 0);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { k, png: btoa(bin) };
  },
  region([x, y, w, h]) {
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
    const near = (pred) => {
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

const HDR = ([x, y, w, h]) => {
  const { renderer: r, post } = window.__lobby, gl = r.getContext();
  const read = (rt, X, Y, W, H) => {
    const fb = r.properties.get(rt).__webglFramebuffer; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
    const a = new Float32Array(W * H * 4); gl.readPixels(X, Y, W, H, gl.RGBA, gl.FLOAT, a); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    let max = 0, at = -1, n16 = 0, n64 = 0, n1k = 0, bad = 0, top = [], nq = 0, nh = 0;
    if (rt === post.scene) {
      const prev = window.__hdrPrev; window.__hdrPrev = a;
      if (prev && prev.length === a.length) { const d = [];
        for (let i = 0; i < W * H; i++) { const v = Math.max(a[4 * i], a[4 * i + 1], a[4 * i + 2]), u = Math.max(prev[4 * i], prev[4 * i + 1], prev[4 * i + 2]); d.push([Math.abs(v - u), i, u, v]); }
        d.sort((p, q) => q[0] - p[0]); top = d.slice(0, 6).map(([, i, u, v]) => [X + i % W, Y + ((i / W) | 0), +u.toPrecision(3), +v.toPrecision(3)]); } }
    for (let i = 0; i < W * H; i++) { const v = Math.max(a[4 * i], a[4 * i + 1], a[4 * i + 2]);
      if (!Number.isFinite(v)) { bad++; continue; } if (v > max) { max = v; at = i; } if (v > .25) nq++; if (v > .5) nh++; if (v > 16) n16++; if (v > 64) n64++; if (v > 1000) n1k++; }
    return { max: +max.toPrecision(4), at: at < 0 ? null : [X + at % W, Y + ((at / W) | 0)], nq, nh, n16, n64, n1k, bad, ...(top.length ? { top } : {}) };
  };
  const H0 = post.scene.height, sy = H0 - y - h;
  const c = window.__lobby.camera, e = c.matrixWorld.elements, f6 = (v) => +v.toFixed(6);
  return { cam: [f6(c.position.x), f6(c.position.y), f6(c.position.z), f6(e[8]), f6(e[9]), f6(e[10])], frame: r.info.render.frame,
    scene: read(post.scene, x, sy, w, h), bloom0: read(post.bloom[0], x >> 1, sy >> 1, w >> 1, h >> 1) };
};
const IDPASS = async ([x, y, w, h, f]) => {
  const THREE = await import('three'), L = window.__lobby, r = L.renderer, cam = L.camera, W0 = L.post.scene.width, H0 = L.post.scene.height;
  const st = (window.__idp ??= { list: [], grids: [], frames: [] });
  if (!st.scene) {
    st.scene = new THREE.Scene(); st.rt = new THREE.WebGLRenderTarget(W0, H0, { depthBuffer: true });
    const vs = 'flat varying highp int vTri; void main(){ vTri = gl_VertexID / 3; vec4 w = modelMatrix*vec4(position,1.0); gl_Position = projectionMatrix*viewMatrix*w; }';
    const fs = 'uniform int uM; flat varying highp int vTri; void main(){ gl_FragColor = vec4(float(uM), float((vTri >> 16) & 255), float((vTri >> 8) & 255), float(vTri & 255)) / 255.0; }';
    L.scene.traverse((o) => {
      if (!o.isMesh || o.material?.colorWrite === false || o.material?.transparent || !o.visible) return;
      let vis = true; o.traverseAncestors((a) => { if (!a.visible) vis = false; }); if (!vis) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry, m = st.list.length + 1;
      if (m > 250) return;
      const p = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: { uM: { value: m } }, side: o.material.side ?? THREE.FrontSide }));
      p.matrixAutoUpdate = false; p.frustumCulled = false; p.renderOrder = o.renderOrder; st.scene.add(p);
      st.list.push({ o, p, name: (o.name || '?') + (o.userData.grp ? ':' + o.userData.grp : '') });
    });
  }
  for (const e of st.list) e.p.matrix.copy(e.o.matrixWorld), e.p.matrixWorld.copy(e.o.matrixWorld);
  const sx = W0 / innerWidth, sy = H0 / innerHeight, X = Math.floor(x * sx), Y = Math.floor(y * sy), Wd = Math.max(1, Math.round(w * sx)), Hd = Math.max(1, Math.round(h * sy));
  const prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha(), prevAuto = r.autoClear;
  r.setRenderTarget(st.rt); r.setClearColor(0x000000, 0); r.autoClear = true; r.clear(); r.render(st.scene, cam);
  const buf = new Uint8Array(Wd * Hd * 4); r.readRenderTargetPixels(st.rt, X, H0 - Y - Hd, Wd, Hd, buf);
  r.setRenderTarget(prevRT); r.setClearColor(prevClear, prevA); r.autoClear = prevAuto;
  const grid = new Int32Array(Wd * Hd * 2);
  for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) { const s = 4 * ((Hd - 1 - j) * Wd + i), d = 2 * (j * Wd + i); grid[d] = buf[s]; grid[d + 1] = (buf[s + 1] << 16) | (buf[s + 2] << 8) | buf[s + 3]; }
  st.grids.push(grid); st.frames.push(f); st.Wd = Wd; st.Hd = Hd; st.X = X; st.Y = Y; st.cams = (st.cams ?? []).concat([[...cam.matrixWorld.elements].map((v) => +v.toFixed(6))]);
};
const IDSUM = () => {
  const st = window.__idp, { Wd, Hd, grids } = st, n = Wd * Hd, pairs = new Map(), changed = [];
  const key = (g, k) => g[2 * k] ? st.list[g[2 * k] - 1].name + '#' + g[2 * k + 1] : 'none';
  for (let k = 0; k < n; k++) for (let f = 1; f < grids.length; f++) {
    const a = key(grids[f - 1], k), b = key(grids[f], k);
    if (a !== b) { const pk = [a, b].sort().join(' <> '); const e = pairs.get(pk) ?? { n: 0, frames: new Set(), px: new Set() }; e.n++; e.frames.add(st.frames[f]); e.px.add((st.X + k % Wd) + ',' + (st.Y + ((k / Wd) | 0))); pairs.set(pk, e); }
  }
  const tri = (nm) => {
    const [mesh, t] = nm.split('#'); const e = st.list.find((q) => q.name === mesh); if (!e) return null;
    const g = e.p.geometry, P = g.attributes.position, U = g.attributes.uv, N = g.attributes.normal, M = e.o.matrixWorld, out = { side: e.o.material.side, type: e.o.material.type, v: [], uv: [], n: null };
    for (let i = 0; i < 3; i++) { const v = 3 * +t + i; const p = { x: P.getX(v), y: P.getY(v), z: P.getZ(v) };
      const e2 = M.elements; out.v.push([p.x * e2[0] + p.y * e2[4] + p.z * e2[8] + e2[12], p.x * e2[1] + p.y * e2[5] + p.z * e2[9] + e2[13], p.x * e2[2] + p.y * e2[6] + p.z * e2[10] + e2[14]].map((q) => +q.toFixed(5)));
      if (U) out.uv.push([+U.getX(v).toFixed(4), +U.getY(v).toFixed(4)]); }
    if (N) out.n = [N.getX(3 * +t), N.getY(3 * +t), N.getZ(3 * +t)].map((q) => +q.toFixed(3));
    return out;
  };
  const top = [...pairs.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([k, e]) => ({ pair: k, flips: e.n, px: e.px.size, frames: [...e.frames].slice(0, 24), sample: [...e.px].slice(0, 6), tris: Object.fromEntries(k.split(' <> ').map((q) => [q, tri(q)])) }));
  return { size: [Wd, Hd], at: [st.X, st.Y], frames: grids.length, changedPairs: pairs.size, top, cam0: st.cams[0] };
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
  const hideOpt = opts.find((o) => o.startsWith('hide='));
  if (hideOpt) console.log('HIDDEN', name, await p.evaluate((t) => { let n = 0; window.__lobby.scene.traverse((o) => { if (o.isMesh && o.material?.type === t) { o.visible = false; n++; } }); return n; }, hideOpt.slice(5)));
  if (still) await p.evaluate(() => {
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
    if (crop) { await an.evaluate(ANALYSE.region, crop); await an.evaluate(ANALYSE.keep, crop); }
    if (crop && opts.includes('hdr')) console.log('HDR', name, f, JSON.stringify(await p.evaluate(HDR, crop)));
    if (crop && opts.includes('id')) await p.evaluate(IDPASS, [...crop, f]);
    if (crop && f < 8) await an.evaluate(ANALYSE.strip, [png.toString('base64'), f, crop]);
    if (crop && f === 7) fs.writeFileSync(dir + '/strip.png', Buffer.from(await an.evaluate(ANALYSE.stripPng), 'base64'));
    if (f % 15 === 0) modes.push(await p.evaluate(() => { const m = window.__lobby.mode(); return m.scale + '/' + m.tier + '/' + m.size; }));
  }
  if (crop) { const j = await an.evaluate(ANALYSE.jump); if (j) { fs.writeFileSync(dir + '/jump.png', Buffer.from(j.png, 'base64')); console.log('JUMP', name, 'frame', j.k); } }
  if (crop && opts.includes('id')) { const idr = await p.evaluate(IDSUM); fs.writeFileSync(dir + '/id.json', JSON.stringify(idr)); console.log('IDWIN', name, JSON.stringify(idr)); }
  const { st, heat } = await an.evaluate(ANALYSE.finish);
  fs.writeFileSync(dir + '/heat.png', Buffer.from(heat, 'base64'));
  st.modes = [...new Set(modes)]; st.query = q; st.still = still; st.origin = originArg === '-' ? 'branch' : 'given';
  fs.writeFileSync(dir + '/stats.json', JSON.stringify(st));
  console.log('EDGEFLICKER', name, JSON.stringify({ edge: st.edge, all: st.all, region: st.region && { ...st.region, series: undefined }, modes: st.modes, top: st.top.slice(0, 3) }));
  await ctx.close();
}
await b.close();
if (failed) process.exit(1);