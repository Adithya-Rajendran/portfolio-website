// Arcadia Station, drawn as an explorable 3D blueprint. The rooms are the real room models (the same .glb files the
// site renders), reduced to their edges and set out on the deck where the plan puts them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04101a);
const camera = new THREE.PerspectiveCamera(42, 1, 1, 30000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.62;
const SIDE = 340, CY = 0x6fdcff, AM = 0xffb057;
const line = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
const dashed = (color, opacity = 1, dash = 0.6) => new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: dash, gapSize: dash * 0.8 });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const poly = (pts, mat, closed = false) => { const l = new (closed ? THREE.LineLoop : THREE.Line)(new THREE.BufferGeometry().setFromPoints(pts), mat); l.computeLineDistances(); return l; };
const ring = (r, n = 128) => Array.from({ length: n }, (_, i) => V(Math.cos(i / n * 6.2832) * r, Math.sin(i / n * 6.2832) * r, 0));
const labelBox = document.getElementById('labels'), tags = [];
function tag(html, pos, cls, mode) { const el = document.createElement('div'); el.className = 'tag ' + (cls || ''); el.innerHTML = html; labelBox.appendChild(el); tags.push({ el, pos, mode }); return el; }

// ------------------------------------------------------------------ the habitat tube
// World axes on the deck: x runs along the ring (spinward = +x), y is up (towards the hub), z is across the tube.
// The pressure hull is a circular tube; the main deck is a chord across it. Rooms are compartments between
// bulkheads, in a row. HULL_R and HULL_Y are chosen so the Atrium (20 m wide, 11 m high) fits with a services attic
// above and the Ring Line, tanks and shielding below.
const HULL_R = 12.6, HULL_Y = 3.2, X0 = -66, X1 = 90, LINE_Y = -4.5;
const ROOMS = [
  { id: 'atrium', name: 'ATRIUM', page: 'HOME', href: 'index.html', glb: 'assets/lobby/room.glb', img: 'blueprint/lobby.png', at: 7, turn: -1, label: [16, 13, 0], view: [[16, 40, 46], [16, 2, 0]],
    text: 'Compartment 4, at the foot of the spoke. You step out of the lift from the hub and face the Oculus. Stair doors in the side bays go down to the Ring Line.' },
  { id: 'fabrication', name: 'FABRICATION BAY 02', page: 'PROJECTS', href: 'index.html?room=projects', glb: 'assets/projects/room.glb', img: 'blueprint/projects.png', at: -35, turn: -1, label: [-26, 11, 0], view: [[-26, 34, 40], [-26, 2, 0]],
    text: 'Compartment 3, on the other side of the spoke: its big door is the cargo lift, so parts come straight down from the hub dock.' },
  { id: 'navigation', name: 'NAVIGATION', page: 'EXPERIENCE', href: 'index.html?room=experience', glb: 'assets/experience/room.glb', img: 'blueprint/experience.png', at: -53, turn: -1, label: [-53, 11, 0], view: [[-53, 30, 30], [-53, 2, 0]],
    text: 'Compartment 2. A round chart room; its dome is a pressure dome under the hull.' },
  { id: 'lounge', name: 'OBSERVATION LOUNGE', page: 'ABOUT', href: 'index.html?room=about', glb: 'assets/about/room.glb', img: 'blueprint/about.png', at: 48, turn: 1, label: [47, 9, 0], view: [[47, 26, 30], [47, 2, 0]],
    text: 'Compartment 6. It faces the Atrium across the optics bay, so both rooms look into the same relayed view of Earth.' },
  { id: 'library', name: 'LIBRARY', page: 'WRITING · PLANNED', box: [56, 72, 6], label: [64, 8, 0], view: [[64, 26, 30], [64, 2, 0]], text: 'Compartment 7. Not built yet.' },
  { id: 'comms', name: 'COMMS', page: 'CONTACT · PLANNED', box: [74, 86, 6], label: [80, 8, 0], view: [[80, 26, 30], [80, 2, 0]], text: 'Compartment 8. Not built yet.' },
];
const BULKHEADS = [-64, -43, -10, 0, 33, 39, 55, 73, 87];
const STOPS = [['NAVIGATION', -53], ['FABRICATION', -26], ['ATRIUM', 16], ['LOUNGE', 47], ['LIBRARY', 64], ['COMMS', 80]];

