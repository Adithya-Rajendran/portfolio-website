// Deterministic snapshots for tools/detsnap.sh and the pictures tier
import { chromium } from 'playwright';

const [origin, out, frames, ...jobs] = process.argv.slice(2);
const DEFAULT_FRAMES = +frames || 90;

const BUSY = () => {
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
  const maps = {}, sites = {}, B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const sourceMap = (url) => {
    if (url in maps) return maps[url];
    maps[url] = null;
    try {
      const x = new XMLHttpRequest();
      x.open('GET', url + '.map', false);
      x.send();
      if (x.status !== 200) return null;
      const { sources, mappings } = JSON.parse(x.responseText), lines = [];
      let src = 0;
      for (const text of mappings.split(';')) {
        const segs = [];
        let col = 0;
        for (const seg of text.split(',')) {
          if (!seg) continue;
          const v = [];
          let value = 0, shift = 0;
          for (const ch of seg) {
            const d = B64.indexOf(ch);
            value += (d & 31) << shift;
            if (d & 32) shift += 5; else { v.push(value & 1 ? -(value >>> 1) : value >>> 1); value = 0; shift = 0; }
          }
          col += v[0];
          if (v.length > 1) src += v[1];
          segs.push([col, v.length > 1 ? src : -1]);
        }
        lines.push(segs);
      }
      return (maps[url] = { sources, lines });
    } catch { return null; }
  };
  const sourceOf = (url, line, col) => {
    const map = sourceMap(url), segs = map?.lines[line - 1];
    if (!segs) return null;
    let lo = 0, hi = segs.length - 1, at = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (segs[mid][0] <= col - 1) { at = mid; lo = mid + 1; } else hi = mid - 1; }
    const i = at < 0 ? -1 : segs[at][1];
    return i < 0 ? null : map.sources[i].split('/').pop();
  };
  const keyOf = (line) => {
    const b = line.match(/(https?:\/\/[^\s()]+\/app\/[^\s()]+\.js):(\d+):(\d+)/);
    if (b) {
      const site = b[1] + ':' + b[2] + ':' + b[3];
      if (!(site in sites)) sites[site] = sourceOf(b[1], +b[2], +b[3]);
      if (sites[site]) return sites[site];
    }
    const m = line.match(/\/([\w.-]+\.js)/);
    return m ? m[1] : '?';
  };
  Math.random = function () {
    const key = keyOf(new Error().stack.split('\n')[2] || '');
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

const STEP_WAIT_MS = 20000, LOAD_WAIT_MS = 60000;

function stuck(net, what, ms) {
  const open = [...net.open.values()];
  console.error('[' + net.name + '] ' + what + ': still busy after ' + ms / 1000 + ' s; open requests: ' + (open.length ? open.join(' ') : 'none') + '; page work pending: ' + net.busy);
  net.over = true;
  failed = true;
}

async function stepFrames(p, count, net) {
  for (let i = 0; i < count; i++) {
    await p.clock.runFor(16);
    while (!net.over && (net.open.size > 0 || (net.busy = await p.evaluate(() => window.__busy)) > 0)) {
      if (net.waited >= STEP_WAIT_MS) { stuck(net, 'frame stepping', STEP_WAIT_MS); break; }
      await new Promise((r) => setTimeout(r, 20));
      net.waited += 20;
    }
  }
}

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas'] });
let failed = false;

for (const raw of jobs) {
  const { name, q, frames: jobFrames, action } = parseJob(raw);
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.clock.pauseAt(new Date('2026-11-20T12:00:00Z'));
  await p.addInitScript(() => { performance.now(); });
  await p.addInitScript(SEED);
  await p.addInitScript(BUSY);
  p.on('pageerror', (e) => { console.log(`[${name}] pageerror`, e.message); failed = true; });
  p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] error`, m.text().slice(0, 300)); });

  const net = { name, open: new Map(), busy: 0, waited: 0, over: false };
  let last = Date.now(), settled = false;
  const late = [];
  const path = (r) => r.url().replace(/^https?:\/\/[^/]+/, '');
  p.on('request', (r) => { net.open.set(r, path(r)); last = Date.now(); if (settled) late.push(path(r)); });
  p.on('requestfinished', (r) => { net.open.delete(r); last = Date.now(); });
  p.on('requestfailed', (r) => { net.open.delete(r); });

  await p.goto(`${origin.replace(/\/$/, '')}/${q.replace(/^\/+/, '')}`);
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby)); i++) await new Promise((r) => setTimeout(r, 100));
  for (const t0 = Date.now(); net.open.size > 0 || Date.now() - last < 1500;) {
    if (Date.now() - t0 > LOAD_WAIT_MS) { stuck(net, 'loading', LOAD_WAIT_MS); break; }
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 1500));
  let streamed = false;
  for (let i = 0; i < 1200 && !(streamed = await p.evaluate(() => window.__lobby?.scene?.userData?.stream?.settled?.() ?? true)); i++) await new Promise((r) => setTimeout(r, 100));
  if (!streamed) { console.error(`[${name}] textures still streaming in after 120 s: not pictured`); failed = true; await ctx.close(); continue; }
  settled = true;

  const hasFocusParam = new URLSearchParams(q.split('?')[1] || '').has('focus');
  const initialFrames = hasFocusParam && !action ? Math.max(jobFrames, 150) : jobFrames;

  if (action === 'focusCta') {
    await p.evaluate(() => {
      const pick = window.__lobby.picks.find((x) => x.cta);
      if (!pick) throw new Error('focusCta: no cta pick');
      window.__lobby.setFocus(pick);
    });
    await stepFrames(p, Math.max(initialFrames, 150), net);
  } else if (action.startsWith('chooseBook:')) {
    const [, idxStr = '0', postFramesStr = '300'] = action.split(':');
    const idx = +idxStr, postFrames = +postFramesStr;
    await stepFrames(p, initialFrames, net);
    await p.evaluate((i) => {
      const term = window.__lobby.picks.find((x) => x.options);
      if (!term || !term.options[i]) throw new Error(`chooseBook: missing option ${i}`);
      term.options[i][1]();
    }, idx);
    await stepFrames(p, postFrames, net);
    const check = await p.evaluate(() => ({ held: window.__lobby.held(), reader: window.__lobby.reader.state() }));
    if (!check.held || check.reader !== 'closed') {
      console.error(`[${name}] chooseBook check failed: ${JSON.stringify(check)}`);
      failed = true;
    }
  } else if (action === 'waitReader') {
    await stepFrames(p, initialFrames, net);
    for (let extra = 0; extra < 120; extra++) {
      const done = await p.evaluate(() => window.__lobby.reader.state() === 'open' && !window.__lobby.display.state().gliding);
      if (done) break;
      await stepFrames(p, 1, net);
    }
    const rState = await p.evaluate(() => window.__lobby.reader.state());
    if (rState !== 'open') {
      console.error(`[${name}] waitReader did not reach open (state=${rState})`);
      failed = true;
    }
  } else {
    await stepFrames(p, initialFrames, net);
  }

  if (hasFocusParam && !action.startsWith('chooseBook:')) {
    for (let extra = 0; extra < 60; extra++) {
      const gliding = await p.evaluate(() => window.__lobby.display.state().gliding);
      if (!gliding) break;
      await stepFrames(p, 1, net);
    }
  }

  await p.evaluate(() => {
    if (!document.getElementById('detsnap-hide')) {
      const st = document.createElement('style');
      st.id = 'detsnap-hide';
      st.textContent = 'body > :not(#scene) { visibility: hidden !important; opacity: 0 !important; transition: none !important; animation: none !important; }';
      document.head.append(st);
    }
  });
  await stepFrames(p, 2, net);
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, JSON.stringify(await p.evaluate(async () => ({
    ...window.__lobby.mode(),
    uTime: (window.__modules?.kit ?? await import('./js/kit.js')).uTime.value,
    now: performance.now(),
  }))));
  console.log(name, 'probe', JSON.stringify(await p.evaluate(() => {
    const seen = new Set(), out = [], R = window.__lobby.renderer, gl = R.getContext(), fb = gl.createFramebuffer();
    const fnv = (d) => { let x = 2166136261; for (let i = 0; i < d.length; i++) x = Math.imul(x ^ d[i], 16777619); return (x >>> 0).toString(16); };
    const h = (cv) => fnv(new Uint32Array(cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.buffer));
    const level = (t, l, w, hh) => {
      const g = R.properties.get(t).__webglTexture; if (!g) return '-';
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, g, l);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return '?';
      const W = Math.max(1, w >> l), H = Math.max(1, hh >> l), d = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d);
      return fnv(new Uint32Array(d.buffer));
    };
    const look = (v) => { const im = v && v.isTexture && v.image; if (im instanceof HTMLCanvasElement && !seen.has(im)) { seen.add(im); out.push(im.width + 'x' + im.height + ':' + h(im) + '/' + level(v, 0, im.width, im.height) + '/' + level(v, 1, im.width, im.height)); } };
    window.__lobby.scene.traverse((o) => { for (const m of [].concat(o.material || [])) { for (const k in m) look(m[k]); for (const k in m.uniforms || {}) look(m.uniforms[k].value); } });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
    const r = R.info;
    return { frame: r.render.frame, tex: r.memory.textures, geo: r.memory.geometries, prog: r.programs.length, canvases: out };
  })), 'late', JSON.stringify(late));
  await ctx.close();
}

await b.close();
if (failed) process.exit(1);
