// Live reflections on an ordinary baked surface (an Atrium planter's lacquered face), through the real render path.
// 1. Same world points from two eyes: how much of their light is reflection, and how much that changes with the eye.
// 2. A temporary red sphere lamp: its highlight must land where mirror geometry puts it, for each eye.
// node reflect-check.mjs URL [out-dir]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const [base, out] = process.argv.slice(2), errors = [];
const b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1024, height: 640 } });
  p.on('pageerror', (e) => errors.push(e.message)); p.on('requestfailed', (r) => errors.push(r.url()));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const u = new URL(base); u.search = 'room=lobby&lightcheck=1&shot=hero&tier=1&scale=1&rollat=0&chand=0&grain=0&bloom=0&vig=0&skip=dust';
  await p.goto(u.href); await p.waitForFunction(() => window.__lobby?.mode().room === 'lobby' && document.querySelector('#loader.done'), null, { timeout: 180000 });
  const r = await p.evaluate(async (wantImages) => {
    const T = await import('three'), l = window.__lobby, gl = l.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    // the planter in the right-hand bay at Blender y = 5: its face toward the hall is the plane x = 6.75
    const X = 6.75, target = [X, 0.7, -5.0], eyes = [[4.1, 1.0, -2.2], [4.0, 1.0, -7.9]];   // the face spans y .45-.95
    let gain, lamp; l.scene.traverse((o) => { const v = o.material?.uniforms; if (v?.tFin) { gain ??= v.uSpecGain; lamp ??= v.uLP && v; } });
    if (!gain) throw new Error('No live-reflection material in this room');
    const read = (eye) => { l.lightFrame(eye, target, 0); const a = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
    const px = (a, v) => { const q = new T.Vector3(...v).project(l.camera); if (Math.abs(q.x) > .98 || Math.abs(q.y) > .98) return null;
      const i = 4 * (Math.floor((q.y + 1) * H / 2) * W + Math.floor((q.x + 1) * W / 2)); return [a[i], a[i + 1], a[i + 2]]; };
    const pts = []; for (let iy = 0; iy < 7; iy++) for (let iz = 0; iz < 15; iz++) pts.push([X - 0.003, 0.53 + iy * 0.055, -6.15 + iz * 0.165]);
    const images = {}, views = eyes.map((eye, k) => {
      gain.value = 1; const on = read(eye); if (wantImages) images[`planter-eye${k}`] = l.renderer.domElement.toDataURL();
      const onPts = pts.map((v) => px(on, v)); gain.value = 0; const off = read(eye); const offPts = pts.map((v) => px(off, v)); gain.value = 1;
      return { onPts, offPts };
    });
    const both = pts.map((_, i) => views.every((v) => v.onPts[i] && v.offPts[i]) ? i : -1).filter((i) => i >= 0);
    const mag = (x) => Math.max(...x.map(Math.abs)), mean = (f) => both.reduce((s, i) => s + f(i), 0) / both.length;
    const spec = (k, i) => views[k].onPts[i].map((c, j) => c - views[k].offPts[i][j]);
    const result = { worldPoints: both.length, meanReflectionA: +mean((i) => mag(spec(0, i))).toFixed(2), meanReflectionB: +mean((i) => mag(spec(1, i))).toFixed(2),
      meanReflectionChange: +mean((i) => mag(spec(0, i).map((c, j) => c - spec(1, i)[j]))).toFixed(2) };
    // test lamp in front of the face: its mirror image is (2X - x, y, z); the highlight is where the eye sees that image
    if (lamp) {
      const save = ['uLP', 'uLI', 'uLS'].map((k) => lamp[k].value[0].clone()), pos = [5.2, 0.8, -5.0];
      result.lamp = eyes.map((eye) => {
        const shot = (on) => { lamp.uLP.value[0].set(...pos); lamp.uLI.value[0].set(on ? +(new URLSearchParams(location.search).get("qalamp") || .6) : 0, 0, 0); lamp.uLS.value[0].set(.015, -2, 0); return read(eye); };
        const lit = shot(true), dark = shot(false), e = new T.Vector3(...eye);
        if (wantImages) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = 4 * (y * W + x), o = 4 * ((H - 1 - y) * W + x), d = Math.min(255, 4 * Math.max(0, lit[i] - dark[i])); im.data[o] = d; im.data[o + 1] = dark[i + 1] >> 2; im.data[o + 2] = dark[i + 2] >> 2; im.data[o + 3] = 255; }
          g.putImageData(im, 0, 0); images[`lamp-${Object.keys(images).filter((k) => k.startsWith('lamp')).length + 1}`] = c.toDataURL(); }
        const img = new T.Vector3(2 * X - pos[0], pos[1], pos[2]);
        const hit = e.clone().lerp(img, (X - e.x) / (img.x - e.x)), q = hit.clone().project(l.camera), cx = (q.x + 1) * W / 2, cy = (q.y + 1) * H / 2;
        // Only pixels ON this face count (the lamp also glints on the platform and floor): a pixel is on the face if the
        // surface it shows is where its view ray meets the plane x = X, within the planter's bounds.
        const rt = new T.WebGLRenderTarget(W, H, { type: T.FloatType }), dist = new Float32Array(W * H * 4), R = l.renderer;
        const dm = new T.ShaderMaterial({ side: T.DoubleSide, vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
          fragmentShader: 'varying vec3 vW; void main(){ gl_FragColor = vec4(distance(vW, cameraPosition), 0., 0., 1.); }' });
        l.scene.overrideMaterial = dm; R.setRenderTarget(rt); R.render(l.scene, l.camera); R.readRenderTargetPixels(rt, 0, 0, W, H, dist); R.setRenderTarget(null); l.scene.overrideMaterial = null; rt.dispose(); dm.dispose();
        const ray = new T.Raycaster(); let w = 0, sx = 0, sy = 0, peak = 0, px = 0, py = 0, face = 0;
        for (let y = Math.max(0, Math.floor(cy) - 150); y < Math.min(H, cy + 150); y++) for (let x = Math.max(0, Math.floor(cx) - 150); x < Math.min(W, cx + 150); x++) {
          ray.setFromCamera(new T.Vector2(2 * (x + .5) / W - 1, 2 * (y + .5) / H - 1), l.camera); const r = ray.ray, t = (X - r.origin.x) / r.direction.x;
          if (!(t > 0)) continue; const p = r.at(t, new T.Vector3());
          if (p.y < .47 || p.y > .93 || p.z < -6.38 || p.z > -3.62 || Math.abs(dist[4 * (y * W + x)] - t) > .02) continue;
          face++; const i = 4 * (y * W + x), d = Math.max(0, lit[i] - dark[i] - 4);
          if (d > peak) { peak = d; px = x + .5; py = y + .5; } w += d; sx += d * (x + .5); sy += d * (y + .5); }
        ray.setFromCamera(new T.Vector2(2 * px / W - 1, 2 * py / H - 1), l.camera); const pk = ray.ray.at((X - ray.ray.origin.x) / ray.ray.direction.x, new T.Vector3());
        return { peakWorld: pk.toArray().map((v) => +v.toFixed(3)), predictedWorld: hit.toArray().map((v) => +v.toFixed(3)), facePixels: face, signal: w, errorPx: w ? +Math.hypot(sx / w - cx, sy / w - cy).toFixed(2) : null, peakErrorPx: +Math.hypot(px - cx, py - cy).toFixed(2), predicted: [+cx.toFixed(1), +cy.toFixed(1)] };
      });
      ['uLP', 'uLI', 'uLS'].forEach((k, j) => lamp[k].value[0].copy(save[j]));
    }
    return { ...result, images };
  }, !!out);
  if (out) { await mkdir(out, { recursive: true }); for (const [k, v] of Object.entries(r.images)) await writeFile(`${out}/${k}.png`, Buffer.from(v.split(',')[1], 'base64')); }
  delete r.images; console.log(JSON.stringify(r));
  assert(r.worldPoints > 40 && r.meanReflectionA > 1 && r.meanReflectionB > 1, 'No visible live reflection on the planter');
  assert(r.meanReflectionChange > 1, 'The planter reflection did not change with the eye');
  for (const q of r.lamp || []) assert(q.signal > 200 && q.errorPx !== null && q.errorPx < 4 && q.peakErrorPx < 4, `Lamp highlight misplaced: ${JSON.stringify(q)}`);
  assert.deepEqual(errors, []);
} finally { await b.close(); }
