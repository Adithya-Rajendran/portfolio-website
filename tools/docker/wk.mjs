// WebKit load check that counts lost WebGL contexts
import { webkit } from 'playwright';
const [url, w = 1280, h = 720] = process.argv.slice(2);
const b = await webkit.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log(`[${m.type()}]`, m.text().slice(0, 300)));
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.addInitScript(() => { window.__lost = 0; addEventListener('webglcontextlost', () => window.__lost++, true); });
await p.goto(url);
await p.waitForFunction(() => window.__lobby?.ready() >= 1, null, { timeout: 300000 });
await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(() => { const L = window.__lobby, gl = L.renderer.getContext();
  const errs = []; for (let i = 0; i < 6; i++) { const e = gl.getError(); if (!e) break; errs.push(e); }
  return { lost: window.__lost, isLost: gl.isContextLost(), errs, mem: L.renderer.info.memory, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), frame: L.renderer.info.render.frame, mode: L.mode() }; })));
console.log(JSON.stringify(await p.evaluate(async () => {
  const THREE = await import('three'); const L = window.__lobby, r = L.renderer, out = [];
  const S = +(new URLSearchParams(location.search).get('rt') || 4);
  const rt = new THREE.WebGLRenderTarget(S, S), cam = new THREE.Camera(), px = new Uint8Array(64);
  L.scene.traverse((o) => { const m = o.material?.uniforms?.map?.value; if (!o.isMesh || !m || out.length > 4) return;
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: m }));
    r.setRenderTarget(rt); r.render(q, cam); r.readRenderTargetPixels(rt, S >> 1, S >> 1, 4, 4, px); r.setRenderTarget(null);
    out.push([o.name, m.image?.width, m.image?.constructor?.name, m.version, Array.from(px.slice(0, 8)).join(',')]); });
  return out; })));
console.log(JSON.stringify(await p.evaluate(() => { const L = window.__lobby, r = L.renderer, t = L.post.scene, out = [], px = new Float32Array(4);
  for (const [fx, fy] of [[0.12, 0.5], [0.3, 0.3], [0.5, 0.9], [0.8, 0.55], [0.5, 0.45]]) { r.readRenderTargetPixels(t, Math.floor(t.width * fx), Math.floor(t.height * fy), 1, 1, px); out.push(Array.from(px).map((v) => +v.toFixed(4)).join(',')); }
  r.setRenderTarget(null);
  const u = {}; L.scene.traverse((o) => { if (o.name === 'archR') u.archR = { gain: o.material.uniforms.uGain.value, chand: o.material.uniforms.uChand.value.toArray(), frag: o.material.fragmentShader.length, tt: t.texture.type, tf: t.texture.format }; });
  return { scene: out, u }; })));
await b.close();
