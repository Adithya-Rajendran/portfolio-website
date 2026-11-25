// Deterministic snapshots (tools/detsnap.sh, tools/ci/run.sh pictures).
//   node detsnap.mjs <origin> <outdir> <defaultFrames> <name=query[|frames=N][|action=...]...>
// Time is faked (Playwright clock installed already-paused, exact 16 ms steps) and Math.random is seeded per calling
// file, so two runs of the same code give bit-identical pictures.
import { chromium } from 'playwright';

const [origin, out, frames, ...jobs] = process.argv.slice(2);
const DEFAULT_FRAMES = +frames || 90;

const BUSY = () => {                                               // fetches (to the end of their bodies) and image decodes still running
  window.__busy = 0;
  const track = (f) => function (...a) { window.__busy++; return f.apply(this, a).finally(() => window.__busy--); };
  window.fetch = track(window.fetch);
  window.createImageBitmap = track(window.createImageBitmap);
  for (const k of ['arrayBuffer', 'blob', 'json', 'text']) Response.prototype[k] = track(Response.prototype[k]);
};

const SEED = () => {
  const streams = {};
  const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Math.random = function () {
    const line = (new Error().stack.split('\n')[2] || ''), m = line.match(/\/([\w.-]+\.js)/), key = m ? m[1] : '?';
    if (!streams[key]) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0; streams[key] = mulberry(h); }
    return streams[key]();
  };
};

function parseJob(job) {
  const eq = job.indexOf('=');
  if (eq < 1) throw new Error(`detsnap: invalid job spec '${job}'`);
  const name = job.slice(0, eq);
  const [q, ...opts] = job.slice(eq + 1).split('|');
  let n = DEFAULT_FRAMES;
  let action = '';
  for (const opt of opts) {
    if (opt.startsWith('frames=')) n = +opt.slice(7);
    else if (opt.startsWith('action=')) action = opt.slice(7);
  }
  return { name, q, frames: n, action };
}

