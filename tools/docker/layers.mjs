// Checks the room loader's streamed textures: layers, holds, retries, aborts.     node layers.mjs   (ORIGIN: the site)
import { chromium } from 'playwright';
import { streamAbort } from './reqfail.mjs';

const origin = (process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
let failed = 0;
const ok = (c, msg) => { console.log(`${c ? '  ok  ' : '  FAIL'} ${msg}`); if (!c) failed++; };
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(q, setup) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), p = await ctx.newPage(), errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await setup?.(p, ctx);
  await p.goto(`${origin}/${q}`);
  await p.waitForFunction(() => window.__lobby?.ready() > 0, null, { polling: 100, timeout: 180000 });
  return { ctx, p, errors };
}
const state = (p) => p.evaluate(() => window.__lobby.scene.userData.stream.state());
const settled = (p, ms = 90000) => p.waitForFunction(() => window.__lobby.scene.userData.stream.settled(), null, { polling: 100, timeout: ms }).then(() => true, () => false);
const turns = async (p) => { const a = (await state(p)).chand; await p.waitForTimeout(1500); const c = (await state(p)).chand; return !!a && a.some((x, i) => Math.abs(x - c[i]) > 1e-4); };
const skyIn = (s) => { const [i, j, f] = s.sky; return all(s, (n) => n.endsWith('_s')).every(([, l]) => l.have.includes(i) && (!f || l.have.includes(j))); };
const all = (s, want = () => true) => Object.entries(s.layers).filter(([n]) => want(n));

for (const [room, path] of [['lobby', ''], ['about', 'about/']]) {
  const { ctx, p, errors } = await open(path);
  const done = await settled(p), s = await state(p);
  ok(done, `${room}: every layer fetched (${Object.keys(s.layers).length} layered textures)`);
  ok(all(s).every(([n, l]) => l.failed.length === 0 && l.have.length === (n.endsWith('_s') ? 6 : 3)), `${room}: every layer in, none given up`);
  ok(!s.hold, `${room}: no hold left`);
  await p.waitForFunction(() => window.__lobby.scene.userData.stream.state().swaps === 0, null, { polling: 100, timeout: 30000 }).catch(() => {});
  const f = await state(p);
  ok(f.split > 0 && f.small === 0, `${room}: every texture cut in two ends at full detail (${f.split} textures, ${f.small} still small)`);
  ok(skyIn(s), `${room}: the sky samples only layers that are in`);
  if (room === 'lobby') ok(await turns(p), 'lobby: the orrery turns once its phases are in');
  ok(!errors.length, `${room}: no page error ${errors.join(' | ')}`);
  await ctx.close();
}

{
  let tries = 0, counted = 0, missing = 0;
  const { ctx, p, errors } = await open('', (pg) => {
    pg.on('requestfailed', (r) => { if (!streamAbort(r)) counted++; });
    pg.on('response', (r) => { if (r.status() === 404 && /archC_s5\.ktx2/.test(r.url())) missing++; });
    return pg.route(/\/assets\/lobby\/tex\/(foliage_c1|archC_s4|archC_s5)\.ktx2/, (r) => { tries++; return /s5/.test(r.request().url()) ? r.fulfill({ status: 404, body: 'Not found' }) : r.abort(); });
  });
  const done = await settled(p), s = await state(p);
  ok(done, 'refused layers: streaming ends');
  ok(s.layers.foliage_c.failed.includes(1) && s.layers.archC_s.failed.includes(4) && s.layers.archC_s.failed.includes(5), `refused layers: given up (${tries} requests refused)`);
  ok(tries >= 12, 'refused layers: each was tried four times');
  ok(counted >= 8 && missing >= 4, `refused layers: a refused .ktx2 still counts as a failed request (${counted}) and a 404 as an HTTP error (${missing})`);
  ok(!s.hold, 'refused layers: the orrery hold let go');
  ok(await turns(p), 'refused layers: the orrery turns');
  ok(!errors.length, `refused layers: no page error ${errors.join(' | ')}`);
  await ctx.close();
}

{
  const { ctx, p, errors } = await open('', (pg) => pg.route(/\/assets\/lobby\/tex\/props\.tail\.ktx2/, (r) => r.fulfill({ status: 404, body: 'Not found' })));
  const done = await settled(p);
  await p.waitForFunction(() => window.__lobby.scene.userData.stream.state().swaps === 0, null, { polling: 100, timeout: 30000 }).catch(() => {});
  const s = await state(p);
  ok(done && s.small === 1 && !s.hold, `refused tail: streaming ends, one texture stays small (${s.small}), nothing held`);
  ok(!errors.length, `refused tail: no page error ${errors.join(' | ')}`);
  await ctx.close();
}
{
  let tails = 0;
  const { ctx, p, errors } = await open('', async (pg) => {
    await pg.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }));
    pg.on('request', (r) => { if (/\.tail\.ktx2/.test(r.url())) tails++; });
  });
  const done = await settled(p), s = await state(p);
  ok(done && tails === 0 && s.small === s.split && s.split > 0, `save data: no tail fetched (${tails}), every texture stays small (${s.small} of ${s.split}); the layers still come`);
  ok(Object.values(s.layers).every((l) => !l.failed.length) && !s.hold, 'save data: the sky and orrery layers all arrive');
  ok(!errors.length, `save data: no page error ${errors.join(' | ')}`);
  await ctx.close();
}

{
  let cdp;
  const { ctx, p, errors } = await open('', async (pg, c) => {
    cdp = await c.newCDPSession(pg);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: 10 * 125000, uploadThroughput: 10 * 125000 / 4 });
  });
  const lobbyTex = /\/assets\/lobby\/tex\//;
  let left = 0, aborted = 0, finishedAfter = 0, startedAfter = 0;
  p.on('request', (r) => { if (/\/assets\/about\/scene\.json/.test(r.url()) && !left) left = Date.now(); if (left && lobbyTex.test(r.url())) startedAfter++; });
  p.on('requestfailed', (r) => { if (lobbyTex.test(r.url())) aborted++; });
  p.on('requestfinished', (r) => { if (left && lobbyTex.test(r.url())) finishedAfter++; });
  const before = await state(p);
  ok(before.running > 0 || before.queued > 0, `leaving: lobby layers still streaming (${before.running} under way, ${before.queued} queued)`);
  await p.evaluate(() => window.__lobby.enter('about'));
  for (let i = 0; i < 100 && !left; i++) await p.waitForTimeout(100);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await p.waitForFunction(() => window.__lobby.mode().room === 'about' && window.__lobby.ready() > 0, null, { polling: 100, timeout: 180000 });
  ok(skyIn(await state(p)), 'leaving: as its cover lifts, the next room samples only sky layers that are in');
  await p.waitForTimeout(1000);
  ok(left > 0, 'leaving: the next room started loading');
  ok(aborted >= 1, `leaving: the lobby downloads under way were aborted (${aborted})`);
  ok(finishedAfter === 0 && startedAfter === 0, `leaving: no lobby layer started or finished after (${startedAfter} started, ${finishedAfter} finished)`);
  ok(!errors.length, `leaving: no page error ${errors.join(' | ')}`);
  await ctx.close();
}

await b.close();
console.log(failed ? `layers: ${failed} FAIL` : 'layers: all ok');
process.exit(failed ? 1 : 0);