const deck = new THREE.Group(); scene.add(deck);
const roofs = [], shell = []; let showRoof = false;
const STYLE = { arch: [CY, 0.55], center: [CY, 0.85], props: [0x9fe6ff, 0.28], floor: [CY, 0.5], roof: [CY, 0.16], chand: [AM, 0.7] };
const loader = new GLTFLoader(), picks = [];
function plateFor(r, box) { const s = box.getSize(V(0, 0, 0)), c = box.getCenter(V(0, 0, 0));
  const plate = new THREE.Mesh(r.id === 'navigation' ? new THREE.CircleGeometry(9, 64).rotateX(-Math.PI / 2) : new THREE.PlaneGeometry(s.x, s.z).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b2a3b, transparent: true, opacity: r.box ? 0.4 : 0.85 }));
  plate.position.set(c.x, -0.05, c.z); deck.add(plate); plate.userData.room = r; picks.push(plate); }
async function addRoom(r) {
  const g = new THREE.Group(); g.position.set(r.at, 0, 0); g.rotation.y = r.turn * Math.PI / 2; deck.add(g); g.updateMatrixWorld(true);
  const gltf = await loader.loadAsync(r.glb); gltf.scene.updateMatrixWorld(true); const box = new THREE.Box3();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return; const u = o.userData, grp = u.grp || '';
    if (u.em || u.fx === 'glass') return;
    const key = u.fx === 'screen' ? 'screen' : grp.startsWith('chand') ? 'chand' : grp === 'archC' ? 'roof' : grp.startsWith('arch') || grp === 'back' ? 'arch' : grp.startsWith('floor') ? 'floor' : grp;
    const [color, opacity] = key === 'screen' ? [AM, 0.9] : STYLE[key] || [CY, 0.5];
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, key === 'props' ? 50 : 30), line(color, opacity)); e.applyMatrix4(o.matrixWorld); g.add(e);
    if (key === 'roof' || key === 'chand') { roofs.push(e); e.visible = showRoof; } else { e.updateMatrixWorld(true); box.expandByObject(e); }
  });
  plateFor(r, box);
}
function addPlanned(r) { const [x0, x1, h] = r.box, m = dashed(CY, 0.7, 0.8), w = 9;
  for (const y of [0, h]) deck.add(poly([V(x0, y, -w), V(x1, y, -w), V(x1, y, w), V(x0, y, w)], m, true));
  for (const [x, z] of [[x0, -w], [x1, -w], [x1, w], [x0, w]]) deck.add(poly([V(x, 0, z), V(x, h, z)], m));
  plateFor(r, new THREE.Box3(V(x0, 0, -w), V(x1, h, w))); }

// hull frames every 4 m (the ribs you see in the Atrium are these), longerons, deck edge
const circ = (x, r, n = 48, a0 = 0, a1 = 6.2832) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return V(x, HULL_Y + Math.sin(a) * r, Math.cos(a) * r); });
const aDeck = Math.asin(-HULL_Y / HULL_R);                                         // where the deck chord meets the hull
for (let x = X0; x <= X1; x += 4) { const below = poly(circ(x, HULL_R, 24, Math.PI - aDeck, 2 * Math.PI + aDeck), line(CY, 0.3)); deck.add(below);
  const above = poly(circ(x, HULL_R, 32, aDeck, Math.PI - aDeck), line(CY, 0.22)); deck.add(above); shell.push(above); above.visible = false; }
for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832 + 0.26, up = Math.sin(a) * HULL_R + HULL_Y > 0; const l = poly([V(X0, HULL_Y + Math.sin(a) * HULL_R, Math.cos(a) * HULL_R), V(X1, HULL_Y + Math.sin(a) * HULL_R, Math.cos(a) * HULL_R)], line(CY, up ? 0.22 : 0.3)); deck.add(l); if (up) { shell.push(l); l.visible = false; } }
{ const w = Math.cos(aDeck) * HULL_R; deck.add(poly([V(X0, 0, -w), V(X1, 0, -w), V(X1, 0, w), V(X0, 0, w)], line(CY, 0.6), true)); }
// pressure bulkheads between compartments (each with a door on the deck and a hatch on the Ring Line)
for (const x of BULKHEADS) { deck.add(poly(circ(x, HULL_R, 64), line(AM, 0.75), true), poly([V(x, 0, -12), V(x, 0, 12)], line(AM, 0.75)));
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 2.2), new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.6 })); d.position.set(x, LINE_Y + 1.3, 0); deck.add(d); }
// below the deck: the Ring Line (tram + walkway through every compartment), water tanks that double as shielding
deck.add(poly([V(X0, LINE_Y, -0.8), V(X1, LINE_Y, -0.8)], line(AM, 0.9)), poly([V(X0, LINE_Y, 0.8), V(X1, LINE_Y, 0.8)], line(AM, 0.9)));
for (let x = X0; x <= X1; x += 2) deck.add(poly([V(x, LINE_Y, -0.8), V(x, LINE_Y, 0.8)], line(AM, 0.35)));
for (const z of [-6.5, 6.5]) for (let x = X0 + 3; x < X1 - 8; x += 13) { const t = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(2.3, 2.3, 10, 12).rotateZ(Math.PI / 2), 30), line(CY, 0.3)); t.position.set(x + 5, -4.6, z); deck.add(t); }
tag('WATER TANKS · RADIATION SHIELD + BALLAST', V(-58, -8.5, 9), 'far', 'deck'); tag('RING LINE · TRAM + WALKWAY', V(96, LINE_Y, 0), 'door', 'deck');
for (const [name, x] of STOPS) { const p = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 2.6), new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.5 })); p.position.set(x, LINE_Y, 3); deck.add(p);
  deck.add(poly([V(x, LINE_Y, 3), V(x, 0.1, 6.5)], dashed(AM, 0.9, 0.5))); }
