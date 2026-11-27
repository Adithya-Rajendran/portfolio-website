// WebKit probe of the render options
import { webkit } from 'playwright';
const base = process.argv[2];
for (const q of ['?msaa=0', '?msaa=0&grade=0', '?msaa=0&nobloom=1', '?msaa=0&nobloom=1&grade=0']) {
  const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('console', (m) => { if (m.type() !== 'log') console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await p.goto(base + q); await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 150000 }).catch(() => console.log('not ready'));
  await p.waitForTimeout(2000);
  console.log(q || '(default)', JSON.stringify(await p.evaluate(() => { const L = window.__lobby; if (!L) return null; const gl = L.renderer.getContext();
    return { mode: L.mode(), err: gl.getError(), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), renderer: gl.getParameter(gl.RENDERER), calls: L.renderer.info.render.calls, tex: L.renderer.info.memory.textures }; })));
  await p.screenshot({ path: `/out/webkit_${q.replace(/\W/g, '') || 'default'}.png`, timeout: 120000 });
  await b.close();
}
