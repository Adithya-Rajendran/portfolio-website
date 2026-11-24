// The reader. Some things in the rooms can be read: a volume lying open on the Library drone's tray, an exhibit in the
// Fabrication bay, the books on the Lounge's table, a stop on the route map. A READ glyph from the visitor's own display
// floats under such a thing. Asked to read, the display opens it in the way that suits the thing (js/opening/: it is
// scanned where it lies; a hologram's own sheet opens up; what has nothing of its own in the room is received), and its
// article stands up as a hologram.
// The article is not a texture. It is the <article> of that thing's own page (written by tools/site.py), laid over the
// canvas and moved with the camera so that it sits in the hologram's frame. Once the camera has come to rest it is an
// ordinary upright element at its natural size: sharp, selectable, searchable, read by screen readers, and its links
// work. Everything that is light (the frame and its veil, the beam, the scan) is drawn in the scene.
//
// A source is what a room offers to be read:
//   url      the page whose article it is ('/blog/<slug>/', '/portfolio/<slug>/', '/experience/#<id>'); a #fragment opens it at that id
//   foot()   world point the hologram stands over (the middle of the book, the foot of a placard)
//   facing   horizontal unit vector from there toward where the reader stands
//   sheet    the surface the scan crosses: { parent (an Object3D; null: the room), position, quaternion, size: [w, h] }, in the parent's
//            frame; a unit plane is laid there with its +y toward the top of what is read; top: the frame stands beyond its top edge (a book lying open)
//   span     how many metres of the room fill the strip left under the frame (default: the sheet's width, at most 0.6)
//   word     what the glyph says (default: the room's "read")
//   how      the way it opens: 'scan' (the default); 'unfold' for a hologram that shows a sheet of its own (station: its
//            display, { page, holder }); 'receive' for what has nothing of its own in the room (no READ is offered for
//            that: it opens when it is called for)
//   bodies   'scan': the things the scan crosses instead of the flat sheet, each a box in the room
//            { position, quaternion, size: [w, h, d], reads: the one the frame's light rises from }
import * as THREE from 'three';
import { GLOW, CY, V, uTime } from './kit.js';
import { createScan } from './opening/scan.js';
import { createReceive } from './opening/receive.js';
import { createUnfold } from './opening/unfold.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
// (each way of opening keeps its own times, in seconds from the request: ACT its own doing, UNFOLD the frame, REVEAL the words)
const ramp = (t, [a, b]) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
// a uniform eased toward where it should be, and then there: a change on the display ends (reduced motion: a cut)
const ease = (u, to, k) => { u.value = still || Math.abs(to - u.value) < 1e-3 ? to : u.value + (to - u.value) * k; return u.value; };
// what the display adds over the room, and how much of what is behind it goes out; the alpha channel (the floor's mirror
// pass reads distance there) is left as it was
const VEIL = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

