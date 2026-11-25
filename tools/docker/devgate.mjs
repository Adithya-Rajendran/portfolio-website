// The switches in dev.js: ignored on a public host name (a stand-in, www.example.com, mapped to the local server), honoured
// on 127.0.0.1. And the room query names nothing on either: the Atrium opens and the address stays.
import { chromium } from 'playwright';
const origin = new URL(process.env.ORIGIN || 'http://127.0.0.1:8080'), port = origin.port || '80';
const PUBLIC_HOST = 'www.example.com';
const QUERY = '?bloom=0&tier=1&shot=hero&scale=1&skip=bloom&debug=1';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', `--host-resolver-rules=MAP ${PUBLIC_HOST} 127.0.0.1`] });
let bad = false;
const look = async (host, path, query) => {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`http://${host}:${port}${path}${query}`);
  await p.waitForFunction(() => document.querySelector('#loader')?.dataset.failed || (window.__lobby?.mode().room && document.querySelector('#loader.done')), null, { timeout: 120000 });
  const r = await p.evaluate(() => ({ host: location.hostname, search: location.search, room: window.__lobby.mode().room, uBloom: window.__lobby.post.mFinal.uniforms.uBloom.value, fxaa: !!window.__lobby.post.fxaa, msaa: window.__lobby.post.msaa }));
  await p.close(); return r;
};
const check = (name, ok, got) => { if (!ok) bad = true; console.log(ok ? 'ok  ' : 'FAIL', name, JSON.stringify(got)); };
try {
  const prod = await look(PUBLIC_HOST, '/about/', QUERY), local = await look('127.0.0.1', '/about/', QUERY);
  check('public host: the path opens its room', prod.room === 'about', prod);
  check('public host: ?bloom=0 ignored (authored 0.0375)', prod.uBloom === 0.0375, prod);
  check('public host: ?tier=1 ignored (MSAA tier 0 kept)', prod.fxaa === false && prod.msaa === 4, prod);
  check('localhost: the path opens its room', local.room === 'about', local);
  check('localhost: ?bloom=0 honoured', local.uBloom === 0, local);
  check('localhost: ?tier=1 honoured', local.fxaa === true && local.msaa === 0, local);
  const gone = `?${new URLSearchParams([['room', 'about'], ['shot', 'hero'], ['scale', '1']])}`;
  for (const host of [PUBLIC_HOST, '127.0.0.1']) {
    const r = await look(host, '/', gone);
    check(`${host}: the room query opens the Atrium and the address stays`, r.room === 'lobby' && r.search === gone, r);
  }
} finally { await b.close(); }
process.exitCode = bad ? 1 : 0;
