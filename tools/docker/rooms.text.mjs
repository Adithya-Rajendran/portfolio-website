// Check of the words of the page and of the wall screens that are not picks, on desktop and phone
import { PROFILES, ORIGIN, load, suite, launch, context, open, until, inRoom } from './rooms.kit.mjs';
import { sleep, camStill, dstate } from './r2.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('rooms.text'), { chk, note } = S;
const { profile, content } = await load(), R = content.rooms, norm = (s) => s.replace(/\s+/g, ' ').trim();
const b = await launch();

const goRoom = async (p, id) => { await p.evaluate((id) => window.__lobby.enter(id), id); return until(p, (id) => window.__lobby.mode().room === id && window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0 && document.querySelector('#loader.done'), id, 240000); };
const hero = (p) => p.evaluate(() => { const s = document.querySelector('.sub'), shown = (e) => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  return { sub: s.textContent, hidden: s.hidden, takes: shown(s) && s.getBoundingClientRect().height > 0, kids: [...document.querySelector('.hero').children].filter(shown).map((e) => e.className || e.tagName.toLowerCase()), live: s.querySelectorAll('[data-live]').length }; });

const wallPoints = (p) => p.evaluate(async () => {
  const THREE = window.__modules.THREE, l = window.__lobby, ray = new THREE.Raycaster(), out = [], meshes = []; l.camera.updateMatrixWorld(true);
  l.scene.traverse((o) => { if (o.isMesh && o.userData.screen !== undefined) meshes.push(o); });
  const all = []; l.scene.traverse((o) => { if (o.isMesh) all.push(o); });
  for (const m of meshes) {
    m.updateWorldMatrix(true, false); if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const { min, max } = m.geometry.boundingBox; let best = null;
    for (const u of [0.5, 0.3, 0.7, 0.15, 0.85]) for (const v of [0.5, 0.3, 0.7, 0.15, 0.85]) {
      const pt = new THREE.Vector3(min.x + (max.x - min.x) * u, min.y + (max.y - min.y) * v, (min.z + max.z) / 2).applyMatrix4(m.matrixWorld), s = pt.clone().project(l.camera), x = (s.x * 0.5 + 0.5) * innerWidth, y = (-s.y * 0.5 + 0.5) * innerHeight;
      if (s.z > 1 || x < 12 || x > innerWidth - 12 || y < 12 || y > innerHeight - 12 || document.elementFromPoint(x, y)?.id !== 'scene') continue;
      ray.setFromCamera(new THREE.Vector2(s.x, s.y), l.camera); const hit = ray.intersectObjects(all, false)[0]; if (hit?.object !== m) continue;
      if (ray.intersectObjects(l.picks.filter((q) => !q.live || q.live()).map((q) => q.mesh), false).length) continue;
      const d = Math.hypot(u - 0.5, v - 0.5); if (!best || d < best.d) best = { x, y, d };
    }
    out.push({ screen: m.userData.screen, name: m.name, at: best });
  }
  return out;
});

