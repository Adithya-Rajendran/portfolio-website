// The Library's page: a drone that rests in a cradle on the reading table. Asked for a volume at the terminal, it lifts
// off, flies to that volume's place on the shelves, takes the book onto the tray under its belly and brings it to the
// reader; there the tray lowers and tilts like a lectern and the book opens at its index page.
// Drone and book are the only things in the room drawn live rather than baked. They are ordinary PBR materials lit by
// an environment map that room.js renders from the baked room itself, so they sit in the room's own light.
// The volumes (number, title, two lines, the rows of the index) come from content.json ("volumes").
import * as THREE from 'three';
import { GLOW, V, glow, spring } from './kit.js';

const TAU = 6.2832, PI = Math.PI, SPEED = 3.2, ease = (x) => x * x * (3 - 2 * x), turnTo = (a, b) => ((b - a + PI) % TAU + TAU) % TAU - PI;
const std = (color, metalness, roughness, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
const LEATHER = [[0.3, 0.05, 0.04], [0.04, 0.1, 0.2], [0.07, 0.17, 0.1], [0.33, 0.15, 0.04], [0.16, 0.07, 0.13], [0.1, 0.1, 0.11]];

// ---- text and texture, drawn once into canvases
function canvasTex(w, h, draw) {
  const cv = Object.assign(document.createElement('canvas'), { width: w, height: h }), c = cv.getContext('2d'); draw(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const SERIF = 'Georgia, "Times New Roman", serif', SANS = '"Helvetica Neue", "Segoe UI", Arial, sans-serif', INK = '#2a1c12', RULE = '#8a5a22';
function paper(c, w, h, gutter) {                                  // gutter: -1 = spine on the left edge, 1 = on the right
  c.fillStyle = '#e9dfc8'; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(gutter < 0 ? 0 : w, 0, gutter < 0 ? w * 0.22 : w * 0.78, 0); g.addColorStop(0, 'rgba(60,40,20,0.45)'); g.addColorStop(1, 'rgba(60,40,20,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = RULE; c.lineWidth = 2; c.strokeRect(54, 54, w - 108, h - 108); c.textBaseline = 'alphabetic';
}
function wrap(c, text, x, y, width, lead) { let line = ''; for (const word of text.split(' ')) { if (c.measureText(line + word).width > width && line) { c.fillText(line.trim(), x, y); y += lead; line = ''; } line += word + ' '; } c.fillText(line.trim(), x, y); return y + lead; }
const leftPage = (v) => canvasTex(768, 1064, (c, w, h) => {
  paper(c, w, h, 1); c.fillStyle = RULE; c.font = `600 34px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '8px'; c.fillText(`VOLUME ${v.no}`, 96, 160);
  if ('letterSpacing' in c) c.letterSpacing = '0px'; c.fillStyle = INK; c.font = `400 96px ${SERIF}`; let y = wrap(c, v.title, 96, 300, w - 190, 108);
  c.fillStyle = RULE; c.fillRect(96, y - 30, 120, 3); c.fillStyle = INK; c.font = `italic 400 44px ${SERIF}`; y += 50;
  for (const l of v.lines || []) y = wrap(c, l, 96, y, w - 190, 60) + 18;
  c.font = `400 30px ${SERIF}`; c.textAlign = 'center'; c.fillStyle = RULE; c.fillText('❦', w / 2, h - 120);
});
const rightPage = (v) => canvasTex(768, 1064, (c, w, h) => {
  paper(c, w, h, -1); c.fillStyle = RULE; c.font = `600 34px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '8px'; c.fillText('INDEX', 96, 160); if ('letterSpacing' in c) c.letterSpacing = '0px';
  v.rows.forEach(([k, val], i) => {
    const y = 290 + i * 190; c.fillStyle = RULE; c.font = `600 36px ${SANS}`; c.fillText(k, 96, y); c.fillStyle = INK; c.font = `400 64px ${SERIF}`; c.fillText(val, 96, y + 78, w - 192);
    c.fillStyle = 'rgba(138,90,34,0.5)'; c.fillRect(96, y + 110, w - 192, 2);
  });
  c.fillStyle = RULE; c.font = `600 20px ${SANS}`; c.textAlign = 'right'; c.fillText(v.no, w - 96, h - 96);
});
const edges = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#d9cfb6'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(90,70,40,${0.12 + 0.25 * Math.random()})`; c.fillRect(0, y, w, 1); } });
const gilt = (no) => canvasTex(512, 720, (c, w, h) => {            // tooling on the front board: a double frame, the number, a small device
  c.strokeStyle = c.fillStyle = '#e2b866'; c.lineWidth = 5; c.strokeRect(34, 34, w - 68, h - 68); c.lineWidth = 2; c.strokeRect(50, 50, w - 100, h - 100);
  c.textAlign = 'center'; c.font = `400 120px ${SERIF}`; c.fillText(no, w / 2, 300); c.fillRect(w / 2 - 60, 340, 120, 3); c.font = `600 24px ${SANS}`; if ('letterSpacing' in c) c.letterSpacing = '10px'; c.fillText('ARCADIA', w / 2 + 5, 400);
  c.beginPath(); c.arc(w / 2, 540, 34, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(w / 2, 540, 54, 16, -0.4, 0, TAU); c.stroke();
});

// ---- the book: two halves on a spine, so it opens in the middle and lies flat. x: across the pages, -z: top of the page.
const BW = 0.25, BH = 0.35, BT = 0.046;
function makeBook(v, i, mats) {
  const book = new THREE.Group(), left = new THREE.Group(), spine = new THREE.Group(), half = BT / 2, board = 0.004, [r, g, b] = LEATHER[i % LEATHER.length];
  const leather = std(new THREE.Color(r, g, b), 0, 0.55), pagesMat = std(0xffffff, 0, 0.9, { map: edges }), brass = mats.brass;
  // Leaves rise slightly beside the sewn gutter when open, then settle toward the fore edge.
  // Morph from flat so the two printed faces still meet when the boards are closed.
  const page = (tex, gutter) => {
    const geom = new THREE.PlaneGeometry(BW - 0.014, BH - 0.018, 24, 1).rotateX(-PI / 2);
    const flat = geom.attributes.position, bent = flat.clone();
    for (let j = 0; j < flat.count; j++) {
      const u = geom.attributes.uv.getX(j), t = gutter === 'left' ? u : 1 - u;
      bent.setY(j, .014 * Math.sin(Math.PI * t) * Math.exp(-5 * t));
    }
    geom.morphAttributes.position = [bent];
    return new THREE.Mesh(geom, std(0xffffff, 0, 0.85, { map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 }));
  };
  const box = (parent, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
  // right half: the back board, half the leaves, the page that shows when it is open
  box(book, BW + 0.004, board, BH, BW / 2 + 0.002, board / 2, 0, leather); box(book, BW - 0.008, half - board, BH - 0.012, BW / 2 - 0.004, (half + board) / 2, 0, pagesMat);
  const pr = page(rightPage(v), 'left'); pr.position.set(BW / 2 - 0.004, half + 0.0006, 0); book.add(pr);
  // left half: turns about the spine. Built in its closed pose (lying on top of the right half).
  left.position.set(0, half, 0); book.add(left);
  box(left, BW - 0.008, half - board, BH - 0.012, BW / 2 - 0.004, (half - board) / 2, 0, pagesMat); box(left, BW + 0.004, board, BH, BW / 2 + 0.002, half - board / 2, 0, leather);
  const pl = page(leftPage(v), 'right'); pl.rotation.z = PI; pl.position.set(BW / 2 - 0.004, -0.0006, 0); left.add(pl);
  const tool = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.02, BH - 0.02).rotateX(-PI / 2), std(0xffffff, 1, 0.3, { map: gilt(v.no), transparent: true, alphaTest: 0.3 })); tool.position.set(BW / 2, half + 0.0006, 0); left.add(tool);
  // the spine turns half as far, so it ends up flat under the gutter; raised bands and a gilt label on it
  book.add(spine); box(spine, 0.006, BT, BH, -0.003, half, 0, leather);
  for (const z of [-0.12, -0.06, 0.06, 0.12]) box(spine, 0.009, BT + 0.002, 0.007, -0.0035, half, z, leather);
  box(spine, 0.0065, BT * 0.7, 0.04, -0.0034, half, -0.005, brass);
  box(book, 0.012, 0.0008, 0.07, BW * 0.55, half + 0.001, BH / 2 + 0.02, std(0x7a1410, 0, 0.7));       // a ribbon marker
  book.userData.open = (k) => { left.rotation.z = k * PI; spine.rotation.z = k * PI / 2; pl.morphTargetInfluences[0] = pr.morphTargetInfluences[0] = k; };
  return book;
}

/** @param dock, deliver, slots  three.js positions: the cradle, where it presents the book, each volume's place on the shelves */
export function createDrone({ scene, dock, deliver, slots, volumes }) {
  const root = new THREE.Group(), body = new THREE.Group(), casters = [], rotors = [], discs = [];
  const M = { graphite: std(0x23252a, 0.7, 0.4), ceramic: std(0xd9d4c8, 0, 0.32), brass: std(new THREE.Color(0.86, 0.6, 0.3), 1, 0.26), rubber: std(0x0a0a0b, 0, 0.9),
    glass: std(0x04060a, 0.2, 0.04), blade: std(0x15161a, 0.4, 0.5, { transparent: true }) };
  const add = (parent, geo, mat, set) => { const m = new THREE.Mesh(geo, mat); set?.(m); parent.add(m); if (mat.isMeshStandardMaterial && !mat.transparent) casters.push(m); return m; };
  const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const between = (a, b, r0, r1, mat, parent = body) => add(parent, new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 10), mat, (m) => { m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); });

  // ---- hull: a graphite keel under a ceramic fairing, a brass seam between them, a dark dome on top
  const hull = new THREE.Group(); hull.scale.set(1, 1, 1.28); body.add(hull);
  add(hull, lathe([[0, -0.05], [0.05, -0.05], [0.098, -0.036], [0.124, -0.012], [0.129, 0.004]]), M.graphite);
  add(hull, lathe([[0.129, 0.008], [0.122, 0.028], [0.098, 0.046], [0.06, 0.057], [0.036, 0.06]]), M.ceramic);
  add(hull, new THREE.TorusGeometry(0.129, 0.0045, 8, 64), M.brass, (m) => { m.rotation.x = PI / 2; m.position.y = 0.006; });
  add(body, new THREE.SphereGeometry(0.04, 24, 12, 0, TAU, 0, PI / 2), M.glass, (m) => { m.position.y = 0.056; m.scale.y = 0.55; });
  add(body, new THREE.TorusGeometry(0.04, 0.004, 8, 32), M.brass, (m) => { m.rotation.x = PI / 2; m.position.y = 0.058; });
  for (let i = -2; i <= 2; i++) add(body, new THREE.BoxGeometry(0.003, 0.004, 0.05), M.graphite, (m) => m.position.set(i * 0.02, 0.05 - Math.abs(i) * 0.004, 0.1));     // cooling fins aft
  between(V(0.03, 0.058, 0.05), V(0.05, 0.14, 0.09), 0.0025, 0.0012, M.graphite);                                                  // a whip aerial
  const tip = add(body, new THREE.SphereGeometry(0.005, 8, 6), glow(new THREE.Color(2.4, 0.5, 0.2)), (m) => m.position.set(0.05, 0.142, 0.09));
  // ---- the eye: a gimballed camera at the front, with a second small lens beside it
  const gimbal = new THREE.Group(); gimbal.position.set(0, -0.012, -0.158); body.add(gimbal);
  add(gimbal, new THREE.CylinderGeometry(0.034, 0.03, 0.05, 24), M.graphite, (m) => { m.rotation.x = PI / 2; });
  add(gimbal, new THREE.TorusGeometry(0.031, 0.005, 8, 32), M.brass, (m) => { m.position.z = -0.025; });
  add(gimbal, new THREE.SphereGeometry(0.026, 24, 16), M.glass, (m) => { m.position.z = -0.022; m.scale.z = 0.6; });
  const iris = add(gimbal, new THREE.TorusGeometry(0.013, 0.0022, 6, 32), glow(new THREE.Color(0.4, 1.5, 2.4)), (m) => { m.position.z = -0.038; });
  const pupil = add(gimbal, new THREE.CircleGeometry(0.005, 16), glow(new THREE.Color(0.8, 2.0, 2.6)), (m) => { m.position.z = -0.0385; m.rotation.y = PI; });
  add(body, new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12), M.glass, (m) => { m.rotation.x = PI / 2; m.position.set(0.05, -0.002, -0.15); });
  const leds = [-1, 0, 1].map((i) => add(body, new THREE.SphereGeometry(0.0035, 8, 6), glow(new THREE.Color(2.2, 1.2, 0.4)), (m) => m.position.set(i * 0.014, 0.012, 0.166)));
  // ---- four ducted rotors on arms: motor pod, three stator struts, the duct with a brass lip, a three-bladed rotor, a foot
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = V(sx * 0.215, 0.014, sz * 0.195), root_ = V(sx * 0.1, 0.004, sz * 0.105), pod = new THREE.Group(); pod.position.copy(c); body.add(pod);
    between(root_, c, 0.017, 0.011, M.graphite); add(body, new THREE.SphereGeometry(0.02, 12, 8), M.ceramic, (m) => { m.position.copy(root_); m.scale.y = 0.7; });
    add(pod, new THREE.CylinderGeometry(0.02, 0.023, 0.044, 20), M.graphite); add(pod, new THREE.CylinderGeometry(0.014, 0.02, 0.008, 20), M.brass, (m) => { m.position.y = 0.026; });
    add(pod, new THREE.ConeGeometry(0.02, 0.03, 16), M.graphite, (m) => { m.position.y = -0.037; m.rotation.x = PI; });
    add(pod, new THREE.SphereGeometry(0.008, 10, 8), M.rubber, (m) => { m.position.y = -0.054; });
    add(pod, lathe([[0.094, -0.024], [0.104, -0.024], [0.111, -0.004], [0.108, 0.02], [0.1, 0.026], [0.094, 0.018], [0.092, -0.002], [0.094, -0.024]], 56), M.ceramic);
    add(pod, new THREE.TorusGeometry(0.1, 0.004, 8, 56), M.brass, (m) => { m.rotation.x = PI / 2; m.position.y = 0.026; });
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5; between(V(Math.cos(a) * 0.02, -0.012, Math.sin(a) * 0.02), V(Math.cos(a) * 0.095, -0.012, Math.sin(a) * 0.095), 0.004, 0.004, M.graphite, pod); }
    const rotor = new THREE.Group(); rotor.position.y = 0.012; pod.add(rotor); rotors.push(rotor);
    for (let k = 0; k < 3; k++) { const g = new THREE.Group(); g.rotation.y = k * TAU / 3; rotor.add(g); add(g, new THREE.BoxGeometry(0.07, 0.0025, 0.02), M.blade, (m) => { m.position.set(0.05, 0, 0); m.rotation.x = 0.3; }); }
    add(rotor, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), M.brass);
    discs.push(add(pod, new THREE.CircleGeometry(0.09, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.55, 0.7), opacity: 0, side: THREE.DoubleSide, ...GLOW }), (m) => { m.position.y = 0.012; m.rotation.x = -PI / 2; }));
    add(pod, new THREE.SphereGeometry(0.004, 8, 6), glow(sx < 0 ? new THREE.Color(2.2, 0.4, 0.2) : new THREE.Color(0.3, 2.0, 0.6)), (m) => m.position.set(sx * 0.108, 0, 0));   // running lights
  }
  // ---- the tray: carried flat under the belly with the book on it; to present, it drops on two rods and tilts like a lectern
  const tray = new THREE.Group(), TW = 0.56, TD = 0.4, HINGE = V(0, -0.105, 0.15); tray.position.copy(HINGE); body.add(tray);
  add(tray, new THREE.BoxGeometry(TW, 0.005, TD), M.graphite, (m) => m.position.set(0, -0.0025, -TD / 2));
  for (const sx of [-1, 1]) { add(tray, new THREE.BoxGeometry(0.006, 0.016, TD), M.brass, (m) => m.position.set(sx * TW / 2, 0.004, -TD / 2));
    add(tray, new THREE.CylinderGeometry(0.006, 0.006, 0.03, 10), M.brass, (m) => { m.rotation.z = PI / 2; m.position.set(sx * 0.07, -0.002, 0); }); }
  add(tray, new THREE.BoxGeometry(TW, 0.022, 0.006), M.brass, (m) => m.position.set(0, 0.008, -TD)); add(tray, new THREE.BoxGeometry(TW, 0.012, 0.006), M.brass, (m) => m.position.set(0, 0.003, 0));
  for (const x of [-0.14, 0.14]) add(tray, new THREE.BoxGeometry(0.03, 0.004, TD * 0.8), M.rubber, (m) => m.position.set(x, 0.001, -TD / 2));            // pads the book rests on
  const rods = [-1, 1].map((sx) => add(body, new THREE.CylinderGeometry(0.005, 0.005, 1, 8).translate(0, -0.5, 0), M.brass, (m) => m.position.set(sx * 0.07, -0.04, 0.15)));
  for (const sx of [-1, 1]) add(body, new THREE.BoxGeometry(0.02, 0.05, 0.03), M.graphite, (m) => m.position.set(sx * 0.07, -0.03, 0.13));
  // the books: one per volume, made once; the one in hand sits on the tray, turned to face whoever the drone faces
  const books = volumes.map((v, i) => { const b = makeBook(v, i, M); b.rotation.y = PI; b.position.set(0, 0.004, -TD / 2); b.visible = false; tray.add(b); return b; });
  for (const b of books) b.traverse((o) => { if (o.isMesh) casters.push(o); });
  for (const m of casters) m.layers.enable(1);                    // they cast shadows in the sunlight (see room.js)
  body.scale.setScalar(1.15); root.add(body); root.position.copy(dock); scene.add(root);

  // ---- flight: a queue of legs, each "go to p, then do this". Flying = any leg left, or away from the cradle.
  const legs = [], present = spring(0.07), opened = spring(0.06); let leg = null, held = -1, shown = -1, last = 0, lift = 0, yaw = 0, spin = 0; const hover = V().copy(dock), vel = V();
  const cruise = (p) => p.clone().setY(Math.max(p.y, deliver.y) + 0.5);                 // legs cross the room above head height
  const go = (p, then, wait = 0) => legs.push({ p: p?.clone(), then, wait });           // p = null: stay where it is
  const front = (s) => s.clone().setX(s.x - Math.sign(s.x) * 0.85);                     // hovering in front of a shelf slot
  const take = (i) => () => { held = i; books.forEach((b, k) => { b.visible = k === i; }); }, put = () => { held = -1; for (const b of books) b.visible = false; };
  /** Fetch volume i (returning the one it holds first); null sends it home. */
  function fetch(i) {
    if (i === shown && !legs.length) return;
    legs.length = 0; leg = null;
    if (shown >= 0) { shown = -1; go(null, null, 1.3); }                                // shut the book and stow the tray before moving off
    if (held >= 0 && held !== i) { go(cruise(front(slots[held]))); go(front(slots[held]), put, 0.5); go(cruise(front(slots[held]))); }
    if (i != null && held !== i) { go(cruise(front(slots[i]))); go(front(slots[i]), take(i), 0.6); go(cruise(front(slots[i]))); }
    if (i != null) { go(cruise(deliver)); go(deliver, () => { shown = i; }); } else { go(cruise(dock)); go(dock); }
  }

  function update(t) {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    if (!leg && legs.length) { const l = legs.shift(), from = hover.clone(), p = l.p || from; leg = { ...l, p, from, T: Math.max(0.4, from.distanceTo(p) / SPEED), k: 0, hold: l.wait }; }
    const before = hover.clone();
    if (leg) { leg.k = Math.min(1, leg.k + dt / leg.T); hover.lerpVectors(leg.from, leg.p, ease(leg.k)); if (leg.k === 1 && (leg.hold -= dt) <= 0) { leg.then?.(); leg = null; } }
    const flying = !!leg || legs.length > 0 || hover.distanceTo(dock) > 0.02;
    lift += ((flying ? 1 : 0) - lift) * Math.min(1, dt * 4);                             // rotors spin up before it moves much, and down after it lands
    vel.lerp(hover.clone().sub(before).divideScalar(dt || 1), 0.1);
    root.position.copy(hover); root.position.y += lift * 0.012 * Math.sin(t * 2.3);      // it never hangs quite still
    if (vel.lengthSq() > 0.04) yaw += turnTo(yaw, Math.atan2(-vel.x, -vel.z)) * Math.min(1, dt * 5);
    else if (shown >= 0) yaw += turnTo(yaw, PI) * Math.min(1, dt * 3);                   // turns to face the reader while it presents the book
    body.rotation.set(0, yaw, 0); body.rotateX(-0.05 * Math.hypot(vel.x, vel.z)); gimbal.rotation.x = 0.25 * Math.sin(t * 0.7) - 0.35 * present.x;      // leans into its flight; the eye looks about, then down at the page
    spin += dt * lift * 95; rotors.forEach((r, i) => { r.rotation.y = spin * (i % 2 ? 1 : -1); }); M.blade.opacity = 1 - 0.85 * lift;
    for (const [i, d] of discs.entries()) d.material.opacity = lift * (0.16 + 0.05 * Math.sin(t * 61 + i * 2.1));
    iris.material.color.setRGB(0.4, 1.5, 2.4).multiplyScalar(0.3 + 0.7 * lift); pupil.material.color.setRGB(0.8, 2.0, 2.6).multiplyScalar(0.3 + 0.7 * lift);
    tip.material.color.setRGB(2.4, 0.5, 0.2).multiplyScalar(lift * (Math.sin(t * 5) > 0.6 ? 1 : 0.15));
    leds.forEach((l, i) => l.material.color.setRGB(2.2, 1.2, 0.4).multiplyScalar(lift < 0.5 ? 0.2 + 0.2 * Math.sin(t * 1.5) : 0.4 + 0.6 * (Math.floor(t * 3) % 3 === i)));
    // presenting: the tray comes down and tilts, then the book opens; leaving, the same in reverse
    present.to = +(shown >= 0); opened.to = +(shown >= 0 && present.x > 0.9);
    const p = present.step(), o = opened.step(), drop = 0.24 * p;
    if (opened.x > 0.03) present.x = Math.max(present.x, 0.9);                           // the tray waits for the book to shut
    tray.position.set(HINGE.x, HINGE.y - drop, HINGE.z); tray.rotation.x = -0.96 * p; for (const r of rods) r.scale.y = 0.065 + drop;
    if (held >= 0) books[held].userData.open(o);
  }
  /** Everything PBR here is lit by this environment map (room.js renders it from the room). */
  function setEnv(tex) { root.traverse((o) => { if (o.material?.isMeshStandardMaterial) { o.material.envMap = tex; o.material.needsUpdate = true; } }); }
  return { root, update, fetch, setEnv, debug: (i, on) => { take(i)(); shown = on ? i : -1; hover.copy(deliver); yaw = PI; } };
}
