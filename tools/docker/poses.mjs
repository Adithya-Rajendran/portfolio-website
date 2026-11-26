// Photograph exact camera poses through the site's real render path (?lightcheck: room.update, sun prepass, live
// reflection capture, mirror, post). node poses.mjs URL out-dir room 'name:ex,ey,ez:tx,ty,tz' ... [--q=extra&params]
// Coordinates are three.js world metres (Blender x, z, -y). Fails on any page error or failed request.
import { chromium } from 'playwright';
import { ROOM_PATH } from './roompath.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { streamAbort } from './reqfail.mjs';
const args = process.argv.slice(2), extra = (args.find((a) => a.startsWith('--q=')) || '--q=').slice(4);
const [base, out, room, ...specs] = args.filter((a) => !a.startsWith('--'));
await mkdir(out, { recursive: true });
const errors = [], b = await chromium.launch({ args: ['--use-angle=gl-egl', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => errors.push(e.message)); p.on('requestfailed', (r) => streamAbort(r) || errors.push(r.url()));
  p.on('console', (m) => { if (m.type() === 'error' || /shader|program/i.test(m.text())) errors.push(m.text()); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  const u = new URL(base), q = new URLSearchParams(`lightcheck=1&shot=hero&tier=0&scale=1&rollat=0&chand=0&grain=0`);
  u.pathname = ROOM_PATH[room];
  for (const [k, v] of new URLSearchParams(extra)) q.set(k, v);                // extras override the defaults
  u.search = `${q}`;
  await p.goto(u.href); await p.waitForFunction((r) => window.__lobby?.mode().room === r && document.querySelector('#loader.done'), room, { timeout: 180000 });
  for (const spec of specs) {
    const [name, eye, tgt, t = '0'] = spec.split(':');
    const png = await p.evaluate(([e, a, t]) => { const l = window.__lobby; l.lightFrame(e, a, t); l.lightFrame(e, a, t);
      return l.renderer.domElement.toDataURL('image/png').split(',')[1]; }, [eye.split(',').map(Number), tgt.split(',').map(Number), +t]);
    await writeFile(`${out}/${name}.png`, Buffer.from(png, 'base64')); console.log('captured', name);
  }
  assert.deepEqual(errors, []);
} finally { await b.close(); }
