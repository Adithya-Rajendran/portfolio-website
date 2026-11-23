// The reader. Some things in the rooms can be read: a volume lying open on the Library drone's tray, a project's placard
// in the Fabrication bay, a stop on the route map. A READ glyph from the visitor's own display floats under such a
// thing. Asked to read, a fan of light from the visitor sweeps it, and its article stands up over it as a hologram.
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
import * as THREE from 'three';
import { GLOW, CY, V, uTime } from './kit.js';

const SANS = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif', rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the scan, in seconds from the request: the fan sweeps the pages, the frame unfolds upward, the words follow it down
const SWEEP = [0.25, 1.35], UNFOLD = [1.15, 1.95], REVEAL = [1.75, 2.65], FOLD = 0.45;
const ramp = (t, [a, b]) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };

function glyphTex(word) {                                       // READ, in the manner of the page's own display: brackets and spaced capitals
  const cv = Object.assign(document.createElement('canvas'), { width: 768, height: 256 }), c = cv.getContext('2d');
  c.strokeStyle = c.fillStyle = '#fff'; c.lineWidth = 5; c.lineCap = 'square';
  for (const [x, sx] of [[40, 1], [728, -1]]) for (const [y, sy] of [[40, 1], [216, -1]]) { c.beginPath(); c.moveTo(x + sx * 46, y); c.lineTo(x, y); c.lineTo(x, y + sy * 46); c.stroke(); }
  c.globalAlpha = 0.45; c.lineWidth = 2; c.strokeRect(64, 64, 640, 128); c.globalAlpha = 1;
  c.font = `500 84px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; if ('letterSpacing' in c) c.letterSpacing = word.length > 5 ? '18px' : '44px';
  c.fillText(word, 384 + (word.length > 5 ? 9 : 22), 132);
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

  // ---- READ: a glyph under the thing, always facing the visitor and drawn over everything, like the rest of their display
  const uShow = { value: 0 }, uWord = { value: 0 }, words = new Map(), word = (w) => words.get(w) ?? words.set(w, glyphTex(w)).get(w), tA = { value: word(text.read) };
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), light(`uniform sampler2D tA, tB; uniform float uShow, uWord, uTime; varying vec2 vUv;
    void main(){
      float open = smoothstep(0.0, 1.0, uShow), w = abs(vUv.x - 0.5)*2.0;
      if (w > open) discard;                                   // pops open from its middle
      float ink = mix(texture2D(tA, vUv).r, texture2D(tB, vUv).r, uWord);
      float sweep = exp(-pow((vUv.x - fract(uTime*0.45)*1.6 + 0.3)*7.0, 2.0));
      float lead = exp(-pow((open - w)*30.0, 2.0))*(1.0 - open);
      vec3 c = ${CY}*(ink*(0.75 + 0.2*sin(uTime*2.6)) + 0.012) + vec3(0.7, 0.95, 1.0)*(ink*sweep*0.9 + lead*1.5);
      gl_FragColor = vec4(c*2.4, 1.0);
    }`, { tA, tB: { value: word(text.scanning) }, uShow, uWord, uTime }, { depthTest: false }));
  glyph.renderOrder = 20; glyph.frustumCulled = false; root.add(glyph);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ visible: false })); glyph.add(hit);

  // ---- the scan: a line of light crossing what is read, and the fan from the visitor that draws it
  const uScan = { value: 0 }, uScanK = { value: 0 };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), light(`uniform float uScan, uK, uTime; varying vec2 vUv;
    void main(){
      float v = 1.0 - vUv.y, d = uScan - v;                    // v: from the top down
      float line = exp(-pow(d*90.0, 2.0)), read = step(0.0, d)*exp(-d*5.0);
      float grid = step(0.86, fract(vUv.x*24.0)) + step(0.8, fract(v*34.0));
      gl_FragColor = vec4(${CY}*(line*3.2 + read*(0.10 + 0.22*grid))*uK, 1.0);
    }`, { uScan, uK: uScanK, uTime }));
  sheet.renderOrder = 9; sheet.visible = false;
  const fanGeo = new THREE.BufferGeometry(); fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  fanGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0.5, 0, 0, 1, 1, 1]), 2));
  const fan = new THREE.Mesh(fanGeo, light(`uniform float uK, uTime; varying vec2 vUv;
    void main(){ float x = (vUv.x - 0.5)/max(vUv.y, 0.02) + 0.5, ray = 0.6 + 0.4*sin(x*90.0 + uTime*3.0);
      gl_FragColor = vec4(${CY}*pow(vUv.y, 1.6)*ray*0.42*uK, 1.0); }`, { uK: uScanK, uTime }, { depthTest: false }));
  fan.frustumCulled = false; fan.renderOrder = 19; root.add(fan);

  // ---- the hologram: a frame with a dark veil behind the words, and a curtain of light rising to it from the book
  const uOpen = { value: 0 }, uReveal = { value: 0 }, uSize = { value: new THREE.Vector2(800, 500) };
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,     // over whatever stands in its rectangle (the Library's drone reaches in front of it)
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uOpen, uReveal, uSize, uTime },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform float uOpen, uReveal, uTime; uniform vec2 uSize; varying vec2 vUv;
      void main(){
        if (vUv.y > uOpen) discard;                            // unfolds upward from the edge over the book
        vec2 p = vUv*uSize, q = min(p, uSize - p);             // CSS pixels from the nearest edges
        float edge = 1.0 - smoothstep(0.0, 1.6, min(q.x, q.y));
        float tick = max(step(q.x, 22.0)*step(q.y, 3.0), step(q.y, 22.0)*step(q.x, 3.0));
        float lead = exp(-pow((uOpen - vUv.y)*uSize.y/5.0, 2.0))*(1.0 - step(0.999, uOpen));
        float v = 1.0 - vUv.y, line = exp(-pow((uReveal - v)*uSize.y/2.5, 2.0))*step(0.001, uReveal)*(1.0 - step(0.999, uReveal));
        float rows = 0.5 + 0.5*sin(p.y*1.5708);
        vec3 c = ${CY}*(edge*0.30 + tick*1.1 + lead*2.2 + line*1.6 + 0.004*rows + 0.01*(1.0 - smoothstep(0.0, 90.0, q.y)));
        gl_FragColor = vec4(vec3(0.0022, 0.006, 0.0095) + c, 0.998);      // what is behind all but goes out: the words must be easy to read
      }` }));
  panel.renderOrder = 8; panel.visible = false; root.add(panel);
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  beamGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)); beamGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const uBeam = { value: 0 };
  const beam = new THREE.Mesh(beamGeo, light(`uniform float uK, uTime; varying vec2 vUv;
    void main(){ float s = 0.55 + 0.45*sin(vUv.x*70.0 + sin(vUv.x*13.0)*4.0), rise = 0.7 + 0.3*sin(vUv.y*26.0 - uTime*mix(0.5, 5.0, smoothstep(0.35, 0.9, uK)) + vUv.x*9.0);    // lively while it unfolds, then nearly still
      float side = smoothstep(0.0, 0.08, vUv.x)*smoothstep(1.0, 0.92, vUv.x);
      gl_FragColor = vec4(${CY}*s*rise*side*pow(1.0 - vUv.y, 1.3)*0.5*uK, 1.0); }`, { uK: uBeam, uTime }));
  beam.frustumCulled = false; beam.renderOrder = 7; root.add(beam);

  // ---- the words: one element over the canvas, holding the article
  const host = Object.assign(document.createElement('div'), { id: 'reader', hidden: true });
  host.setAttribute('role', 'region'); host.setAttribute('aria-label', text.label);
  host.innerHTML = `<div class="reader-head"><span class="reader-mark">${text.mark}</span><span class="reader-title"></span><button class="reader-close" type="button">${text.back}</button></div>
    <nav class="reader-rail" aria-label="${text.contents}"><p>${text.contents}</p><ol></ol></nav>
    <div class="reader-scroll" tabindex="0"></div><div class="reader-progress"><i></i></div>`;
  document.body.append(host);
  const scroll = host.querySelector('.reader-scroll'), rail = host.querySelector('.reader-rail ol'), bar = host.querySelector('.reader-progress i');
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
  const px = { w: 800, h: 500, top: 76 }, pose = { pos: V(), tgt: V() }, _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _v = V(), _a = V(), _b = V(), _c = V(), UP = V(0, 1, 0);
  let offer = null, offeredBy = null, src = null, laid = null;   // offer(): the source that can be read now; src: the one being read; laid: the one the sheet lies on
  const current = () => src ?? offer?.() ?? null;
  function lay(s) {                                              // put the scan's sheet on a source (it also says where the glyph goes)
    if (s === laid) return; laid = s; sheet.removeFromParent(); if (!s) return;
    (s.sheet.parent ?? root).add(sheet); sheet.position.copy(s.sheet.position); sheet.quaternion.copy(s.sheet.quaternion); sheet.scale.set(...s.sheet.size, 1); sheet.updateMatrixWorld(true);
    tA.value = word(s.word ?? text.read);
  }
  function layout() {
    const s = current(); if (!s) return pose;
    const W = innerWidth, H = innerHeight, phone = W < 720, tan = Math.tan(rad(camera.fov / 2)), bottom = phone ? 132 : 130, facing = s.facing;
    px.top = phone ? 58 : 76; px.w = Math.round(Math.min(1040, W - (phone ? 12 : 80))); px.h = Math.round(H - px.top - bottom);
    const span = s.span ?? Math.min(0.6, s.sheet.size[0]), k = span / Math.min(clamp(H * 0.4, 220, 480), W * 0.6), d = k * H / (2 * tan);      // k: metres per pixel at the hologram; d: how far back that puts the eye
    const foot = s.foot(), at = foot.clone().addScaledVector(facing, 0.22), eyeY = foot.y + (H / 2 - bottom * 0.45) * k;        // what is read shows in the strip left under the frame
    pose.tgt.set(at.x, eyeY, at.z); pose.pos.copy(pose.tgt).addScaledVector(facing, d);
    panel.position.set(at.x, eyeY + (H / 2 - (px.top + px.h / 2)) * k, at.z); panel.scale.set(px.w * k, px.h * k, 1); panel.lookAt(_v.copy(panel.position).add(facing)); panel.updateMatrixWorld();
    uSize.value.set(px.w, px.h); host.style.width = `${px.w}px`; host.style.height = `${px.h}px`; host.classList.toggle('phone', phone);
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
  let state = 'closed', t0 = 0, folding = 0, ready = false;
  function read() {
    const s = offer?.(); if (!s || state !== 'closed') return false;
    src = s; state = 'scanning'; t0 = uTime.value - (still ? 9 : 0); ready = false; folding = 0; lay(s);
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
    state = 'closed'; src = null; folding = uTime.value; host.hidden = true; host.classList.remove('open');
    if (host.contains(document.activeElement)) document.activeElement.blur();
  }
  host.querySelector('.reader-close').addEventListener('click', () => onLink(null));
  const onResize = () => { if (state !== 'closed') layout(); };
  addEventListener('resize', onResize);

  function update(t) {
    const T = t - t0, on = state !== 'closed', s = current(), can = !!s; lay(s);
    // READ: there while something can be read and nothing is; sized on screen, not in the room, so it can be tapped on a phone
    uShow.value += ((can && (!on || T < SWEEP[0] + 0.5) ? 1 : 0) - uShow.value) * 0.14; uWord.value += ((on ? 1 : 0) - uWord.value) * 0.25;
    glyph.visible = uShow.value > 0.01 && !!laid;
    if (glyph.visible) {                                       // its top edge a few pixels under the thing, never off the bottom of the view
      const tan = Math.tan(rad(camera.fov / 2)), fwd = camera.getWorldDirection(_b), up = _a.copy(UP).applyQuaternion(camera.quaternion);
      sheet.localToWorld(_v.set(0, -0.5, 0)); _c.copy(_v).sub(camera.position);
      const depth = Math.max(0.3, _c.dot(fwd)), m = 2 * depth * tan / innerHeight, w = clamp(innerWidth * 0.2, 104, 168) * m, h = w / 3;       // m: metres per pixel there
      // ... and clear of the page's controls under it: a touch that lands near a button is given to the button
      const x = (_v.clone().project(camera).x * 0.5 + 0.5) * innerWidth, half = w / m / 2 + 28, taken = clearance?.(x - half, x + half) ?? 0;
      const low = _c.dot(up) - 14 * m - h / 2, floor = -depth * tan + (taken ? taken + 34 : 10) * m + h / 2;
      glyph.position.copy(_v).addScaledVector(up, Math.max(low, floor) - _c.dot(up)); glyph.quaternion.copy(camera.quaternion); glyph.scale.setScalar(w / 3);
    }
    // the scan
    const sweep = on ? ramp(T, SWEEP) : 0; uScan.value = sweep * 1.04; uScanK.value += ((on && T < SWEEP[1] + 0.25 ? 1 : 0) - uScanK.value) * 0.2;
    sheet.visible = fan.visible = uScanK.value > 0.01 && !!laid;
    if (fan.visible) {                                          // from just under the visitor's eye to the line on what is read
      const p = fanGeo.attributes.position, y = 0.5 - uScan.value;
      p.setXYZ(0, ..._v.copy(camera.position).addScaledVector(camera.getWorldDirection(_b), 0.5).addScaledVector(_a.copy(UP).applyQuaternion(camera.quaternion), -0.56 * Math.tan(rad(camera.fov / 2))).toArray());   // just under the bottom edge of the view
      p.setXYZ(1, ...sheet.localToWorld(_v.set(-0.5, y, 0)).toArray()); p.setXYZ(2, ...sheet.localToWorld(_v.set(0.5, y, 0)).toArray()); p.needsUpdate = true;
    }
    // the hologram
    const open = on ? ramp(T, UNFOLD) : Math.max(0, uOpen.value - (still ? 1 : (t - folding) > 0 ? 0.09 : 0));
    uOpen.value = open; uReveal.value = on ? ramp(T, REVEAL) : 0; panel.visible = open > 0.002;
    uBeam.value += ((on && T > UNFOLD[0] ? (T < REVEAL[1] ? 1 : 0.32) : 0) - uBeam.value) * 0.12; beam.visible = uBeam.value > 0.01 && !!laid;
    if (beam.visible) {                                         // from the edge of what is read that is nearest the frame: its top if it lies under it (sheet.top), else its foot
      const p = beamGeo.attributes.position, y = laid.sheet.top ? 0.5 : -0.5;
      const reach = Math.min(1, 0.75 * sheet.scale.x / panel.scale.x);
      p.setXYZ(0, ...sheet.localToWorld(_v.set(-0.5, y, 0)).toArray()); p.setXYZ(1, ...sheet.localToWorld(_v.set(0.5, y, 0)).toArray());
      p.setXYZ(2, ...panel.localToWorld(_v.set(-reach / 2, -0.5, 0)).toArray()); p.setXYZ(3, ...panel.localToWorld(_v.set(reach / 2, -0.5, 0)).toArray()); p.needsUpdate = true;
    }
    // the words follow the reveal line down the frame, then are simply there
    if (on && T >= REVEAL[0] && ready) {
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
    settled: () => state === 'open' && uTime.value - t0 > REVEAL[1] + 0.8,
    /** Go to a heading of the article that is open (by id; none: its top). */
    jump(id) { const h = id && scroll.querySelector(`#${CSS.escape(id)}`); if (h) h.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); else scroll.scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' }); },
    /** Open the next article at this heading (by id): where the reader had got to on the plain page. */
    scrollTo(id) { goTo = id; },
    dispose() { removeEventListener('resize', onResize); host.remove(); for (const w of words.values()) w.dispose(); sheet.removeFromParent(); },
  };
}