// the Atrium's four stair doors down to the Ring Line (hall coordinates: across = z, along = x - 7)
for (const [name, hx, hy] of [['↓ NAVIGATION', -10, 21], ['↓ FABRICATION', -10, 13], ['↓ LOUNGE', 10, 21], ['↓ LIBRARY · COMMS', 10, 13]]) {
  const d = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 0.8), new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.6 })); d.position.set(hy + 7, 1.6, hx); deck.add(d);
  deck.add(poly([V(hy + 7, 0, hx), V(hy + 7, LINE_Y, Math.sign(hx) * 3)], dashed(AM, 0.9, 0.5))); tag(name, V(hy + 7, 4.4, hx * 1.08), 'door', 'deck'); }
// the spoke: lift core between Fabrication and the Atrium, running up to the hub
{ const m = line(AM, 0.8); for (const [x, z] of [[-10, -5], [0, -5], [0, 5], [-10, 5]]) deck.add(poly([V(x, 0, z), V(x, 60, z)], m));
  for (let y = 0; y <= 60; y += 6) deck.add(poly([V(-10, y, -5), V(0, y, -5), V(0, y, 5), V(-10, y, 5)], line(AM, 0.35), true));
  tag('SPOKE · LIFTS TO THE HUB<small><br>PASSENGERS ↔ ATRIUM · CARGO ↔ FABRICATION</small>', V(-5, 30, 0), 'door', 'deck'); }
// the optics bay between the Atrium and the Lounge
{ const m = line(AM, 0.9); deck.add(poly(circ(36, 4.6, 48).map((p) => p.setY(p.y - HULL_Y + 5.65)), m, true));
  deck.add(poly([V(36, 5.65, 0), V(36, 16, 0), V(-5, 16, 0), V(-5, 60, 0)], dashed(AM, 0.9, 0.7)));
  tag('OPTICS BAY · OCULUS RELAY<small><br>DE-SPUN IMAGE FROM THE HUB TELESCOPE</small>', V(36, 19, 0), 'door', 'deck'); }
{ const you = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 16), new THREE.MeshBasicMaterial({ color: AM })); you.position.set(2.8, 0.9, 0); deck.add(you); tag('YOU ARRIVE HERE', V(2.8, 3.2, 0), 'door', 'deck'); }
tag('← ANTISPINWARD', V(X0 - 6, 0, 0), 'far', 'deck'); tag('SPINWARD →', V(X1 + 6, 6, 0), 'far', 'deck');
for (const r of ROOMS) tag(`<b>${r.name}</b><small>${r.page}</small>`, V(...r.label), '', 'deck');

