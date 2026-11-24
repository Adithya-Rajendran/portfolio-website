// contact.mjs [desktop|phone|reduced|all]: Contact (js/comms.js, content.json rooms.comms) in each of the three things it can be, decided by data:
//   links  (what the site is: no address in profile.json, no endpoint in content.json): no message box, no SEND; the owner's name, intro, invitation, what is sought, a button per link
//   mail   (profile.contact.email set): a message box, one button that opens the visitor's own mail program with the message in it, the address, COPY, the links; no field for the visitor's address
//   send   (content.json rooms.comms.comms.endpoint set): a message box, the visitor's email (needed, "so I can reply"), SEND, a status; POSTs { at, email, from, message }
//   1 names and standby   2 what the open field says   3 nothing overlaps; every target inside the window and pressable (44 x 44 CSS px on a phone)   4 the links open their own addresses in a
//   new tab and the station stays   5 the keyboard: order, focus ring   6 mail   7 send   8 leaving   9 no error; nothing leaves the machine but the links pressed
//   L  legibility (desktop, links): the page's words over the bright room, and the field's words standing in it, against what is behind them, at three angles of the sky: at least 4.5:1
//      (the build measured 6 or better for the page's words, 8.75 or better for the field's; the owner's complaint was white words on a white background)
// Other origins are stubbed; the mail program is not opened (mailto clicks are caught); the endpoint is a stub on this origin. "ok" / "FAIL [profile item] what"; exit code 1 if any check failed.
import { PROFILES, ORIGIN, load, suite, launch, context, inRoom, until } from './rooms.kit.mjs';
import { sleep } from './r2.kit.mjs';
const which = process.argv.slice(2).find((a) => a !== '-v') || 'all', S = suite('contact'), { chk, note } = S;
const { profile, content } = await load(), C = content.rooms.comms.comms, ADDRESS = 'hello@example.org', ENDPOINT = '/api/message';
const b = await launch();

