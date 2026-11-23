// The Library's reader. A volume lies open on the drone's tray, and a READ glyph from the visitor's own display floats
// under it. Asked to read, a fan of light from the visitor sweeps the pages, and the article stands up over the book
// as a hologram.
// The article is not a texture. It is the post's own <article> (the HTML of its page, written by tools/site.py), laid
// over the canvas and moved with the camera so that it sits in the hologram's frame. Once the camera has come to rest
// it is an ordinary upright element at its natural size: sharp, selectable, searchable, read by screen readers, and
// its links work. Everything that is light (the frame and its veil, the beam, the scan) is drawn in the scene.
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

/**
 * @param drone    the catalogue drone (js/drone.js): open() names the volume lying open, book() is that book
 * @param facing   horizontal unit vector from the book toward where the reader stands
 * @param text     the room's "reader" words (content.json);  onLink(href): a link in the article that leads elsewhere on the site
 */
export function createReader({ scene, camera, drone, volumes, facing, text, onLink }) {
  const root = new THREE.Group(); root.name = 'Reader'; scene.add(root);
  const [BOOK_W, BOOK_H] = drone.size;

  // ---- READ: a glyph under the book, always facing the visitor and drawn over everything, like the rest of their display
  const uShow = { value: 0 }, uWord = { value: 0 }, words = [glyphTex(text.read), glyphTex(text.scanning)];
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(3, 1), light(`uniform sampler2D tA, tB; uniform float uShow, uWord, uTime; varying vec2 vUv;
    void main(){
      float open = smoothstep(0.0, 1.0, uShow), w = abs(vUv.x - 0.5)*2.0;
      if (w > open) discard;                                   // pops open from its middle
      float ink = mix(texture2D(tA, vUv).r, texture2D(tB, vUv).r, uWord);
      float sweep = exp(-pow((vUv.x - fract(uTime*0.45)*1.6 + 0.3)*7.0, 2.0));
      float lead = exp(-pow((open - w)*30.0, 2.0))*(1.0 - open);
      vec3 c = ${CY}*(ink*(0.75 + 0.2*sin(uTime*2.6)) + 0.012) + vec3(0.7, 0.95, 1.0)*(ink*sweep*0.9 + lead*1.5);
      gl_FragColor = vec4(c*2.4, 1.0);
    }`, { tA: { value: words[0] }, tB: { value: words[1] }, uShow, uWord, uTime }, { depthTest: false }));
  glyph.renderOrder = 20; glyph.frustumCulled = false; root.add(glyph);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.3), new THREE.MeshBasicMaterial({ visible: false })); glyph.add(hit);

  // ---- the scan: a line of light crossing the pages, and the fan from the visitor that draws it
  const uScan = { value: 0 }, uScanK = { value: 0 };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(BOOK_W, BOOK_H).rotateX(-Math.PI / 2), light(`uniform float uScan, uK, uTime; varying vec2 vUv;
    void main(){
      float v = 1.0 - vUv.y, d = uScan - v;                    // v: from the top of the page down
      float line = exp(-pow(d*90.0, 2.0)), read = step(0.0, d)*exp(-d*5.0);
      float grid = step(0.86, fract(vUv.x*24.0)) + step(0.8, fract(v*34.0));
      gl_FragColor = vec4(${CY}*(line*3.2 + read*(0.10 + 0.22*grid))*uK, 1.0);
    }`, { uScan, uK: uScanK, uTime }));
  sheet.position.y = 0.046; sheet.renderOrder = 9;
  const fanGeo = new THREE.BufferGeometry(); fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  fanGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0.5, 0, 0, 1, 1, 1]), 2));
  const fan = new THREE.Mesh(fanGeo, light(`uniform float uK, uTime; varying vec2 vUv;
    void main(){ float x = (vUv.x - 0.5)/max(vUv.y, 0.02) + 0.5, ray = 0.6 + 0.4*sin(x*90.0 + uTime*3.0);
      gl_FragColor = vec4(${CY}*pow(vUv.y, 1.6)*ray*0.42*uK, 1.0); }`, { uK: uScanK, uTime }, { depthTest: false }));
  fan.frustumCulled = false; fan.renderOrder = 19; root.add(fan);

  // ---- the hologram: a frame with a dark veil behind the words, and a curtain of light rising to it from the book
  const uOpen = { value: 0 }, uReveal = { value: 0 }, uSize = { value: new THREE.Vector2(800, 500) };
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
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
        gl_FragColor = vec4(vec3(0.0022, 0.006, 0.0095) + c, 0.994);      // what is behind all but goes out: the words must be easy to read
      }` }));
  panel.renderOrder = 8; panel.visible = false; root.add(panel);
  const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  beamGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2)); beamGeo.setIndex([0, 1, 2, 2, 1, 3]);
  const uBeam = { value: 0 };
  const beam = new THREE.Mesh(beamGeo, light(`uniform float uK, uTime; varying vec2 vUv;
    void main(){ float s = 0.55 + 0.45*sin(vUv.x*70.0 + sin(vUv.x*13.0)*4.0), rise = 0.7 + 0.3*sin(vUv.y*26.0 - uTime*5.0 + vUv.x*9.0);
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
  const articles = new Map();                                   // slug -> its <article>, kept once fetched
  async function article(slug) {
    if (articles.has(slug)) return articles.get(slug);
    let el = document.querySelector(`#page article.post[data-slug="${CSS.escape(slug)}"]`);           // this page's own article
    if (!el) {
      const r = await fetch(`blog/${slug}/`); if (!r.ok) throw new Error(`blog/${slug}/: ${r.status}`);
      el = new DOMParser().parseFromString(await r.text(), 'text/html').querySelector('article.post');
      if (!el) throw new Error(`blog/${slug}/ has no article`);
      el = document.adoptNode(el);
    }
    for (const pre of el.querySelectorAll('pre')) {              // code can be copied
      const b = Object.assign(document.createElement('button'), { className: 'copy', type: 'button', textContent: text.copy }); pre.before(b);
      b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); b.textContent = text.copied; setTimeout(() => { b.textContent = text.copy; }, 1600); } catch { /* no clipboard: select it by hand */ } });
    }
    articles.set(slug, el); return el;
  }
  let heads = [], goTo = null;
  function show(el) {
    scroll.replaceChildren(el); scroll.scrollTop = 0;
    host.querySelector('.reader-title').textContent = el.querySelector('h1')?.textContent ?? '';
    heads = [...el.querySelectorAll('.post-body h2[id]')];
    rail.replaceChildren(...heads.map((h) => { const li = document.createElement('li'), a = Object.assign(document.createElement('a'), { href: `#${h.id}`, textContent: h.textContent }); li.append(a); return li; }));
    progress();
  }
  function progress() {
    const max = scroll.scrollHeight - scroll.clientHeight; bar.style.transform = `scaleX(${max > 0 ? scroll.scrollTop / max : 1})`;
    const y = scroll.getBoundingClientRect().top + 90; let now = -1; heads.forEach((h, i) => { if (h.getBoundingClientRect().top < y) now = i; });
    [...rail.children].forEach((li, i) => li.toggleAttribute('aria-current', i === now));
  }
  scroll.addEventListener('scroll', progress, { passive: true });
  host.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) { e.preventDefault(); scroll.querySelector(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); }
    else if (href.startsWith('/') && onLink(href) !== false) e.preventDefault();       // a post or a room: the station goes there itself
  });

  // ---- where things stand. The hologram's size is chosen in CSS pixels first, then placed in the room at the scale
  // that makes one of its pixels one pixel on screen from the reading pose; so at rest the words need no transform.
  const px = { w: 800, h: 500, top: 76 }, pose = { pos: V(), tgt: V() }, bookAt = V(), _m = new THREE.Matrix4(), _n = new THREE.Matrix4(), _v = V(), _a = V(), _b = V();
  function layout() {
    const W = innerWidth, H = innerHeight, phone = W < 720, tan = Math.tan(rad(camera.fov / 2)), bottom = phone ? 132 : 130;
    px.top = phone ? 58 : 76; px.w = Math.round(Math.min(1040, W - (phone ? 12 : 80))); px.h = Math.round(H - px.top - bottom);
    const k = BOOK_W / Math.min(clamp(H * 0.4, 220, 480), W * 0.6), d = k * H / (2 * tan);      // k: metres per pixel at the hologram; d: how far back that puts the eye
    (drone.book() ?? drone.root).getWorldPosition(bookAt);
    const at = bookAt.clone().addScaledVector(facing, 0.22), eyeY = bookAt.y + (H / 2 - bottom * 0.45) * k;        // the book shows in the strip left under the frame
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
  let state = 'closed', slug = null, t0 = 0, folding = 0, ready = false, attached = null;
  const book = () => drone.book(), openVolume = () => drone.open();
  function read() {
    const i = openVolume(); if (i < 0 || state !== 'closed') return false;
    slug = volumes[i].slug; state = 'scanning'; t0 = uTime.value - (still ? 9 : 0); ready = false; folding = 0;
    article(slug).then(show, (err) => { console.error(err); const p = Object.assign(document.createElement('p'), { className: 'reader-error', textContent: text.failed }); scroll.replaceChildren(p); })
      .finally(() => { ready = true; });
    const b = book(); if (attached !== b) { attached?.remove(sheet); b.add(sheet); attached = b; }
    return true;
  }
  function close() {
    if (state === 'closed') return;
    state = 'closed'; slug = null; folding = uTime.value; host.hidden = true; host.classList.remove('open');
    if (host.contains(document.activeElement)) document.activeElement.blur();
  }
  host.querySelector('.reader-close').addEventListener('click', () => onLink(null));
  addEventListener('resize', () => { if (state !== 'closed') layout(); });

  function update(t) {
    const can = openVolume() >= 0, T = t - t0, on = state !== 'closed';
    // READ: there while a book lies open and nothing is being read; sized on screen, not in the room, so it can be tapped on a phone
    uShow.value += ((can && (!on || T < SWEEP[0] + 0.5) ? 1 : 0) - uShow.value) * 0.14; uWord.value += ((on ? 1 : 0) - uWord.value) * 0.25;
    glyph.visible = uShow.value > 0.01;
    if (glyph.visible && book()) {                            // its top edge a few pixels under the book, never off the bottom of the view
      const tan = Math.tan(rad(camera.fov / 2)), fwd = camera.getWorldDirection(_b), up = _a.set(0, 1, 0).applyQuaternion(camera.quaternion);
      book().localToWorld(_v.set(0, 0, BOOK_H / 2 + 0.03));
      const depth = _v.clone().sub(camera.position).dot(fwd), m = 2 * depth * tan / innerHeight, w = clamp(innerWidth * 0.2, 104, 168) * m, h = w / 3;       // m: metres per pixel there
      const low = _v.clone().sub(camera.position).dot(up) - 8 * m - h / 2, floor = -depth * tan + 10 * m + h / 2;
      glyph.position.copy(_v).addScaledVector(up, Math.max(low, floor) - _v.clone().sub(camera.position).dot(up)); glyph.quaternion.copy(camera.quaternion); glyph.scale.setScalar(w / 3);
    }
    // the scan
    const sweep = on ? ramp(T, SWEEP) : 0; uScan.value = sweep * 1.04; uScanK.value += ((on && T < SWEEP[1] + 0.25 ? 1 : 0) - uScanK.value) * 0.2;
    sheet.visible = fan.visible = uScanK.value > 0.01 && !!attached;
    if (fan.visible) {                                          // from just under the visitor's eye to the line on the page
      const p = fanGeo.attributes.position, z = (uScan.value - 0.5) * BOOK_H;
      p.setXYZ(0, ..._v.copy(camera.position).addScaledVector(camera.getWorldDirection(_b), 0.5).addScaledVector(_a.set(0, 1, 0).applyQuaternion(camera.quaternion), -0.56 * Math.tan(rad(camera.fov / 2))).toArray());   // just under the bottom edge of the view
      p.setXYZ(1, ...attached.localToWorld(_v.set(-BOOK_W / 2, 0.046, z)).toArray()); p.setXYZ(2, ...attached.localToWorld(_v.set(BOOK_W / 2, 0.046, z)).toArray()); p.needsUpdate = true;
    }
    // the hologram
    const open = on ? ramp(T, UNFOLD) : Math.max(0, uOpen.value - (still ? 1 : (t - folding) > 0 ? 0.09 : 0));
    uOpen.value = open; uReveal.value = on ? ramp(T, REVEAL) : 0; panel.visible = open > 0.002;
    uBeam.value += ((on && T > UNFOLD[0] ? (T < REVEAL[1] ? 1 : 0.32) : 0) - uBeam.value) * 0.12; beam.visible = uBeam.value > 0.01 && !!attached;
    if (beam.visible) {
      const p = beamGeo.attributes.position, half = Math.min(BOOK_W, panel.scale.x) / 2 / panel.scale.x;
      p.setXYZ(0, ...attached.localToWorld(_v.set(-BOOK_W / 2, 0.04, -BOOK_H / 2)).toArray()); p.setXYZ(1, ...attached.localToWorld(_v.set(BOOK_W / 2, 0.04, -BOOK_H / 2)).toArray());
      p.setXYZ(2, ...panel.localToWorld(_v.set(-half * 1.5, -0.5, 0)).toArray()); p.setXYZ(3, ...panel.localToWorld(_v.set(half * 1.5, -0.5, 0)).toArray()); p.needsUpdate = true;
    }
    // the words follow the reveal line down the frame, then are simply there
    if (on && T >= REVEAL[0] && ready) {
      if (host.hidden) { host.hidden = false; if (goTo) { scroll.querySelector(`#${CSS.escape(goTo)}`)?.scrollIntoView({ block: 'start' }); goTo = null; } progress(); }
      const r = Math.max(uReveal.value, still ? 1 : 0);
      if (r < 1) host.style.clipPath = `inset(0 0 ${((1 - r) * 100).toFixed(2)}% 0)`;
      else if (state === 'scanning') { state = 'open'; host.style.clipPath = ''; host.classList.add('open'); if (matchMedia('(pointer: fine)').matches) scroll.focus({ preventScroll: true }); }
      place();
    }
  }
  return {
    root, hit, update, read, close, pose: layout,
    /** A book lies open and can be read. */
    available: () => openVolume() >= 0 && state === 'closed',
    state: () => state, slug: () => slug,
    /** Open the next article at this heading (by id): where the reader had got to on the plain page. */
    scrollTo(id) { goTo = id; },
    dispose() { host.remove(); for (const w of words) w.dispose(); attached?.remove(sheet); },
  };
}
