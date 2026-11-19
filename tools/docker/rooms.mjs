// Room switching without a page load: nav link, Back button, a door, and a leak check over repeated visits.
import { chromium } from 'playwright';
const base = 'http://10.0.0.117:8080/';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
const state = () => p.evaluate(() => { globalThis.gc?.(); const L = window.__lobby; return { room: L.mode().room, url: location.search, same: window.__marker === 1,
  geo: L.renderer.info.memory.geometries, tex: L.renderer.info.memory.textures, programs: L.renderer.info.programs.length, heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), title: document.title, h1: document.querySelector('h1').textContent }; });
const arrive = async (id) => { await p.waitForFunction((r) => window.__lobby?.mode().room === r && window.__lobby.ready() >= 1, id, { timeout: 120000 }); await p.waitForTimeout(1500); };
await p.goto(base + '?shot=hero&scale=1'); await arrive('lobby'); await p.evaluate(() => { window.__marker = 1; });
console.log('start        ', JSON.stringify(await state()));
await p.click('nav a[data-room="projects"]'); await arrive('projects'); console.log('nav link     ', JSON.stringify(await state()));
await p.goBack(); await arrive('lobby'); console.log('back button  ', JSON.stringify(await state()));
await p.goForward(); await arrive('projects'); console.log('forward      ', JSON.stringify(await state()));
// through doors: the Atrium's Lounge door, then the Lounge's door back (the camera follows the pointer, so home in on each first)
async function throughDoor(label, to) {
  let x, y; const i = await p.evaluate((l) => window.__lobby.picks.findIndex((q) => q.door?.label === l), label);
  for (let n = 0; n < 4; n++) {
    [x, y] = await p.evaluate((k) => { const L = window.__lobby, v = L.picks[k].mesh.position.clone().project(L.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, i);
    await p.mouse.move(x, y); await p.waitForTimeout(1200);
  }
  await p.mouse.click(x, y); await p.waitForTimeout(1300);
  console.log(`  at the ${label} door:`, await p.evaluate(() => document.getElementById('enter').textContent));
  await arrive(to); console.log(`door ${label.padEnd(8)}`, JSON.stringify(await state()));
}
await p.evaluate(() => window.__lobby.enter('lobby')); await arrive('lobby');
await throughDoor('LOUNGE', 'about'); await throughDoor('ATRIUM', 'lobby');
for (let round = 1; round <= 3; round++) for (const id of ['about', 'experience', 'projects', 'lobby']) {
  await p.evaluate((r) => window.__lobby.enter(r), id); await arrive(id);
  const s = await state(); console.log(`round ${round} ${id.padEnd(10)}`, JSON.stringify({ geo: s.geo, tex: s.tex, programs: s.programs, heapMB: s.heapMB, same: s.same }));
}
await p.screenshot({ path: '/out/rooms_end.png' });
await b.close();
