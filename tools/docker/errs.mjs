import { chromium } from 'playwright';
const origin = process.env.ORIGIN || 'http://127.0.0.1:8080';
const url = new URL(process.argv[2] || '/', origin), rooms = (await (await fetch(new URL('/content.json', url))).json()).rooms;
// the room a URL names: by its path (content.json "path"), or the older ?room=
const first = `/${url.pathname.split('/')[1]}/`.replace('//', '/'), room = (first !== '/' && Object.keys(rooms).find((id) => rooms[id].path === first)) || url.searchParams.get('room') || 'lobby';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const error = (...message) => { process.exitCode = 1; console.log(...message); };
  p.on('console', m => { if (m.type() === 'error') error('[console]', m.text()); });
  p.on('pageerror', e => error('[pageerror]', e.message));
  p.on('requestfailed', r => error('[failed]', r.url(), r.failure()?.errorText));
  p.on('response', r => { if (r.status() >= 400) error('[http]', r.status(), r.url()); });
  await p.goto(url.href);
  await p.waitForFunction(id => document.querySelector('#loader')?.dataset.failed ||
    (window.__lobby?.mode().room === id && document.querySelector('#loader.done')), room, { timeout: 120000 });
  await p.waitForTimeout(750);
  const state = await p.evaluate(() => document.querySelector('#loader').dataset.failed ?
    document.querySelector('#what').textContent : window.__lobby.mode());
  if (state?.room !== room) error('Room failed to open:', state);
  else console.log('state', JSON.stringify(state));
} finally { await b.close(); }