/** The canvas spy of rooms.kit.mjs, with each text's font, width, alignment and colour (to know where it lies and what it is). */
const cspy = () => {
  const P = CanvasRenderingContext2D.prototype, ft = P.fillText, fr = P.fillRect, cr = P.clearRect;
  const reset = (c, x, y, w, h) => { if (x === 0 && y === 0 && w >= c.canvas.width && h >= c.canvas.height) c.canvas.__t = []; };
  P.fillText = function (s, x, y, ...r) { (this.canvas.__t ??= []).push([String(s), x, y, this.font, this.measureText(String(s)).width, this.textAlign, String(this.fillStyle)]); return ft.call(this, s, x, y, ...r); };
  P.fillRect = function (x, y, w, h) { reset(this, x, y, w, h); return fr.call(this, x, y, w, h); };
  P.clearRect = function (x, y, w, h) { reset(this, x, y, w, h); return cr.call(this, x, y, w, h); };
  const gc = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (...a) { (window.__canvases ??= new Set()).add(this); return gc.apply(this, a); };
};
async function setMode(ctx, mode, posts, answer) {
  if (mode === 'mail') await ctx.route('**/profile.json', async (r) => { const res = await r.fetch(), j = await res.json(); j.contact.email = ADDRESS; await r.fulfill({ response: res, json: j }); });
  if (mode === 'send') {
    await ctx.route('**/content.json', async (r) => { const res = await r.fetch(), j = await res.json(); j.rooms.comms.comms.endpoint = ENDPOINT; await r.fulfill({ response: res, json: j }); });
    await ctx.route(`**${ENDPOINT}`, async (r) => { const q = r.request(); posts.push({ method: q.method(), type: q.headers()['content-type'], body: q.postData() }); await r.fulfill({ status: answer(posts.length), contentType: 'application/json', body: '{}' }); });
  }
}
const frames = (p, n = 3) => p.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function settled(p, tries = 200) {
  const eye = () => p.evaluate(() => [...window.__lobby.camera.position.toArray(), ...window.__lobby.camera.quaternion.toArray()]); let a = await eye();
  for (let i = 0, calm = 0; i < tries && calm < 4; i++) { await p.waitForTimeout(350); const c = await eye(); calm = Math.hypot(...a.map((v, k) => v - c[k])) < 2e-3 ? calm + 1 : 0; a = c; }
}
async function openPage(ctx, path, errs) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 300)}`); });
  p.on('requestfailed', (r) => errs.push(`request failed: ${r.url()} ${r.failure()?.errorText}`)); p.on('response', (r) => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  await p.goto(`${ORIGIN}${path}`); if (!(await inRoom(p, 'comms', 400000))) throw new Error('the room did not load');
  await p.waitForFunction(() => getComputedStyle(document.querySelector('#hud')).opacity === '1', null, { timeout: 120000, polling: 250 }); return p;
}
/** The field: its canvas' texts as rectangles on the screen. */
const fieldTexts = (p) => p.evaluate(async () => {
  const THREE = await import('three'), l = window.__lobby, pick = l.picks.find((q) => q.cta), hit = pick.mesh, panel = hit.parent.children.find((m) => m.material?.uniforms?.tMap), cv = panel.material.uniforms.tMap.value.image;
  l.camera.updateMatrixWorld(true); hit.updateWorldMatrix(true, false);
  const g = hit.geometry.parameters, at = (x, y) => { const v = new THREE.Vector3((x / cv.width - 0.5) * g.width, (0.5 - y / cv.height) * g.height, 0).applyMatrix4(hit.matrixWorld).project(l.camera); return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight]; };
  return (cv.__t ?? []).filter((t) => t[0].trim()).map(([s, x, y, font, w, align]) => { const size = parseFloat(font.match(/([\d.]+)px/)[1]), x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const a = at(x0, y - size * 0.74), c = at(x0 + w, y + size * 0.22); return { text: s.slice(0, 40), full: s, size, px: +(c[1] - a[1]).toFixed(1), rect: [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])] }; });
});
const wipeField = (p) => p.evaluate(() => { const l = window.__lobby, hit = l.picks.find((q) => q.cta).mesh, tex = hit.parent.children.find((m) => m.material?.uniforms?.tMap).material.uniforms.tMap.value, cv = tex.image;
  const c = cv.getContext('2d'), keep = cv.__t; c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.restore(); cv.__t = keep; tex.needsUpdate = true; });
const hudWords = (p) => p.evaluate(() => {
  const out = [];
  for (const hud of document.querySelectorAll('#hud, #inspectbar:not([hidden])')) { const walk = document.createTreeWalker(hud, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue; const el = n.parentElement, cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let alpha = 1; for (let e = el; e; e = e.parentElement) alpha *= +getComputedStyle(e).opacity;
      const r = document.createRange(); r.selectNodeContents(n); const col = cs.color.match(/[\d.]+/g).map(Number); if (col.length > 3) alpha *= col[3];
      for (const q of r.getClientRects()) if (q.width > 2 && q.height > 2) out.push({ text: n.textContent.trim().slice(0, 40), rect: [q.left, q.top, q.width, q.height], color: col.slice(0, 3), alpha });
    } }
  return out;
});
const hideWords = (p, on) => p.evaluate((on) => { let s = document.querySelector('#tmp-hide'); if (!s) { s = document.createElement('style'); s.id = 'tmp-hide'; document.head.append(s); }
  s.textContent = on === 'all' ? '#hud, #inspectbar, #lock { display: none !important; }' : on ? '#hud, #hud *, #inspectbar * { -webkit-text-fill-color: transparent !important; text-shadow: none !important; } #hud .ring, #hud .cta, #hud nav a, #hud nav .sep { border-color: transparent !important; box-shadow: none !important; background-color: transparent !important; }' : ''; }, on);
async function sky(p, deg, period = 120) { await p.evaluate(async ({ deg, period }) => { const { uTime } = await import('./js/kit.js'); uTime.value = deg / 360 * period + period * 5; }, { deg, period }); await frames(p, 4); }
/** A page that reads screenshots: WCAG contrast of words against what is behind them. 'dom': the words' own colour over every pixel behind them (B: the view without the words);
 *  'light': the words are light in the scene, found by what they changed between A (with) and B (without). Returns the 1st percentile of the ratios ("worst") of each. */
async function reader() {
  const p = await b.newPage(); await p.goto('about:blank');
  return (A64, B64, jobs) => p.evaluate(async ({ a, b, jobs }) => {
    const img = async (s) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()), cv = new OffscreenCanvas(bmp.width, bmp.height), c = cv.getContext('2d'); c.drawImage(bmp, 0, 0); return c.getImageData(0, 0, bmp.width, bmp.height); };
    const A = a ? await img(a) : null, B = await img(b), W = B.width, H = B.height;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, L = (r, g, bl) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    const at = (I, x, y) => { const i = (y * W + x) * 4; return [I.data[i], I.data[i + 1], I.data[i + 2]]; }, cr = (x, y) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    const pct = (arr, q) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
    return jobs.map((j) => {
      const [x, y, w, h] = j.rect, x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y)), x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h)); if (x1 <= x0 || y1 <= y0) return { ...j, off: true };
      if (j.kind === 'dom') { const ratios = []; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const [r, g, bl] = at(B, xx, yy), k = j.alpha; ratios.push(cr(L(k * j.color[0] + (1 - k) * r, k * j.color[1] + (1 - k) * g, k * j.color[2] + (1 - k) * bl), L(r, g, bl))); } return { ...j, worst: pct(ratios, 0.01) }; }
      const d = [], la = [], lb = []; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const aa = L(...at(A, xx, yy)), bb = L(...at(B, xx, yy)); la.push(aa); lb.push(bb); d.push(Math.abs(aa - bb)); }
      const top = pct(d, 0.999), core = la.filter((_, i) => d[i] >= top * 0.7); return { ...j, worst: cr(pct(core, 0.5), pct(lb, 0.99)), n: core.length };
    });
  }, { a: A64, b: B64, jobs });
}

async function behave(prof, mode) {
  const P = PROFILES[prof], phone = !!P.phone, W = P.viewport.width, H = P.viewport.height; S.profile(`${prof} ${mode}`); console.log(`\n=== ${prof} ${mode}`);
  const ctx = await context(b, P), errs = [], posts = [], external = [], requests = [], popups = []; let status = () => 200;
  await ctx.addInitScript(cspy); await setMode(ctx, mode, posts, (n) => status(n));
  await ctx.route((u) => u.origin !== new URL(ORIGIN).origin, (r) => { external.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>elsewhere</title>' }); });
  ctx.on('request', (q) => requests.push(q.url())); ctx.on('page', (q) => popups.push(q));
  const p = await openPage(ctx, '/contact/?shot=hero', errs); popups.length = 0; const navs = []; p.on('framenavigated', (f) => navs.push(f.url()));
  const press = (sel) => (phone ? p.tap(sel, { timeout: 20000 }) : p.click(sel, { timeout: 20000 })), drawn = async () => (await fieldTexts(p)).map((t) => t.full), has = (list, w) => list.some((t) => t.toUpperCase().includes(w.toUpperCase()));
  const said = () => p.evaluate(() => document.querySelector('#comms [role=status]').textContent);
  const active = () => p.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()}${e.dataset.act ? `[${e.dataset.act}]` : ''}${e.getAttribute('href') && e.target ? `:${e.textContent}` : ''}${e.className ? '.' + e.className : ''}` : null; });
  const fieldLive = () => until(p, () => { const c = document.querySelector('#comms'); return c && !c.inert && c.style.pointerEvents !== 'none'; }, null, 60000);
  const want = [...profile.links.map((l) => [l.label, l.url]), ...(profile.resume ? [[C.resume, new URL(profile.resume, ORIGIN).href]] : [])];

  // ---- 1. what it is called, before anything is opened
  const pick = await p.evaluate(() => { const q = window.__lobby.picks.find((x) => x.cta); return [q.name, q.verb, q.steady]; });
  chk(1, pick[0] === 'CONTACT' && pick[1] === (mode === 'links' ? content.display.open : content.display.write) && pick[2] === true, `the display calls the field CONTACT, its verb is ${mode === 'links' ? 'OPEN' : 'WRITE'}, and it holds the view still (steady)`, pick);
  const cta = await p.evaluate(() => document.querySelector('.hero .cta')?.textContent);
  chk(1, cta === (mode === 'links' ? content.rooms.comms.cta : C.write.cta), `the button under the headline says "${mode === 'links' ? content.rooms.comms.cta : C.write.cta}"`, cta);
  const stand = await drawn();
  chk(1, stand.length >= 2 && stand.length <= 3 && has(stand, C.standby.kicker) && !has(stand, 'CLICK') && !has(stand, 'TAP'), 'standby says a kicker and an invitation, and gives no instructions', stand);
  chk(1, await p.evaluate(() => document.querySelector('#comms').inert), 'nothing of the field takes the keyboard while it is in standby');
  chk(1, await p.evaluate(() => document.querySelector('#comms').dataset.mode) === mode, `section#comms has data-mode="${mode}"`);

  // ---- 2, 3. opened with the room's button
  if (!phone) { await p.focus('.hero .cta'); await p.keyboard.press('Enter'); } else await press('.hero .cta');
  await p.waitForTimeout(1500); await settled(p); chk(2, await fieldLive(), 'the field opens and its elements go live'); await p.waitForTimeout(1200); await frames(p, 4);
  const first = await active(), firstVisible = await p.evaluate(() => document.activeElement?.matches(':focus-visible')), texts = await drawn(), all = texts.join(' | ');
  chk(2, !/REPLY TO|OUTBOUND|SIGNAL|Mind|shoulder|CLICK|TAP /i.test(all), 'no "reply to", no commentary, no instructions on the field', all.slice(0, 400));
  if (mode === 'links') chk(2, !has(texts, 'SEND') && (await p.locator('#comms textarea, #comms input, #comms button').count()) === 0, 'links only: no message box, no SEND, nothing to type in');
  chk(2, want.every(([label]) => texts.includes(label)), 'each link is a button with its whole name on it', { want: want.map((w) => w[0]), drawn: texts });
  if (mode === 'links') chk(2, has(texts, profile.contact.intro.slice(0, 20)) && profile.availability.seeking.every((s) => has(texts, s)), "it says who this is for in the owner's words (intro, what is sought)", texts);
  const T = await fieldTexts(p), hitsT = [];
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const [a, c] = [T[i].rect, T[j].rect]; if (a[0] < c[0] + c[2] - 1 && c[0] < a[0] + a[2] - 1 && a[1] < c[1] + c[3] - 1 && c[1] < a[1] + a[3] - 1) hitsT.push([T[i].text, T[j].text]); }
  chk(3, hitsT.length === 0, 'no two pieces of writing on the field overlap', hitsT);
  const E = await p.evaluate(() => [...document.querySelectorAll('#comms a, #comms button, #comms textarea, #comms input')].map((e) => { const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { what: `${e.tagName.toLowerCase()}:${e.textContent || e.getAttribute('aria-label')}`, x: r.x, y: r.y, w: r.width, h: r.height, onTop: top === e, typed: e.matches('textarea, input'), under: top ? `${top.tagName}#${top.id}` : null }; }));
  const hitsE = []; for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) { const a = E[i], c = E[j]; if (a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1) hitsE.push([a.what, c.what]); }
  chk(3, hitsE.length === 0, 'no two of its elements overlap', hitsE);
  chk(3, E.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= W && e.y + e.h <= H), 'every element lies inside the window', E.filter((e) => !(e.x >= 0 && e.y >= 0 && e.x + e.w <= W && e.y + e.h <= H)).map((e) => [e.what, Math.round(e.x), Math.round(e.y)]));
  chk(3, E.filter((e) => !e.typed).every((e) => e.onTop), 'each link and button is what a press at its middle reaches', E.filter((e) => !e.typed && !e.onTop).map((e) => [e.what, e.under]));
  const bar = await p.evaluate(() => [...document.querySelectorAll('#inspectbar button, #named')].filter((e) => e.offsetWidth).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
  chk(3, !E.some((e) => bar.some((c) => e.x < c.x + c.w && c.x < e.x + e.w && e.y < c.y + c.h && c.y < e.y + e.h)), "the bar's controls do not lie over anything of the field");
  if (phone) chk(3, E.every((e) => e.w >= 44 && e.h >= 44), 'on the phone every target is at least 44 x 44 CSS px', E.map((e) => [e.what.slice(0, 20), Math.round(e.w), Math.round(e.h)]));
  await p.screenshot({ path: `/out/contact-${prof}-${mode}-open.png` }).catch(() => {});

  // ---- 4. the links
  const links = await p.evaluate(() => [...document.querySelectorAll('#comms a[target]')].map((a) => [a.textContent, a.href, a.target, a.rel, a.getAttribute('aria-label')]));
  chk(4, links.length === want.length && links.every((l, i) => l[0] === want[i][0] && l[1] === new URL(want[i][1], ORIGIN).href && l[2] === '_blank' && l[3].includes('noopener') && l[4] === `${want[i][0]}, opens in a new tab`), 'one real link per way, in order, target _blank, rel noopener, aria-label "<name>, opens in a new tab"', links);
  for (const [i, [label, href]] of links.entries()) {
    const n0 = popups.length, r0 = requests.length; await press(`#comms a[target] >> nth=${i}`); for (let k = 0; k < 40 && popups.length === n0; k++) await p.waitForTimeout(100);
    const q = popups[n0]; if (q) await q.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
    const asked = requests.slice(r0).some((u) => u === href), at = q ? q.url() : null;
    chk(4, !!q && (at === href || asked), `a ${phone ? 'tap' : 'click'} on ${label} opens ${href} in a new tab`, { popup: at, asked }); if (q) await q.close().catch(() => {});
  }
  chk(4, navs.length === 0 && (await p.evaluate(() => location.pathname)) === '/contact/', 'the station itself went nowhere', navs);

  // ---- 5. the keyboard
  if (!phone) {
    chk(5, mode === 'links' ? first === `a:${want[0][0]}` : first === 'textarea', `opened by keyboard, the ${mode === 'links' ? 'first link' : 'message box'} has the keyboard`, first);
    if (mode === 'links') chk(5, firstVisible, 'and it shows (:focus-visible)');
    await p.focus(mode === 'links' ? '#comms a[target] >> nth=0' : '#comms textarea'); const order = [await active()];
    for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); const a = await active(); if (!(await p.evaluate(() => document.querySelector('#comms').contains(document.activeElement)))) break; order.push(a); }
    const expect = [...(mode === 'links' ? [] : ['textarea']), ...(mode === 'send' ? ['input', 'button[send]'] : []), ...(mode === 'mail' ? ['a[mail]', 'button[copy]'] : []), ...want.map((w) => `a:${w[0]}`)];
    chk(5, JSON.stringify(order) === JSON.stringify(expect), 'Tab goes through everything the field offers, in the order it is read', { order, expect });
    await p.focus('#comms a[target] >> nth=1'); const n0 = popups.length; await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); const vis = await p.evaluate(() => document.activeElement.matches(':focus-visible'));
    await p.keyboard.press('Enter'); for (let k = 0; k < 40 && popups.length === n0; k++) await p.waitForTimeout(100);
    chk(5, vis && (popups[n0]?.url() === links[1][1] || requests.includes(links[1][1])), `Enter on the focused link (${links[1][0]}) opens it in a new tab`, { vis, popup: popups[n0]?.url() }); await popups[n0]?.close().catch(() => {});
  }

  // ---- 6. mail
  const msg = 'Hello — a test.\n\nSecond paragraph: ünïcode ✓, "quotes", <b>tags</b> & 100%?';
  if (mode === 'mail') {
    chk(6, has(texts, ADDRESS), 'the address is shown', texts); chk(6, (await p.locator('#comms input').count()) === 0, "no field asks for the visitor's own address");
    await p.evaluate(() => addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="mailto:"]'); if (a) { e.preventDefault(); (window.__mailto ??= []).push(a.href); } }, true));
    await p.focus('#comms textarea'); await p.keyboard.type(msg, { delay: 2 }); await frames(p, 3);
    const expect = `mailto:${ADDRESS}?subject=${encodeURIComponent(C.subject)}&body=${encodeURIComponent(msg.replace(/\n/g, '\r\n'))}`;
    await press('#comms a[data-act=mail]'); await p.waitForTimeout(600); const got = await p.evaluate(() => window.__mailto);
    chk(6, got?.length === 1 && got[0] === expect, 'the button hands the mail program exactly this: the address, the subject, the message (and no address of the visitor\'s)', { got, expect });
    chk(6, (await said()) === C.status.handed && has(await drawn(), C.status.handed), `and the field says "${C.status.handed}"`, await said());
    chk(6, navs.length === 0 && posts.length === 0, 'nothing was sent by the station, nothing navigated');
    await press('#comms button[data-act=copy]'); await p.waitForTimeout(500); const clip = await p.evaluate(() => navigator.clipboard.readText().catch((e) => '!' + e.message));
    chk(6, clip === ADDRESS && has(await drawn(), C.write.copied), 'COPY puts the address on the clipboard and says so', { clip });
    await p.focus('#comms textarea'); await p.keyboard.press('Control+Enter'); await p.waitForTimeout(300);
    chk(6, (await p.evaluate(() => window.__mailto.length)) === 2, 'Ctrl+Enter in the message does the same as the button');
  }
  // ---- 7. send
  if (mode === 'send') {
    chk(7, (await p.getAttribute('#comms input', 'aria-label')) === `${C.write.email}, ${C.write.emailFor}` && has(texts, C.write.email) && has(texts, C.write.emailFor), "the visitor's email is asked for, labelled with what it is for", texts);
    await press('#comms button[data-act=send]'); await p.waitForTimeout(400);
    chk(7, posts.length === 0 && (await active()) === 'textarea', 'SEND with nothing written sends nothing and gives the message box the keyboard', await active());
    await p.focus('#comms textarea'); await p.keyboard.type(msg, { delay: 2 }); await press('#comms button[data-act=send]'); await p.waitForTimeout(400);
    chk(7, posts.length === 0 && (await active()) === 'input' && (await said()) === C.status.email, 'SEND without an email sends nothing, says why, and gives the email field the keyboard', [await active(), await said()]);
    await p.keyboard.type('not-an-address', { delay: 2 }); await p.keyboard.press('Enter'); await p.waitForTimeout(400); chk(7, posts.length === 0, 'nor with something that is not an address');
    await p.fill('#comms input', 'ada@example.org'); const t0 = Date.now(); status = () => 500; await p.keyboard.press('Enter');
    await until(p, (w) => document.querySelector('#comms [role=status]').textContent === w, C.status.failed, 15000);
    chk(7, posts.length === 1 && (await said()) === C.status.failed && (await p.inputValue('#comms textarea')) === msg, 'when the endpoint refuses (500), the field says so and keeps the message', [posts.length, await said()]);
    status = () => 200; await press('#comms button[data-act=send]'); await until(p, (w) => document.querySelector('#comms [role=status]').textContent === w, C.status.sent, 15000);
    const q = posts[1], body = q ? JSON.parse(q.body) : {};
    chk(7, posts.length === 2 && q.method === 'POST' && /application\/json/.test(q.type), 'SEND posts JSON to the endpoint', q && [q.method, q.type]);
    chk(7, body.message === msg && body.email === 'ada@example.org' && body.from === p.url() && Math.abs(new Date(body.at) - t0) < 600000 && Object.keys(body).sort().join() === 'at,email,from,message', 'what it posts: { at, email, from, message }', body);
    chk(7, (await said()) === C.status.sent && has(await drawn(), C.status.sent) && (await p.inputValue('#comms textarea')) === '', `then says "${C.status.sent}" and the box is empty`, await said());
    chk(7, navs.length === 0, 'nothing navigated');
  }
  // ---- 8. leaving
  if (phone) await press('#back'); else await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  chk(8, await p.evaluate(() => document.querySelector('#comms').inert), 'leaving puts its elements out of reach again');
  if (!phone) chk(8, (await active()) === 'button.cta', "and the keyboard is back on the room's button", await active());
  const real = errs.filter((e) => !(mode === 'send' && /500/.test(e)));
  chk(9, real.length === 0, 'no page error, console error or failed request', [...new Set(real)].slice(0, 6));
  chk(9, external.every((u) => want.some(([, h]) => u.startsWith(h))), 'the only requests to other sites were the links pressed', [...new Set(external)]);
  await ctx.close();
}

