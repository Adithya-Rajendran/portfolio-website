// Frames, bytes and first frame time while a room streams its textures
import { chromium } from 'playwright';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const [rawUrl = '/', mbps = 10, rtt = 20, runs = 3] = process.argv.slice(2);
const url = new URL(rawUrl, origin + '/').href;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const r1 = (x) => Math.round(x * 10) / 10;

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  for (let run = 0; run < +runs; run++) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }), p = await ctx.newPage();
    p.on('pageerror', (e) => { process.exitCode = 1; console.log('[pageerror]', e.message); });
    await p.addInitScript(() => {
      window.__frames = []; let last = 0;
      const loop = (t) => { if (last) window.__frames.push([t, t - last]); last = t; if (!window.__lift && window.__lobby?.ready() > 0) window.__lift = t; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    let inflight = 0, quietSince = Date.now();
    p.on('request', () => { inflight++; });
    const end = () => { inflight--; if (!inflight) quietSince = Date.now(); };
    p.on('requestfinished', end); p.on('requestfailed', end);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    if (+mbps) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: +rtt, downloadThroughput: +mbps * 125000, uploadThroughput: +mbps * 125000 / 4 });
    await p.goto(url);
    await p.waitForFunction(() => window.__lift > 0, null, { polling: 100, timeout: 600000 });
    while (inflight > 0 || Date.now() - quietSince < 2000) await new Promise((r) => setTimeout(r, 100));
    const streamEnd = await p.evaluate(() => performance.now());
    await new Promise((r) => setTimeout(r, 5000));
    const r = await p.evaluate(({ streamEnd }) => {
      const es = performance.getEntriesByType('resource'), nav = performance.getEntriesByType('navigation')[0], lift = window.__lift;
      const kb = (list) => Math.round(list.reduce((a, e) => a + e.transferSize, 0) / 1024);
      return { lift, before: kb([nav, ...es.filter((e) => e.responseEnd <= lift)]), total: kb([nav, ...es]), after: es.filter((e) => e.startTime > lift).length,
        streaming: window.__frames.filter(([t]) => t > lift && t <= streamEnd).map(([, d]) => d), settled: window.__frames.filter(([t]) => t > streamEnd).map(([, d]) => d) };
    }, { streamEnd });
    const worst = Math.max(0, ...r.streaming), settled = median(r.settled);
    console.log(JSON.stringify({ url: rawUrl, mbps: +mbps, run: run + 1, lifted_ms: Math.round(r.lift), kb_before_lift: r.before, kb_total: r.total, requests_after_lift: r.after,
      stream_ms: Math.round(streamEnd - r.lift), frames: r.streaming.length, worst_ms: r1(worst), median_streaming_ms: r1(median(r.streaming)), median_settled_ms: r1(settled), worst_over_median: r1(worst / settled * 100) / 100 }));
    await ctx.close();
  }
} finally {
  await b.close();
}