// One frame of fake time at a time; before the next, wait (in real time) until no request is open and nothing the page
// fetched or decodes is still pending, so a file asked for mid-way lands in the same frame on every run.
let net = { inflight: 0 };
async function stepFrames(p, count) {
  for (let i = 0; i < count; i++) {
    await p.clock.runFor(16);
    for (const t0 = Date.now(); net.inflight > 0 || await p.evaluate(() => window.__busy);) {
      if (Date.now() - t0 > 20000) { console.log('detsnap: still waiting after 20 s (requests', net.inflight, '); going on'); break; }
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

// 2D canvases are drawn in software. With GPU canvases Chrome decides per canvas, at run time, whether a canvas is
// accelerated, and texImage2D takes a different path for each (a GPU copy that unpremultiplies in a shader, or a
// readback that unpremultiplies on the CPU). The two round the soft edges of text differently, so a text texture could
// come out one way or the other on the same code. In software there is one path.
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
let failed = false;

for (const raw of jobs) {
  const { name, q, frames: jobFrames, action } = parseJob(raw);
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // Install and pause atomically at the same timestamp, then trigger _replayLogOnce() at document_start so
  // Playwright's 100 ms real-time inject timer cannot fire before module scripts load.
  await p.clock.pauseAt(new Date('2026-11-20T12:00:00Z'));
  await p.addInitScript(() => { performance.now(); });
  await p.addInitScript(SEED);
  await p.addInitScript(BUSY);
  p.on('pageerror', (e) => { console.log(`[${name}] pageerror`, e.message); failed = true; });
  p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] error`, m.text().slice(0, 300)); });

  net = { inflight: 0 };
  let last = Date.now(), settled = false;
  const late = [];                                                  // requests made after the first wait: logged with the probe
  p.on('request', (r) => { net.inflight++; last = Date.now(); if (settled) late.push(r.url().replace(/^https?:\/\/[^/]+/, '')); });
  p.on('requestfinished', () => { net.inflight--; last = Date.now(); });
  p.on('requestfailed', () => { net.inflight--; });

  await p.goto(`${origin.replace(/\/$/, '')}/${q.replace(/^\/+/, '')}`);
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby)); i++) await new Promise((r) => setTimeout(r, 100));
  while (net.inflight > 0 || Date.now() - last < 1500) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1500));                    // image decodes
  settled = true;

  // Ensure ?focus= poses settle completely even when called with a smaller default frame count (e.g. run.sh snap 60).
  const hasFocusParam = new URLSearchParams(q.split('?')[1] || '').has('focus');
  const initialFrames = hasFocusParam && !action ? Math.max(jobFrames, 150) : jobFrames;

  if (action === 'focusCta') {
    await p.evaluate(() => {
      const pick = window.__lobby.picks.find((x) => x.cta);
      if (!pick) throw new Error('focusCta: no cta pick');
      window.__lobby.setFocus(pick);
    });
    await stepFrames(p, Math.max(initialFrames, 150));
  } else if (action.startsWith('chooseBook:')) {
    const [, idxStr = '0', postFramesStr = '300'] = action.split(':');
    const idx = +idxStr, postFrames = +postFramesStr;
    await stepFrames(p, initialFrames);
    await p.evaluate((i) => {
      const term = window.__lobby.picks.find((x) => x.options);
      if (!term || !term.options[i]) throw new Error(`chooseBook: missing option ${i}`);
      term.options[i][1]();
    }, idx);
    await stepFrames(p, postFrames);
    const check = await p.evaluate(() => ({ held: window.__lobby.held(), reader: window.__lobby.reader.state() }));
    if (!check.held || check.reader !== 'closed') {
      console.error(`[${name}] chooseBook check failed: ${JSON.stringify(check)}`);
      failed = true;
    }
  } else if (action === 'waitReader') {
    await stepFrames(p, initialFrames);
    for (let extra = 0; extra < 120; extra++) {
      const done = await p.evaluate(() => window.__lobby.reader.state() === 'open' && !window.__lobby.display.state().gliding);
      if (done) break;
      await stepFrames(p, 1);
    }
    const rState = await p.evaluate(() => window.__lobby.reader.state());
    if (rState !== 'open') {
      console.error(`[${name}] waitReader did not reach open (state=${rState})`);
      failed = true;
    }
  } else {
    await stepFrames(p, initialFrames);
  }

  if (hasFocusParam && !action.startsWith('chooseBook:')) {
    for (let extra = 0; extra < 60; extra++) {
      const gliding = await p.evaluate(() => window.__lobby.display.state().gliding);
      if (!gliding) break;
      await stepFrames(p, 1);
    }
  }

  // Hide all DOM overlays (#hud, #lock, #cue, #inspectbar, #reader, #comms, #loader, #stepin, #page) without
  // collapsing layout, then step 2 deterministic frames so WebGL renders clean and CSS transitions never race.
  await p.evaluate(() => {
    if (!document.getElementById('detsnap-hide')) {
      const st = document.createElement('style');
      st.id = 'detsnap-hide';
      st.textContent = 'body > :not(#scene) { visibility: hidden !important; opacity: 0 !important; transition: none !important; animation: none !important; }';
      document.head.append(st);
    }
  });
  await stepFrames(p, 2);
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate(async () => ({
    ...window.__lobby.mode(),
    uTime: (await import('./js/kit.js')).uTime.value,
    now: performance.now(),
  }))));
  console.log(name, 'probe', JSON.stringify(await p.evaluate(() => {
    const seen = new Set(), out = [];
    const h = (cv) => { const d = new Uint32Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer); let x = 2166136261; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619); return (x >>> 0).toString(16); };
    const look = (v) => { const im = v && v.isTexture && v.image; if (im instanceof HTMLCanvasElement && !seen.has(im)) { seen.add(im); out.push(im.width + 'x' + im.height + ':' + h(im)); } };
    window.__lobby.scene.traverse((o) => { for (const m of [].concat(o.material || [])) { for (const k in m) look(m[k]); for (const k in m.uniforms || {}) look(m.uniforms[k].value); } });
    const r = window.__lobby.renderer.info;
    return { frame: r.render.frame, tex: r.memory.textures, geo: r.memory.geometries, prog: r.programs.length, canvases: out };
  })), 'late', JSON.stringify(late));
  await ctx.close();
}

await b.close();
if (failed) process.exit(1);
