// GPU flag variants check for Chromium
import { chromium } from 'playwright';
const variants = {
  egl: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'],
  vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan', '--enable-gpu', '--ignore-gpu-blocklist'],
  gl: ['--use-gl=angle', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist'],
};
for (const [name, args] of Object.entries(variants)) {
  for (const channel of ['chromium']) {
    try {
      const b = await chromium.launch({ channel, args, headless: true });
      const p = await b.newPage();
      const r = await p.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (!gl) return 'no webgl2';
        const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
      console.log(name, channel, '->', r); await b.close();
    } catch (e) { console.log(name, channel, 'ERR', e.message.split('\n')[0]); }
  }
}
