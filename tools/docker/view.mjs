// Runs inside mcr.microsoft.com/playwright: loads the page in each browser engine, logs errors, takes a screenshot.
import { chromium, firefox, webkit } from 'playwright';
const url = process.argv[2], engines = { chromium, firefox, webkit };
for (const name of (process.argv[3] || 'chromium,firefox,webkit').split(',')) {
  console.log('=====', name);
  try {
    const b = await engines[name].launch(name === 'chromium' ? { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
    const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    p.on('console', (m) => { if (m.type() !== 'log') console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
    p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 600)));
    p.on('requestfailed', (r) => console.log('[failed]', r.url(), r.failure()?.errorText));
    p.on('response', (r) => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
    await p.goto(url, { waitUntil: 'load', timeout: 60000 });
    const t0 = Date.now();
    let state = 'timeout';
    while (Date.now() - t0 < 150000) {
      const s = await p.evaluate(() => ({ lobby: !!window.__lobby, intro: window.__lobby ? window.__lobby.ready() : -1, mode: window.__lobby?.mode(), label: document.querySelector('#loader .label').textContent,
        pct: document.getElementById('pct').textContent, loaderDone: document.getElementById('loader').classList.contains('done') }));
      if (s.intro >= 1) { state = 'running ' + JSON.stringify(s); break; }
      state = 'stuck ' + JSON.stringify(s);
      await p.waitForTimeout(3000);
    }
    console.log('state:', state);
    await p.screenshot({ path: `/out/${name}.png`, timeout: 120000 }).catch((e) => console.log('screenshot failed', e.message.split('\n')[0]));
    await b.close();
  } catch (e) { console.log('ERROR', e.message.split('\n')[0]); }
}