// ------------------------------------------------------------------ the station around the deck
// Ring axis along z, 224 m above the deck. Hub and truss do not spin; the rings do, in counter-rotating pairs.
const station = new THREE.Group(); scene.add(station);
const R = 224 + HULL_Y;
function hoop(z, r, mat, n = 160) { const l = poly(ring(r, n), mat, true); l.position.set(0, R, z); station.add(l); return l; }
[[0, true, '04'], [70, false, '03'], [150, false, '02'], [220, false, '01']].forEach(([z, here, no]) => {
  const m = line(here ? AM : CY, here ? 0.9 : 0.45);
  for (const dz of [-HULL_R, HULL_R]) hoop(z + dz, R, m); hoop(z, R + HULL_R, m); hoop(z, R - HULL_R, m);
  for (let k = 0; k < 48; k++) { const a = k / 48 * 6.2832, c = Math.cos(a), s = Math.sin(a); const f = poly(ring(HULL_R, 20), line(here ? AM : CY, 0.22), true);
    f.position.set(c * R, R + s * R, z); f.rotation.set(0, 0, a); f.rotateY(Math.PI / 2); f.rotateX(Math.PI / 2); station.add(f); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * 6.2832 - 1.5708 - 0.022, c = Math.cos(a), s = Math.sin(a); for (const d of [-5, 5]) station.add(poly([V(c * 24, R + s * 24, z + d), V(c * (R - HULL_R), R + s * (R - HULL_R), z + d)], line(here && k === 0 ? AM : CY, 0.6))); }
  tag(`RING ${no}${here ? ' · THE DECK IS ITS LOWEST ARC' : ''}`, V(0, 2 * R + 30, z), here ? 'door' : 'far', 'station');
});
tag('RINGS 01 + 02 TURN ONE WAY, 03 + 04 THE OTHER:<br>THEIR SPIN CANCELS, SO THE STATION CAN BE STEERED', V(-R - 150, R + 140, 110), 'far', 'station');
// non-rotating hub on the axis, with the dock at one end and the power truss at the other
for (const z of [-70, 290]) hoop(z, 24, line(CY, 0.7), 48);
for (let k = 0; k < 10; k++) { const a = k / 10 * 6.2832; station.add(poly([V(Math.cos(a) * 24, R + Math.sin(a) * 24, -70), V(Math.cos(a) * 24, R + Math.sin(a) * 24, 290)], line(CY, 0.45))); }
tag('HUB · DOES NOT SPIN · ZERO-G', V(0, R + 46, 110), 'far', 'station');
{ const m = line(CY, 0.6); station.add(poly([V(0, R, 290), V(0, R, 640)], m));
  for (const z of [380, 470, 560]) for (const sx of [-1, 1]) station.add(poly([V(sx * 10, R, z - 30), V(sx * 300, R, z - 30), V(sx * 300, R, z + 30), V(sx * 10, R, z + 30)], line(CY, 0.55), true));
  for (const sy of [-1, 1]) station.add(poly([V(0, R + sy * 10, 600), V(0, R + sy * 220, 600), V(0, R + sy * 220, 640), V(0, R + sy * 10, 640)], line(AM, 0.6), true));
  tag('SOLAR ARRAYS', V(310, R + 30, 470), 'far', 'station'); tag('RADIATORS · EDGE-ON TO THE SUN', V(0, R + 250, 620), 'far', 'station'); }
// Earth-pointing telescope on the hub: its image goes down the spoke to the Oculus
{ const t = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(9, 9, 40, 12), 30), line(AM, 0.9)); t.position.set(0, R - 40, -40); station.add(t);
  station.add(poly([V(0, R - 20, -40), V(0, R - 20, 0), V(0, 20, 0)], dashed(AM, 0.9, 6))); tag('OCULUS TELESCOPE', V(0, R - 70, -40), 'door', 'station'); }
// Ark Aurora, docked nose-on to the hub, on the spin axis (the only place a ship can meet a spinning station)
{ const ark = new THREE.Group(); ark.position.set(0, R, -70); station.add(ark); const m = line(CY, 0.7);
  ark.add(poly([V(0, 0, -40), V(0, 0, -1520)], m));
  for (const z of [-420, -600, -780]) for (const zz of [z - 14, z + 14]) { const l = poly(ring(120, 96), m, true); l.position.z = zz; ark.add(l); }
  for (const [r, z] of [[14, -40], [150, -1520], [90, -1500], [40, -200], [110, -90]]) { const l = poly(ring(r, 64), m, true); l.position.z = z; ark.add(l); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832, c = Math.cos(a), s = Math.sin(a); ark.add(poly([V(c * 150, s * 150, -1520), V(c * 90, s * 90, -1500)], m), poly([V(c * 40, s * 40, -200), V(c * 110, s * 110, -90)], m)); }
  for (const [x, y] of [[40, 40], [-40, 40], [40, -40], [-40, -40]]) for (const z of [-1000, -1160]) { const l = poly(ring(34, 32), m, true); l.position.set(x, y, z); ark.add(l); }
  station.add(poly([V(0, R, -70), V(0, R, -110)], line(AM, 1)));
  tag('ARK AURORA · 1,480 m · DOCKED ON THE AXIS', V(0, R + 190, -700), 'far', 'station'); tag('DOCK', V(0, R + 40, -90), 'door', 'station'); }
// the deck patch on Ring 04
{ const a0 = -1.5708 + X0 / R, a1 = -1.5708 + X1 / R; for (const z of [-HULL_R, HULL_R]) station.add(poly(Array.from({ length: 17 }, (_, i) => { const a = a0 + (a1 - a0) * i / 16; return V(Math.cos(a) * (R + 3), R + Math.sin(a) * (R + 3), z); }), line(AM, 1)));
  tag('THE DECK · 8 COMPARTMENTS', V(0, -40, 0), 'door', 'station'); }
{ const g = new THREE.GridHelper(240, 60, 0x12384c, 0x0c2636); g.position.set(12, -HULL_R + HULL_Y - 0.4, 0); deck.add(g); }

