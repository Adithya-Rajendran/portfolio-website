// Deterministic snapshots (tools/detsnap.sh, tools/ci/run.sh pictures).
//   node detsnap.mjs <origin> <outdir> <defaultFrames> <name=query[|frames=N][|action=...]...>
// Time is faked (Playwright clock installed already-paused, exact 16 ms steps) and Math.random is seeded per calling
// file, so two runs of the same code give bit-identical pictures.
import { chromium } from 'playwright';

const [origin, out, frames, ...jobs] = process.argv.slice(2);
const DEFAULT_FRAMES = +frames || 90;

const BUSY = () => {                                               // fetches and image decodes still running in the page
  window.__busy = 0;
  const track = (f) => function (...a) { window.__busy++; return f.apply(this, a).finally(() => window.__busy--); };
  window.fetch = track(window.fetch);
  window.createImageBitmap = track(window.createImageBitmap);
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

async function stepFrames(p, count) {
  for (let i = 0; i < count; i++) {
    await p.clock.runFor(16);
    while (await p.evaluate(() => window.__busy)) await new Promise((r) => setTimeout(r, 20));
  }
}

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
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

  let inflight = 0, last = Date.now();
  p.on('request', () => { inflight++; last = Date.now(); });
  p.on('requestfinished', () => { inflight--; last = Date.now(); });
  p.on('requestfailed', () => { inflight--; });

  await p.goto(`${origin.replace(/\/$/, '')}/${q.replace(/^\/+/, '')}`);
  for (let i = 0; i < 600 && !(await p.evaluate(() => !!window.__lobby)); i++) await new Promise((r) => setTimeout(r, 100));
  while (inflight > 0 || Date.now() - last < 1500) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1500));                    // image decodes
  // The room loader streams the sky and orrery layers in after the first frame (task O7): wait until every one is in
  // (transcoded and uploaded), so no state is pictured with a layer still to come. Commits before O7 have nothing to wait for.
  for (let i = 0; i < 1200 && !(await p.evaluate(() => window.__lobby?.scene?.userData?.stream?.settled?.() ?? true)); i++) await new Promise((r) => setTimeout(r, 100));

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
  await ctx.close();
}

await b.close();
if (failed) process.exit(1);
