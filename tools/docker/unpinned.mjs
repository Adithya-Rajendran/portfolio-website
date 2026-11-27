// Visit with nothing pinned and the vsync of the browser, on this GPU
import { chromium } from 'playwright';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const [rawUrl = '/', secs = 30, w = 1920, h = 1080, dpr = 1] = process.argv.slice(2);
const url = new URL(rawUrl, origin + '/').href;

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  p.on('pageerror', (e) => { process.exitCode = 1; console.log('[pageerror]', e.message); });
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 'raf', timeout: 300000 });
  const lifted = Date.now() - t0, trace = [];
  for (let s = 0; s < +secs; s += 2) {
    await p.waitForTimeout(2000);
    const m = await p.evaluate(() => window.__lobby.mode());
    trace.push(`${m.tier}:${m.scale}`);
  }
  const r = await p.evaluate(() => new Promise((res, rej) => {
    const dt = []; let last = performance.now(), t0 = last;
    function f(now) {
      dt.push(now - last); last = now;
      if (now - t0 < 8000) return requestAnimationFrame(f);
      dt.shift();
      if (!dt.length) return rej(new Error('unpinned: 0 frames captured'));
      const avg = dt.reduce((a, c) => a + c, 0) / dt.length; dt.sort((a, c) => a - c);
      res({ fps: +(1000 / avg).toFixed(1), med: +dt[dt.length >> 1].toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), mode: window.__lobby.mode() });
    }
    requestAnimationFrame(f);
  }));
  console.log(JSON.stringify({ lifted, trace: trace.join(' '), ...r }));
} finally {
  await b.close();
}