// READ, in the manner of the page's own display: corners and spaced capitals, one part to a channel so the shader can light
// each its own way (r: the word, g: the corners, b: the rule inside them). On black, not on a clear canvas: a clear canvas
// uploads the soft edges of its strokes at full strength, and small capitals come out ragged.
function glyphTex(word) {
  const cv = Object.assign(document.createElement('canvas'), { width: 768, height: 256 }), c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 768, 256); c.lineCap = 'square';
  c.strokeStyle = '#0f0'; c.lineWidth = 7;
  for (const [x, sx] of [[40, 1], [728, -1]]) for (const [y, sy] of [[40, 1], [216, -1]]) { c.beginPath(); c.moveTo(x + sx * 46, y); c.lineTo(x, y); c.lineTo(x, y + sy * 46); c.stroke(); }
  c.strokeStyle = '#00f'; c.lineWidth = 3; c.strokeRect(64, 64, 640, 128);
  const gap = word.length > 5 ? 0.21 : 0.52, fit = (px) => { c.font = `600 ${px}px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = `${Math.round(px * gap)}px`; return c.measureText(word).width; };
  let px = 100; const wide = fit(px); if (wide > 590) fit(px = Math.floor(px * 590 / wide));          // a longer word in a room's own language still fits inside the rule
  c.fillStyle = '#f00'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(word, 384 + Math.round(px * gap) / 2, 133);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 8; return t;
}
const light = (fragmentShader, uniforms, extra = {}) => new THREE.ShaderMaterial({ ...GLOW, side: THREE.DoubleSide, uniforms,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }', fragmentShader, ...extra });

const articles = new Map(), HERE = location.pathname;          // path -> its <article>, kept once fetched; HERE: the page this session opened on
const pathOf = (url) => url.split('#')[0];

/**
 * @param text     the room's "reader" words (content.json)
 * @param onLink   (href) a link in the article that leads elsewhere on the site (null: the reader's own close button)
 * @param onShown  () the article has arrived: its title is known
 * @param clearance (x0, x1) how many pixels up from the bottom of the window the page's own controls reach between those x (the glyph keeps clear of them)
 */
export function createReader({ scene, camera, text, onLink, onShown, clearance }) {
  const root = new THREE.Group(); root.name = 'Reader'; scene.add(root);

  // ---- READ: a glyph under the thing, always facing the visitor and drawn over everything, like the rest of their display.
  // It has no clock: it opens, changes its word, brightens under the pointer and shows how far the scan has got, and is
  // otherwise still. A dark plate behind the word lets it read over a white page as well as over a dark room.
  const uShow = { value: 0 }, uWord = { value: 0 }, uHover = { value: 0 }, uProgress = { value: 0 }, words = new Map(), word = (w) => words.get(w) ?? words.set(w, glyphTex(w)).get(w), tA = { value: word(text.read) }, tB = { value: word(text.scanning) };
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), light(`uniform sampler2D tA, tB; uniform float uShow, uWord, uHover, uProgress; varying vec2 vUv;
    void main(){
      float open = smoothstep(0.0, 1.0, uShow), w = abs(vUv.x - 0.5)*2.0;
      if (w > open) discard;                                   // pops open from its middle
      vec3 ink = mix(texture2D(tA, vUv, -0.6).rgb, texture2D(tB, vUv, -0.6).rgb, smoothstep(0.3, 0.7, uWord));     // a sharper level of the drawing: it is shown small
      vec2 p = vUv*vec2(768.0, 256.0), q = min(p - 40.0, vec2(728.0, 216.0) - p);      // texels of the drawing; q: in from the plate's edges
      float fw = max(fwidth(p.x), 1.0), plate = smoothstep(-fw, fw, min(q.x, q.y));      // fw: texels to a pixel on screen
      float to = mix(64.0, 704.0, uProgress), bar = (1.0 - smoothstep(3.0, 3.0 + fw, abs(p.y - 64.0)))*smoothstep(64.0 - fw, 64.0, p.x)*(1.0 - smoothstep(to - fw, to, p.x))*uWord;
      float lead = exp(-pow((open - w)*30.0, 2.0))*(1.0 - open);
      vec3 c = vec3(0.62, 0.93, 1.0)*(ink.r*(1.15 + 0.45*uHover) + bar*1.7 + lead*1.5)
             + ${CY}*(ink.g*(1.05 + 1.2*uHover) + ink.b*(0.24 + 0.56*uHover)*(1.0 - bar));
      gl_FragColor = vec4(vec3(0.0022, 0.006, 0.0095)*plate + c, plate*0.88*open);     // the room behind the plate all but goes out
    }`, { tA, tB, uShow, uWord, uHover, uProgress }, { ...VEIL, depthTest: false }));
  glyph.name = 'ReadGlyph'; glyph.renderOrder = 20; glyph.frustumCulled = false; root.add(glyph);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ visible: false })); glyph.add(hit);
  // the pointer over it (a mouse or a pen: a finger does not hover). Where it is is kept; whether that is on the glyph is
  // asked a few times a second while the glyph shows, so a glyph that comes to rest under a still pointer lights too
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pointer = null, asked = -1, over = false;
  const onPointer = (e) => { pointer = e.pointerType === 'touch' || !(e.target instanceof HTMLCanvasElement) ? null : [e.clientX, e.clientY]; };
  const onOut = (e) => { if (!e.relatedTarget) pointer = null; };
  addEventListener('pointermove', onPointer, { passive: true }); document.addEventListener('pointerout', onOut);

  // ---- where what is read is: a unit square laid on the source's sheet (lay() puts it there), +y toward its top. The
  // glyph hangs under it, and each way of opening works from it.
  const anchor = new THREE.Object3D(); anchor.name = 'ReadAnchor';

  // ---- the hologram: a frame with a dark veil behind the words, and a curtain of light rising to it from the book.
  // uFrom: where up the frame it opens from (0: its foot, over what is read; 0.5: its middle, both ways at once)
  const uOpen = { value: 0 }, uFrom = { value: 0 }, uReveal = { value: 0 }, uSize = { value: new THREE.Vector2(800, 500) }, uHead = { value: 52 };     // uHead: how tall the words' heading is (pixels)
  const uPhone = { value: 0 };                                  // 1: the frame is laid out for a phone (its heading has no room name: post.css)
  const uVeil = { value: 1 }, uGrown = { value: 1 };            // for a way that moves the frame as it opens: how much of what is behind it goes out, and its size now over its size at rest
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ ...VEIL, depthTest: false, side: THREE.DoubleSide,     // over whatever stands in its rectangle (the Library's drone reaches in front of it)
    uniforms: { uOpen, uFrom, uReveal, uSize, uVeil, uGrown },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform float uOpen, uFrom, uReveal, uVeil, uGrown; uniform vec2 uSize; varying vec2 vUv;
      void main(){
        float lo = uFrom*(1.0 - uOpen), hi = lo + uOpen;
        if (vUv.y < lo || vUv.y > hi) discard;                 // unfolds from the edge over the book, or from its own middle
        vec2 p = vUv*uSize, q = min(p, uSize - p)*uGrown;      // CSS pixels from the nearest edges (as they are on screen now)
        float edge = 1.0 - smoothstep(0.0, 1.6, min(q.x, q.y));
        float tick = max(step(q.x, 22.0)*step(q.y, 3.0), step(q.y, 22.0)*step(q.x, 3.0));
        float lead = (exp(-pow((hi - vUv.y)*uSize.y/5.0, 2.0)) + step(0.001, uFrom)*exp(-pow((vUv.y - lo)*uSize.y/5.0, 2.0)))*(1.0 - step(0.999, uOpen));
        float v = 1.0 - vUv.y, line = exp(-pow((uReveal - v)*uSize.y/2.5, 2.0))*step(0.001, uReveal)*(1.0 - step(0.999, uReveal));
        float rows = 0.5 + 0.5*sin(p.y*1.5708);
        vec3 c = ${CY}*(edge*0.30 + tick*1.1 + lead*2.2 + line*1.6 + 0.004*rows + 0.01*(1.0 - smoothstep(0.0, 90.0, q.y)));
        gl_FragColor = vec4(vec3(0.0022, 0.006, 0.0095)*uVeil + c, 0.998*uVeil);      // what is behind all but goes out: the words must be easy to read
      }` }));
  panel.name = 'ReadFrame'; panel.renderOrder = 8; panel.visible = false; root.add(panel);
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  beamGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)); beamGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const uBeam = { value: 0 }, uFlow = { value: 0 };             // uFlow: how far its light has risen; it rises while the frame unfolds and stops when the words are there
  const beam = new THREE.Mesh(beamGeo, light(`uniform float uK, uFlow; varying vec2 vUv;
    void main(){ float s = 0.55 + 0.45*sin(vUv.x*70.0 + sin(vUv.x*13.0)*4.0), rise = 0.7 + 0.3*sin(vUv.y*26.0 - uFlow + vUv.x*9.0);
      float side = smoothstep(0.0, 0.08, vUv.x)*smoothstep(1.0, 0.92, vUv.x);
      gl_FragColor = vec4(${CY}*s*rise*side*pow(1.0 - vUv.y, 1.3)*0.5*uK, 1.0); }`, { uK: uBeam, uFlow }));
  beam.name = 'ReadBeam'; beam.frustumCulled = false; beam.renderOrder = 7; root.add(beam);

  // ---- the ways of opening (js/opening/). Each says whether READ is offered for it first (asks), what the glyph says
  // while it works (word; quiet(): or that it says nothing then), where the frame opens from (from), its times (ACT,
  // UNFOLD, REVEAL), and whether its own doing waits for the article to arrive (waits); it is told the source it works on
  // (lay) and the time (update), and may say where the curtain of light under the frame starts (beam; BEAM: when), and
  // move the frame itself as it opens (shape).
  const ways = (() => { const kit = { root, anchor, camera, panel, light, ramp, ease, still, text, uSize, uPhone, uOpen, uFrom, uReveal, uHead, uVeil, uGrown }; return { scan: createScan(kit), unfold: createUnfold(kit), receive: createReceive(kit) }; })();
  let way = ways.scan;

  // ---- the words: one element over the canvas, holding the article
  const host = Object.assign(document.createElement('div'), { id: 'reader', hidden: true });
  host.setAttribute('role', 'region'); host.setAttribute('aria-label', text.label);
  host.innerHTML = `<div class="reader-head"><span class="reader-mark">${text.mark}</span><span class="reader-title"></span><button class="reader-close" type="button">${text.back}</button></div>
    <nav class="reader-rail" aria-label="${text.contents}"><p>${text.contents}</p><ol></ol></nav>
    <div class="reader-scroll" tabindex="0"></div><div class="reader-progress"><i></i></div>`;
  document.body.append(host);
  const headEl = host.querySelector('.reader-head'), scroll = host.querySelector('.reader-scroll'), rail = host.querySelector('.reader-rail ol'), bar = host.querySelector('.reader-progress i');
  async function article(path) {
    if (articles.has(path)) return articles.get(path);
    let el = path === HERE ? document.querySelector('#page article.post, #page section.post-list') : null;           // the page's own article
    if (!el) {
      const r = await fetch(path.slice(1)); if (!r.ok) throw new Error(`${path}: ${r.status}`);
      el = new DOMParser().parseFromString(await r.text(), 'text/html').querySelector('article.post, section.post-list');
      if (!el) throw new Error(`${path} has no article`);
      el = document.adoptNode(el);
    }
    for (const pre of el.querySelectorAll('pre')) {              // code can be copied
      const b = Object.assign(document.createElement('button'), { className: 'copy', type: 'button', textContent: text.copy }); b.setAttribute('aria-label', text.copyCode); b.setAttribute('aria-live', 'polite'); pre.before(b);
      b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); b.textContent = text.copied; setTimeout(() => { b.textContent = text.copy; }, 1600); } catch { /* no clipboard: select it by hand */ } });
    }
    articles.set(path, el); return el;
  }
  let heads = [], goTo = null;
  function show(el) {
    scroll.replaceChildren(el);
    const title = el.querySelector('h1')?.textContent ?? '';
    host.querySelector('.reader-title').textContent = title.toUpperCase() === text.mark?.toUpperCase() ? '' : title;      // not the room's name twice
    heads = [...el.querySelectorAll('.post-body h2[id], section.entry[id] > h2')].map((h) => (h.id ? h : Object.assign(h, { id: `${h.parentNode.id}-title` })));
    rail.replaceChildren(...heads.map((h) => { const li = document.createElement('li'), a = Object.assign(document.createElement('a'), { href: `#${h.id}`, textContent: h.textContent }); li.append(a); return li; }));
    host.classList.toggle('plain', !heads.length);              // nothing to list: the text has the whole frame
    progress(); onShown?.();
  }
  function progress() {
    const max = scroll.scrollHeight - scroll.clientHeight; bar.style.transform = `scaleX(${max > 0 ? scroll.scrollTop / max : 1})`;
    const y = scroll.getBoundingClientRect().top + 90; let now = -1; heads.forEach((h, i) => { if (h.getBoundingClientRect().top < y) now = i; });
    [...rail.children].forEach((li, i) => { if (i === now) li.firstChild.setAttribute('aria-current', 'location'); else li.firstChild.removeAttribute('aria-current'); });
  }
  scroll.addEventListener('scroll', progress, { passive: true });
  host.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href') || '';
    if (/^\/(blog\/files|resume)\//.test(href)) { a.target = '_blank'; a.rel = 'noopener'; return; }      // a file: beside the station, not instead of it
    if (href.startsWith('#')) { e.preventDefault(); scroll.querySelector(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); }
    else if (href.startsWith('/') && onLink(href) !== false) e.preventDefault();       // a post or a room: the station goes there itself
  });

  // ---- where things stand. The hologram's size is chosen in CSS pixels first, then placed in the room at the scale
  // that makes one of its pixels one pixel on screen from the reading pose; so at rest the words need no transform.
  const px = { w: 800, h: 500, top: 76 }, pose = { pos: V(), tgt: V() }, rest = { p: V(), q: new THREE.Quaternion(), s: V(1, 1, 1) }, _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _v = V(), _a = V(), _b = V(), _c = V(), UP = V(0, 1, 0);
  let offer = null, offeredBy = null, src = null, laid = null;   // offer(): the source that can be read now; src: the one being read; laid: the one the anchor lies on
  const current = () => src ?? offer?.() ?? null;
  function lay(s) {                                              // put the anchor on a source, and tell the way that opens it
    if (s === laid) return; laid = s; anchor.removeFromParent();
    if (s) {
      (s.sheet.parent ?? root).add(anchor); anchor.position.copy(s.sheet.position); anchor.quaternion.copy(s.sheet.quaternion); anchor.scale.set(...s.sheet.size, 1); anchor.updateMatrixWorld(true);
      way = ways[s.how] ?? ways.scan; tA.value = word(s.word ?? text.read); tB.value = word(text[way.word] ?? text.scanning);
    }
    for (const w of Object.values(ways)) w.lay(s && w === way ? s : null);
  }
  function layout() {
    const s = current(); if (!s) return pose;
    const W = innerWidth, H = innerHeight, phone = W < 720, tan = Math.tan(rad(camera.fov / 2)), bottom = phone ? 132 : 130, facing = s.facing;
    px.top = phone ? 58 : 76; px.w = Math.round(Math.min(1040, W - (phone ? 12 : 80))); px.h = Math.round(H - px.top - bottom);
    const span = s.span ?? Math.min(0.6, s.sheet.size[0]), k = span / Math.min(clamp(H * 0.4, 220, 480), W * 0.6), d = k * H / (2 * tan);      // k: metres per pixel at the hologram; d: how far back that puts the eye
    const foot = s.foot(), at = foot.clone().addScaledVector(facing, 0.22), eyeY = foot.y + (H / 2 - bottom * 0.45) * k;        // what is read shows in the strip left under the frame
    pose.tgt.set(at.x, eyeY, at.z); pose.pos.copy(pose.tgt).addScaledVector(facing, d);
    panel.position.set(at.x, eyeY + (H / 2 - (px.top + px.h / 2)) * k, at.z); panel.scale.set(px.w * k, px.h * k, 1); panel.lookAt(_v.copy(panel.position).add(facing)); panel.updateMatrixWorld();
    rest.p.copy(panel.position); rest.q.copy(panel.quaternion); rest.s.copy(panel.scale);                        // where the frame stands at rest
    uSize.value.set(px.w, px.h); host.style.width = `${px.w}px`; host.style.height = `${px.h}px`; host.classList.toggle('phone', phone); uPhone.value = +phone;
    const shut = host.hidden; host.hidden = false; uHead.value = headEl.offsetHeight || uHead.value; host.hidden = shut;      // (measured, not painted: an opening may draw where the heading will be)
    return pose;
  }
  /** Place the element where the frame is on screen. At rest that is a whole-pixel offset; while the camera moves, the frame's own perspective. */
  function place() {
    const W = innerWidth, H = innerHeight;
    _m.makeScale(1 / px.w, -1 / px.h, 1).setPosition(-0.5, 0.5, 0).premultiply(panel.matrixWorld).premultiply(camera.matrixWorldInverse).premultiply(camera.projectionMatrix)
      .premultiply(_n.set(W / 2, 0, 0, W / 2, 0, -H / 2, 0, H / 2, 0, 0, 1, 0, 0, 0, 0, 1));
    const e = _m.elements, w = e[15]; e[2] = e[6] = e[14] = 0; e[10] = 1;                                            // flat: only x, y and the perspective divide matter
    const rest = Math.abs(e[0] / w - 1) < 2e-3 && Math.abs(e[5] / w - 1) < 2e-3 && Math.abs(e[1]) + Math.abs(e[4]) + Math.abs(e[3]) + Math.abs(e[7]) < 2e-5 * w;
    host.style.transform = rest ? `translate(${Math.round(e[12] / w)}px, ${Math.round(e[13] / w)}px)` : `matrix3d(${Array.from(e, (x) => +x.toFixed(6)).join(',')})`;
  }

  // ---- state: closed -> scanning -> open, and back
  let state = 'closed', t0 = 0, folding = 0, ready = false, shut = null;      // shut: where the frame was when it was closed part-way through its opening
  function read() {
    const s = offer?.(); if (!s || state !== 'closed') return false;
    src = s; state = 'scanning'; t0 = uTime.value - (still ? 9 : 0); ready = false; folding = 0; shut = null; lay(s); way.start?.();
    const [path, id] = s.url.split('#'), mine = () => state !== 'closed' && src === s;      // an answer that arrives after the reader has moved on is dropped
    if (id) goTo = id;
    article(path).then((el) => { if (mine()) show(el); }, (err) => {
      console.error(err); if (!mine()) return;
      heads = []; rail.replaceChildren(); host.querySelector('.reader-title').textContent = '';
      scroll.replaceChildren(Object.assign(document.createElement('p'), { className: 'reader-error', textContent: text.failed }));
    }).finally(() => { if (mine()) ready = true; });
    return true;
  }
  function close() {
    if (state === 'closed') return;
    // closed while the way that opens it still had the frame somewhere on its way: it folds there, not at rest
    if (state === 'scanning' && way.shape && panel.visible) shut = { p: panel.position.clone(), q: panel.quaternion.clone(), s: panel.scale.clone(), veil: uVeil.value, grown: uGrown.value };
    state = 'closed'; src = null; folding = uTime.value; host.hidden = true; host.classList.remove('open');
    if (host.contains(document.activeElement)) document.activeElement.blur();
  }
  host.querySelector('.reader-close').addEventListener('click', () => onLink(null));
  const onResize = () => { if (state !== 'closed') layout(); };
  addEventListener('resize', onResize);

  let last = 0;
  function update(t) {
    const on = state !== 'closed', s = current(), can = !!s, dt = clamp(t - last, 0, 0.1); last = t; lay(s);
    const w = way, hold = w.ACT[0] + 0.72 * (w.ACT[1] - w.ACT[0]);
    if (state === 'scanning' && w.waits && !ready && !still && t - t0 > hold) t0 = t - hold;      // what is being fetched has not come: its arriving stops short, and goes on when it has
    const T = t - t0;
    // READ: there while something that is in the room can be read and nothing is, and while the scan crosses it (it says
    // SCANNING and how far the scan has got); sized on screen, not in the room, so it can be tapped on a phone
    ease(uShow, can && w.asks && (!on || (T < w.ACT[1] && !w.quiet?.())) ? 1 : 0, 0.14);
    glyph.visible = uShow.value > 0.01 && !!laid;
    if (glyph.visible) { ease(uWord, on && !w.quiet?.() ? 1 : 0, 0.25); uProgress.value = on ? ramp(T, w.ACT) : uWord.value > 0 ? uProgress.value : 0; }      // (a way that gets out of the way shuts it as it is, saying READ)
    else { uWord.value = on && !w.quiet?.() ? 1 : 0; uProgress.value = 0; }      // shut: it opens again saying what it will say
    if (glyph.visible) {                                       // its top edge a few pixels under the thing, never off the bottom of the view
      const tan = Math.tan(rad(camera.fov / 2)), fwd = camera.getWorldDirection(_b), up = _a.copy(UP).applyQuaternion(camera.quaternion);
      anchor.localToWorld(_v.set(0, -0.5, 0)); _c.copy(_v).sub(camera.position);
      const depth = Math.max(0.3, _c.dot(fwd)), m = 2 * depth * tan / innerHeight, gw = clamp(innerWidth * 0.2, 104, 168) * m, h = gw / 3;       // m: metres per pixel there; gw, h: the glyph's size there
      // ... and clear of the page's controls under it: a touch that lands near a button is given to the button
      const x = (_v.clone().project(camera).x * 0.5 + 0.5) * innerWidth, half = gw / m / 2 + 28, taken = clearance?.(x - half, x + half) ?? 0;
      const low = _c.dot(up) - 14 * m - h / 2, floor = -depth * tan + (taken ? taken + 34 : 10) * m + h / 2;
      glyph.position.copy(_v).addScaledVector(up, Math.max(low, floor) - _c.dot(up)); glyph.quaternion.copy(camera.quaternion); glyph.scale.setScalar(gw / 3);
    }
    // brighter while the pointer is on it and it can be pressed: a short ease, to an end. The pointer is tested against the
    // glyph's own tap area a few times a second, not on every move
    if (!(glyph.visible && pointer && state === 'closed')) over = false;
    else if (t - asked > 0.08 || t < asked) {
      asked = t; ndc.set(pointer[0] / innerWidth * 2 - 1, -pointer[1] / innerHeight * 2 + 1); ray.setFromCamera(ndc, camera); glyph.updateMatrixWorld(true);
      over = ray.intersectObject(hit, false).length > 0;
    }
    uHover.value = still ? +over : clamp(uHover.value + (over ? dt : -dt) / 0.18, 0, 1);
    // the way it opens: the one at work does its part, the others put theirs away
    for (const x of Object.values(ways)) x.update({ on: on && x === w, T, t, dt });
    // the hologram
    const open = on ? ramp(T, w.UNFOLD) : Math.max(0, uOpen.value - (still ? 1 : (t - folding) > 0 ? 0.09 : 0));
    if (on) uFrom.value = w.from;                               // (it folds the way it opened)
    uOpen.value = open; uReveal.value = on ? ramp(T, w.REVEAL) : 0; panel.visible = open > 0.002;
    if (panel.visible) {                                        // at rest, unless the way that opens it has it somewhere else on the way there
      const at = !on && shut || rest;
      panel.position.copy(at.p); panel.quaternion.copy(at.q); panel.scale.copy(at.s); uVeil.value = at.veil ?? 1; uGrown.value = at.grown ?? 1;
      if (on) w.shape?.(T); panel.updateMatrixWorld();
    } else shut = null;
    // the curtain of light, where the way has one: up with the frame, lively while it unfolds, then dimmer and still before the reader is settled()
    if (on && w.beam) { const b0 = w.BEAM ?? w.UNFOLD[0]; uBeam.value = ramp(T, [b0, b0 + 0.4]) * (1 - 0.68 * ramp(T, [w.REVEAL[1], w.REVEAL[1] + 0.6])); uFlow.value += dt * 5 * (1 - ramp(T, [w.REVEAL[0], w.REVEAL[1] + 0.6])); }
    else ease(uBeam, 0, 0.12);
    beam.visible = uBeam.value > 0.01 && !!laid && !!w.beam?.(_a, _b, laid);       // _a, _b: the ends of the line on what is read that it rises from
    if (beam.visible) {
      const p = beamGeo.attributes.position, reach = Math.min(1, 0.75 * _a.distanceTo(_b) / panel.scale.x);
      p.setXYZ(0, ..._a.toArray()); p.setXYZ(1, ..._b.toArray());
      p.setXYZ(2, ...panel.localToWorld(_v.set(-reach / 2, -0.5, 0)).toArray()); p.setXYZ(3, ...panel.localToWorld(_v.set(reach / 2, -0.5, 0)).toArray()); p.needsUpdate = true;
    }
    // the words follow the reveal line down the frame, then are simply there
    if (on && T >= w.REVEAL[0] && ready) {
      // (a hidden element cannot be scrolled, so the top is set now, when it shows, and not when the article was put in)
      if (host.hidden) { host.hidden = false; scroll.scrollTop = 0; if (goTo) { scroll.querySelector(`#${CSS.escape(goTo)}`)?.scrollIntoView({ block: 'start' }); goTo = null; } progress(); }
      const r = Math.max(uReveal.value, still ? 1 : 0);
      if (r < 1) host.style.clipPath = `inset(0 0 ${((1 - r) * 100).toFixed(2)}% 0)`;
      else if (state === 'scanning') { state = 'open'; host.style.clipPath = ''; host.classList.add('open'); scroll.focus({ preventScroll: true }); }
      place();
    }
  }
  return {
    root, hit, update, read, close, pose: layout,
    /** What can be read now: a function returning a source or null (asked every frame), and the pick that offers it. */
    offer(fn, by = null) { offer = fn; offeredBy = by; },
    offeredBy: () => offeredBy,
    /** Something is offered and nothing is being read. */
    available: () => state === 'closed' && !!offer?.(),
    state: () => state,
    /** The address of what is being read (null: nothing), and its title once it has arrived. */
    url: () => src?.url ?? null, title: () => (src && articles.get(pathOf(src.url))?.querySelector('h1')?.textContent) || null,
    /** Open and at rest: nothing in the frame is changing any more (main.js then draws the room behind it less often). */
    settled: () => state === 'open' && uTime.value - t0 > way.REVEAL[1] + 0.8,
    /** Go to a heading of the article that is open (by id; none: its top). */
    jump(id) { const h = id && scroll.querySelector(`#${CSS.escape(id)}`); if (h) h.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); else scroll.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); },
    /** Open the next article at this heading (by id): where the reader had got to on the plain page. */
    scrollTo(id) { goTo = id; },
    dispose() { removeEventListener('resize', onResize); removeEventListener('pointermove', onPointer); document.removeEventListener('pointerout', onOut); host.remove(); for (const w of words.values()) w.dispose(); for (const w of Object.values(ways)) w.dispose(); anchor.removeFromParent(); },
  };
}