async function run(name) {
  S.profile(name); const P = PROFILES[name], phone = P.phone, errs = [];
  console.log(`\n=== ${name} ${P.viewport.width}x${P.viewport.height}`);
  const ctx = await context(b, P), p = await open(ctx, '/', 'lobby', errs); await until(p, () => window.__lobby.ready() >= 1 && window.__lobby.picks.length > 0, null, 60000);
  const expect = { lobby: norm(`${profile.name}  ·  ${profile.headline}`), about: norm(`${profile.headline}  ·  ${profile.location}`) };
  chk('T', ['projects', 'experience'].every((k) => R[k].screens.inspect === false) && ['projects', 'experience'].every((k) => R[k].screens.list.every((c) => !('cta' in c))), "content.json: screens.inspect is false in Fabrication and Navigation, and their cards have no `cta` line");
  chk('T', Object.entries(R).every(([k, r]) => Array.isArray(r.sub) && (k === 'lobby' || k === 'about' ? r.sub.length === 1 : r.sub.length === 0)), 'content.json: each room\'s `sub` is [] but the Atrium\'s and the Lounge\'s (one line each)', Object.fromEntries(Object.entries(R).map(([k, r]) => [k, r.sub])));
  for (const id of ['lobby', 'about', 'projects', 'experience', 'writing', 'comms']) {
    if (id !== 'lobby' && !(await goRoom(p, id))) { chk('T', false, `${id} opens`); continue; }
    await p.waitForTimeout(600); const h = await hero(p);
    if (expect[id]) { chk('T', !h.hidden && h.takes && norm(h.sub) === expect[id] && h.live === 0, `${id}: the line under the headline is "${expect[id]}", from the profile`, h); }
    else chk('T', h.hidden && !h.takes && h.sub === '', `${id}: nothing under the headline (.sub is hidden, empty and takes no room)`, h);
    chk('T', h.kids.every((k) => /^(kicker|headline|sub|cta)$/.test(k)), `${id}: the hero holds only the kicker, the headline${expect[id] ? ', the line' : ''} and the room's button`, h.kids);
    if (id === 'projects' || id === 'experience') {
      await camStill(p); const walls = await wallPoints(p), reach = walls.filter((w) => w.at);
      chk('W', walls.length >= 2, `${id}: the room has wall screens (${walls.length})`);
      chk('W', await p.evaluate(() => window.__lobby.picks.every((q) => q.mesh.userData?.screen === undefined)), `${id}: no pick is a wall screen`);
      if (!reach.length) note(`${id}: no wall screen can be pointed at from the room's own view`);
      for (const w0 of reach.slice(0, phone ? 2 : 4)) {
        let w = w0;
        if (!phone) {
          for (let i = 0, last = null; i < 10; i++) {
            const now = (await wallPoints(p)).find((q) => q.screen === w0.screen)?.at; if (!now) break; w = { ...w0, at: now };
            if (last && Math.hypot(now.x - last.x, now.y - last.y) < 3) break; await p.mouse.move(now.x, now.y, { steps: 4 }); await sleep(900); last = now;
          }
        }
        const eye0 = await p.evaluate(() => window.__lobby.camera.position.toArray());
        if (!phone) { await sleep(600); const s = await dstate(p), cur = await p.evaluate(() => document.querySelector('#scene').style.cursor); chk('W', !s.lock && cur !== 'pointer', `${id}: the pointer resting on wall screen ${w.screen} brings no lock and no pointer cursor`, { lock: s.lock, cursor: cur, at: [Math.round(w.at.x), Math.round(w.at.y)] }); }
        if (phone) await p.touchscreen.tap(w.at.x, w.at.y); else { await p.mouse.down(); await p.mouse.up(); }
        await sleep(2000);
        const s = await p.evaluate(() => ({ named: window.__lobby.display.state().named, count: document.querySelector('#count').textContent, bar: !document.querySelector('#inspectbar').hidden, gliding: window.__lobby.display.state().gliding, eye: window.__lobby.camera.position.toArray(), reader: window.__lobby.reader.state() }));
        chk('W', s.named === '' && s.count === '' && !s.bar && !s.gliding && s.reader === 'closed' && Math.hypot(s.eye[0] - eye0[0], s.eye[1] - eye0[1], s.eye[2] - eye0[2]) < 0.6, `${id}: a ${phone ? 'tap' : 'click'} on wall screen ${w.screen} (${Math.round(w.at.x)}, ${Math.round(w.at.y)}) does nothing: nothing in focus, no bar, nothing read, the camera has not come`, s);
      }
    }
  }
  chk('T', errs.length === 0, 'no pageerror, console error or failed request', [...new Set(errs)].slice(0, 5));
  await ctx.close();

  if (!phone) {
    for (const [what, stub] of [['no profile', (r) => r.fulfill({ status: 404, body: 'not found' })], ['a profile with no location', async (r) => { const res = await r.fetch(), j = await res.json(); delete j.location; await r.fulfill({ response: res, json: j }); }]]) {
      const c2 = await context(b, P); await c2.route('**/profile.json', stub); const e2 = [], q = await open(c2, '/about/', 'about', e2, { pin: true });
      const h = await hero(q);
      if (what === 'no profile') chk('T', h.hidden && !h.takes && h.sub === '', 'with no profile the Lounge says nothing under its headline', h);
      else chk('T', !/undefined/.test(h.sub) && (h.hidden || !/·\s*$/.test(norm(h.sub))), 'a line whose place has no value ({location}) is dropped, never printed as "undefined" or left with a dangling "·"', h);
      if (what === 'no profile') { await goRoom(q, 'lobby'); const a = await hero(q); chk('T', a.hidden && !a.takes && a.sub === '', 'and the Atrium too', a); }
      await c2.close();
    }
  }
}
try { for (const n of which === 'all' ? ['desktop', 'phone'] : [which]) await run(n); } finally { await b.close(); }
S.finish();
