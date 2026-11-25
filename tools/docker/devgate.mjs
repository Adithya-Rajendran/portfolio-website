// The switches in dev.js: ignored on a public host name (here the production one, mapped to the local server), honoured on 127.0.0.1.
import { chromium } from 'playwright';
const origin = new URL(process.env.ORIGIN || 'http://127.0.0.1:8080'), port = origin.port || '80';
const QUERY = '?room=about&bloom=0&tier=1&shot=hero&scale=1&skip=bloom&debug=1';
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist', '--host-resolver-rules=MAP adithya-rajendran.com 127.0.0.1'] });
let bad = false;
const look = async (host) => {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  await p.goto(`http://${host}:${port}/${QUERY}`);
  await p.waitForFunction(() => document.querySelector('#loader')?.dataset.failed || (window.__lobby?.mode().room && document.querySelector('#loader.done')), null, { timeout: 120000 });
  const r = await p.evaluate(() => ({ host: location.hostname, room: window.__lobby.mode().room, uBloom: window.__lobby.post.mFinal.uniforms.uBloom.value, fxaa: !!window.__lobby.post.fxaa, msaa: window.__lobby.post.msaa }));
  await p.close(); return r;
};
const check = (name, ok, got) => { if (!ok) bad = true; console.log(ok ? 'ok  ' : 'FAIL', name, JSON.stringify(got)); };
try {
  const prod = await look('adithya-rajendran.com'), local = await look('127.0.0.1');
  check('production host: ?room= still opens the room', prod.room === 'about', prod);
  check('production host: ?bloom=0 ignored (authored 0.0375)', prod.uBloom === 0.0375, prod);
  check('production host: ?tier=1 ignored (MSAA tier 0 kept)', prod.fxaa === false && prod.msaa === 4, prod);
  check('localhost: ?room= opens the room', local.room === 'about', local);
  check('localhost: ?bloom=0 honoured', local.uBloom === 0, local);
  check('localhost: ?tier=1 honoured', local.fxaa === true && local.msaa === 0, local);
} finally { await b.close(); }
process.exitCode = bad ? 1 : 0;
