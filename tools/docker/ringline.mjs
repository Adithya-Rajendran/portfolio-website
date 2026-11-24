// The Atrium's doors: the Ring Line stair offers stops (pick one), the Lounge door leads straight through.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => console.log('[pageerror]', e.message));
const arrive = async (id) => { await p.waitForFunction((r) => window.__lobby?.mode().room === r && window.__lobby.ready() >= 1, id, { timeout: 120000 }); await p.waitForTimeout(1500); };
const clickDoor = async (label) => { let x, y; const i = await p.evaluate((l) => window.__lobby.picks.findIndex((q) => q.door?.label === l), label);
  for (let n = 0; n < 4; n++) { [x, y] = await p.evaluate((k) => { const L = window.__lobby, v = L.picks[k].mesh.position.clone().project(L.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, i); await p.mouse.move(x, y); await p.waitForTimeout(1200); }
  await p.mouse.click(x, y); await p.waitForTimeout(2600); };
const origin = (process.argv[2] || process.env.ORIGIN || 'http://127.0.0.1:8080').replace(/\/$/, '');
await p.goto(`${origin}/?shot=hero`); await arrive('lobby');
console.log('picks:', await p.evaluate(() => window.__lobby.picks.map((q) => q.door?.label || 'hologram').join(', ')));
await clickDoor('RING LINE');
console.log('ring line buttons:', await p.evaluate(() => [...document.querySelectorAll('#ways button')].map((e) => e.textContent.trim() + (e.disabled ? ' [off]' : '')).join(' | ')), '| still in', await p.evaluate(() => window.__lobby.mode().room));
await p.screenshot({ path: '/out/ring_stops.png' });
await p.click('#ways button[data-to="experience"]'); await arrive('experience'); console.log('stop NAVIGATION ->', await p.evaluate(() => window.__lobby.mode().room), p.url());
await p.evaluate(() => window.__lobby.enter('lobby')); await arrive('lobby');
await clickDoor('LOUNGE'); await arrive('about'); console.log('door LOUNGE ->', await p.evaluate(() => window.__lobby.mode().room), p.url());
await b.close();
