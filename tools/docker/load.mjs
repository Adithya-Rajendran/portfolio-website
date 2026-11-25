// Time to the first frame over a throttled link, and what is fetched on the way.  node load.mjs <url> [mbps] [rtt ms]
import { chromium } from 'playwright';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
const [rawUrl = '/', mbps = 50, rtt = 20] = process.argv.slice(2);
const url = new URL(rawUrl, origin + '/').href;

const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }), p = await ctx.newPage();
  p.on('pageerror', (e) => { process.exitCode = 1; console.log('[pageerror]', e.message); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  if (+mbps) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: +rtt, downloadThroughput: +mbps * 125000, uploadThroughput: +mbps * 125000 / 4 });
  const t0 = Date.now();
  await p.goto(url);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 'raf', timeout: 600000 });
  const lifted = Date.now() - t0;
  const r = await p.evaluate(() => {
    const es = performance.getEntriesByType('resource'), kind = (n) => (/\.ktx2/.test(n) ? 'ktx2' : /\.glb/.test(n) ? 'glb' : /\.wasm/.test(n) ? 'wasm' : /\.m?js/.test(n) ? 'js' : /\.json/.test(n) ? 'json' : /\.css/.test(n) ? 'css' : /\.(png|webp|jpg)/.test(n) ? 'img' : 'other');
    const by = {};
    for (const e of es) { const k = kind(e.name); by[k] ??= { n: 0, kb: 0, first: 1e9, last: 0 }; by[k].n++; by[k].kb += e.transferSize / 1024; by[k].first = Math.min(by[k].first, e.startTime); by[k].last = Math.max(by[k].last, e.responseEnd); }
    for (const k in by) { by[k].kb = Math.round(by[k].kb); by[k].first = Math.round(by[k].first); by[k].last = Math.round(by[k].last); }
    const first = (re) => { const e = es.find((x) => re.test(x.name)); return e ? [Math.round(e.startTime), Math.round(e.responseEnd)] : null; };
    return { by, total_kb: Math.round(es.reduce((a, e) => a + e.transferSize, 0) / 1024), n: es.length, marks: { main: first(/main\.js/), three: first(/three\.module/), content: first(/content\.json/), scene: first(/scene\.json/), glb: first(/room\.glb/), firstKtx: first(/\.ktx2/), basis: first(/basis_transcoder\.wasm/) } };
  });
  console.log(JSON.stringify({ mbps: +mbps, rtt: +rtt, lifted, ...r }));
} finally {
  await b.close();
}