/** L. contrast, desktop, links. */
async function legible() {
  const prof = 'desktop', P = PROFILES[prof]; S.profile(`${prof} legibility`); console.log('\n=== desktop legibility');
  const ctx = await context(b, P), errs = []; await ctx.addInitScript(cspy);
  const p = await openPage(ctx, '/contact/?shot=hero', errs), measure = await reader(), ANG = [0, 120, 240], MIN = 4.5;
  const b64 = (buf) => buf.toString('base64'), worst = (rows) => rows.filter((r) => !r.off && Number.isFinite(r.worst)).sort((x, y) => x.worst - y.worst)[0];
  let low = [];
  for (const a of ANG) {
    await sky(p, a); await hideWords(p, false); const words = await hudWords(p); await hideWords(p, true); await sky(p, a); const B = await p.screenshot(); await hideWords(p, false);
    const res = await measure(null, b64(B), words.map((w) => ({ kind: 'dom', ...w })));
    low.push([a, worst(res)]);
  }
  chk('L', low.every(([, w]) => w && w.worst >= MIN), `the page's words (${(await hudWords(p)).length} runs) over the bright room: worst contrast at sky angles ${ANG} is at least ${MIN}:1`, low.map(([a, w]) => [a, w?.text, +w?.worst.toFixed(2)]));
  const fieldAt = async (state) => {
    const rows = [];
    for (const a of ANG) {
      await hideWords(p, 'all'); await sky(p, a); const texts = await fieldTexts(p), A = await p.screenshot(); await wipeField(p); await sky(p, a); const B = await p.screenshot();
      await p.evaluate((st) => { const pick = window.__lobby.picks.find((q) => q.cta); pick.onFocus(!st); pick.onFocus(st); }, state === 'open');
      if (state === 'open') await p.waitForTimeout(1100); await p.evaluate(() => document.activeElement?.blur?.()); await frames(p, 3);
      const res = await measure(b64(A), b64(B), texts.map((t) => ({ kind: 'light', ...t }))); rows.push([a, worst(res)]);
    }
    await hideWords(p, false); return rows;
  };
  let rows = await fieldAt('standby');
  chk('L', rows.every(([, w]) => w && w.worst >= MIN), `the field's words in standby: worst contrast at least ${MIN}:1`, rows.map(([a, w]) => [a, w?.text, +w?.worst.toFixed(2)]));
  await p.evaluate(() => { const l = window.__lobby; l.setFocus(l.picks.find((q) => q.cta)); }); await p.waitForTimeout(2500); await settled(p); await p.evaluate(() => document.activeElement?.blur?.());
  rows = await fieldAt('open');
  chk('L', rows.every(([, w]) => w && w.worst >= MIN), `the field's words, open: worst contrast at least ${MIN}:1`, rows.map(([a, w]) => [a, w?.text, +w?.worst.toFixed(2)]));
  chk('L', errs.length === 0, 'no error', errs.slice(0, 3)); await ctx.close();
}
try {
  const todo = which === 'all' ? [['desktop', 'links'], ['desktop', 'mail'], ['desktop', 'send'], ['phone', 'links'], ['phone', 'mail'], ['phone', 'send'], ['reduced', 'links']] : ['desktop', 'phone', 'reduced'].includes(which) ? (which === 'reduced' ? [['reduced', 'links']] : ['links', 'mail', 'send'].map((m) => [which, m])) : [];
  for (const [pr, m] of todo) await behave(pr, m);
  if (which === 'all' || which === 'desktop') await legible();
} finally { await b.close(); }
S.finish();