// ------------------------------------------------------------------ side panel + camera moves
const BLURB = {
  station: '<b>Arcadia Station</b>, 717 km up. Four habitat rings spin for gravity; the hub on the axis does not spin, so that is where ships dock, where the solar arrays and radiators sit, and where the telescope that feeds the Oculus points at Earth. <b>Ark Aurora</b> is docked nose-on to the hub. Everything on the website happens on the amber arc of Ring 04.',
  deck: 'That arc, straightened out. The ring is a pressure tube with a flat deck across it. The rooms are <b>compartments in a row</b>, each sealed from the next by a bulkhead (amber rings). You come down the <b>spoke</b> by lift and step into the Atrium. Under the deck runs the <b>Ring Line</b>, a tram and walkway that reaches every room.',
};
let mode = 'deck', fly = null;
const DECK_VIEW = [[-10, 120, 150], [12, -4, 0]], STATION_VIEW = [[1900, 1100, 900], [0, R, -480]];
function go(pos, tgt, m) { fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: V(...pos), t1: V(...tgt), k: 0 }; if (m) setMode(m); }
function setMode(m) { mode = m; document.querySelectorAll('.views button').forEach((b) => b.classList.toggle('on', b.dataset.v === m)); document.getElementById('blurb').innerHTML = BLURB[m];
  controls.maxDistance = m === 'station' ? 6000 : 330; deck.visible = true; }
document.querySelectorAll('.views button').forEach((b) => b.addEventListener('click', () => { select(null); b.dataset.v === 'station' ? go(...STATION_VIEW, 'station') : go(...DECK_VIEW, 'deck'); }));
const list = document.getElementById('rooms');
function select(r) { document.querySelectorAll('.room').forEach((e) => e.classList.toggle('on', !!r && e.dataset.id === r.id)); if (r) go(r.view[0], r.view[1], 'deck'); }
for (const r of ROOMS) { const el = document.createElement('div'); el.className = 'room'; el.dataset.id = r.id;
  el.innerHTML = `${r.img ? `<img src="${r.img}" alt="">` : '<div class="ph">PLANNED</div>'}<div><h3>${r.name}</h3><div class="pg">${r.page}${r.href ? ` · <a href="${r.href}" style="color:inherit">OPEN</a>` : ''}</div><span>${r.text}</span></div>`;
  el.addEventListener('click', (e) => { if (e.target.tagName !== 'A') select(r); }); list.appendChild(el); }
document.getElementById('roof').addEventListener('click', (e) => { showRoof = !showRoof; roofs.forEach((o) => (o.visible = showRoof)); shell.forEach((o) => (o.visible = showRoof)); e.target.textContent = showRoof ? 'HIDE HULL + ROOFS' : 'SHOW HULL + ROOFS'; e.target.classList.toggle('on', showRoof); });
const ray = new THREE.Raycaster(); let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('click', (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera); const h = ray.intersectObjects(picks, false)[0]; if (h) select(h.object.userData.room); });

function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.setViewOffset(innerWidth + SIDE, innerHeight, 0, 0, innerWidth, innerHeight); camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
camera.position.set(...DECK_VIEW[0]); controls.target.set(...DECK_VIEW[1]); setMode('deck');
const q = new URLSearchParams(location.search);
if (q.get('view') === 'station') { camera.position.set(...STATION_VIEW[0]); controls.target.set(...STATION_VIEW[1]); setMode('station'); }
if (q.has('roof')) document.getElementById('roof').click();

const v = V(0, 0, 0);
function frame() {
  if (fly) { fly.k = Math.min(1, fly.k + 0.022); const e = fly.k * fly.k * (3 - 2 * fly.k); camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (fly.k === 1) fly = null; }
  controls.update();
  const far = camera.position.distanceTo(controls.target) > 460;                 // labels follow how far out we are
  station.visible = far;
  for (const t of tags) { v.copy(t.pos).project(camera); const show = v.z < 1 && (t.mode === 'station') === far;
    t.el.style.display = show ? '' : 'none'; if (show) { t.el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; t.el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; } }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
for (const r of ROOMS) r.glb ? addRoom(r).then(() => q.get('room') === r.id && select(r)) : addPlanned(r);
frame(); window.__bp = { ready: () => picks.length >= ROOMS.length };
