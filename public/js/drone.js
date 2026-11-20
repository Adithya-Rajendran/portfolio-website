// The Library's page: a small drone that rests in a cradle on the reading table. Asked for a volume at the terminal, it
// lifts off, flies to that volume's place on the shelves, takes the book and brings it back to the reader, where the
// book's data sheet unfolds beside it. It is the one thing in the room that is drawn live rather than baked, so it is
// shaded with a simple stand-in for the room's light (warm from the lamps above, cool from the window).
// The volumes (title, the rows of the sheet) come from content.json ("volumes").
import * as THREE from 'three';
import { GLOW, DIST, V, uMirror, glow, sheet, spring } from './kit.js';

const TAU = 6.2832, SPEED = 3.2, ease = (x) => x * x * (3 - 2 * x);
const lit = (r, g, b) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(r, g, b) }, uMirror },
  vertexShader: `varying vec3 vN, vW; void main(){ vN = mat3(modelMatrix)*normal; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uMirror; varying vec3 vN, vW;
    void main(){ vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      float lamps = max(n.y, 0.0), window = max(dot(n, normalize(vec3(0.0, 0.25, -1.0))), 0.0), rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      vec3 light = vec3(1.0, 0.72, 0.46)*(0.10 + 0.55*lamps) + vec3(0.55, 0.75, 1.0)*(0.30*window + 0.10*rim);
      gl_FragColor = vec4(uCol*light, 1.0); ${DIST} }`,
});
const SPINES = [[0.45, 0.07, 0.05], [0.06, 0.16, 0.3], [0.55, 0.42, 0.2], [0.1, 0.25, 0.14], [0.5, 0.22, 0.05], [0.25, 0.1, 0.2]];

/** @param dock, deliver, slots  three.js positions: the cradle, where it hands over, each volume's place on the shelves */
export function createDrone({ scene, dock, deliver, slots, volumes }) {
  const root = new THREE.Group(), body = new THREE.Group(), casters = [];
  const part = (geo, mat, set) => { const m = new THREE.Mesh(geo, mat); set?.(m); body.add(m); if (mat.isShaderMaterial) casters.push(m); return m; };
  const shell = lit(0.2, 0.21, 0.23), dark = lit(0.05, 0.055, 0.06), brass = lit(0.9, 0.62, 0.3);
  // a rounded hull, four ducted rotors on short arms, an eye at the front, a cradle for the book underneath
  part(new THREE.SphereGeometry(0.085, 24, 16), shell, (m) => m.scale.set(1.25, 0.55, 1.0));
  part(new THREE.CylinderGeometry(0.05, 0.062, 0.03, 20), dark, (m) => { m.position.y = -0.045; });
  const eye = part(new THREE.SphereGeometry(0.02, 12, 8), glow(new THREE.Color(0.5, 1.6, 2.4)), (m) => m.position.set(0, 0.005, -0.1));
  const lamp = part(new THREE.SphereGeometry(0.012, 10, 6), glow(new THREE.Color(2.4, 1.3, 0.4)), (m) => m.position.set(0, -0.064, 0));
  const discs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = V(x * 0.15, 0.012, z * 0.13);
    part(new THREE.CylinderGeometry(0.011, 0.011, c.length(), 6), dark, (m) => { m.position.copy(c).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), c.clone().normalize()); });
    part(new THREE.TorusGeometry(0.072, 0.009, 8, 28), brass, (m) => { m.position.copy(c); m.rotation.x = Math.PI / 2; });
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), dark, (m) => m.position.copy(c));
    discs.push(part(new THREE.CircleGeometry(0.066, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.62, 0.75), opacity: 0, side: THREE.DoubleSide, ...GLOW }), (m) => { m.position.copy(c); m.rotation.x = -Math.PI / 2; }));
  }
  for (const x of [-0.07, 0.07]) part(new THREE.BoxGeometry(0.008, 0.07, 0.11), dark, (m) => m.position.set(x, -0.085, 0));       // the grip
  const book = part(new THREE.BoxGeometry(0.2, 0.036, 0.28), lit(...SPINES[0]), (m) => { m.position.y = -0.125; m.visible = false; });
  const pages = part(new THREE.BoxGeometry(0.19, 0.026, 0.275), lit(0.75, 0.72, 0.66), (m) => { m.position.set(0.006, -0.125, 0); m.visible = false; });
  for (const m of casters) m.layers.enable(1);                    // it casts a shadow in the sunlight (see room.js)
  body.scale.setScalar(1.3); root.add(body); root.position.copy(dock); scene.add(root);

  const pagesOf = volumes.map((v) => { const s = sheet({ title: v.title, rows: v.rows, accent: v.rows.length - 1 }, '#ffe9cf', 0.62); s.position.set(-0.3, 0.02, 0); s.visible = false; root.add(s); return s; });
  const open = spring(0.09);
  // ---- flight: a queue of legs, each "go to p, then do this". Flying = any leg left, or away from the cradle.
  const legs = []; let leg = null, held = -1, shown = -1, last = 0, lift = 0, hover = V().copy(dock), vel = V(), yaw = 0;
  const cruise = (p) => p.clone().setY(Math.max(p.y, deliver.y) + 0.5);                 // legs cross the room above head height
  function go(p, then, wait = 0) { legs.push({ p: p.clone(), then, wait }); }
  const front = (s) => s.clone().setX(s.x - Math.sign(s.x) * 0.75);                     // hovering in front of a shelf slot
  const take = (i) => () => { held = i; book.material.uniforms.uCol.value.setRGB(...SPINES[i % SPINES.length]); book.visible = pages.visible = true; };
  const put = () => { held = -1; book.visible = pages.visible = false; };
  /** Fetch volume i (returning the one it holds first); null sends it home. */
  function fetch(i) {
    if (i === held && !legs.length && shown === i) return;
    legs.length = 0; shown = -1; open.to = 0;
    if (held >= 0 && held !== i) { go(cruise(front(slots[held]))); go(front(slots[held]), put, 0.5); go(cruise(front(slots[held]))); }
    if (i != null && held !== i) { go(cruise(front(slots[i]))); go(front(slots[i]), take(i), 0.6); go(cruise(front(slots[i]))); }
    if (i != null) { go(cruise(deliver)); go(deliver, () => { shown = i; open.to = 1; }); }
    else { go(cruise(dock)); go(dock); }
    leg = null;
  }

  function update(t) {
    const dt = Math.min(0.05, Math.max(0, t - last)); last = t;
    if (!leg && legs.length) { const l = legs.shift(), from = hover.clone(); leg = { ...l, from, T: Math.max(0.5, from.distanceTo(l.p) / SPEED), k: 0, hold: l.wait }; }
    const before = hover.clone();
    if (leg) {
      leg.k = Math.min(1, leg.k + dt / leg.T); hover.lerpVectors(leg.from, leg.p, ease(leg.k));
      if (leg.k === 1 && (leg.hold -= dt) <= 0) { leg.then?.(); leg = null; }
    }
    const flying = !!leg || legs.length > 0 || hover.distanceTo(dock) > 0.02;
    lift += ((flying ? 1 : 0) - lift) * Math.min(1, dt * 4);                             // rotors spin up before it moves much, and down after it lands
    vel.lerp(hover.clone().sub(before).divideScalar(dt || 1), 0.1);
    root.position.copy(hover); root.position.y += lift * 0.012 * Math.sin(t * 2.3);      // it never hangs quite still
    if (vel.lengthSq() > 0.04) yaw += (((Math.atan2(-vel.x, -vel.z) - yaw + Math.PI) % TAU + TAU) % TAU - Math.PI) * Math.min(1, dt * 5);
    else if (shown >= 0) yaw += ((((Math.PI - yaw + Math.PI) % TAU + TAU) % TAU) - Math.PI) * Math.min(1, dt * 3);    // turns to face the reader while it holds the book out
    body.rotation.set(0, yaw, 0); body.rotateX(-0.06 * Math.hypot(vel.x, vel.z));        // leans into its flight
    for (const [i, d] of discs.entries()) { d.material.opacity = lift * (0.22 + 0.08 * Math.sin(t * 61 + i * 2.1)); d.rotation.z = t * 40 * (i % 2 ? 1 : -1); }
    eye.material.color.setRGB(0.5, 1.6, 2.4).multiplyScalar(0.35 + 0.65 * lift); lamp.material.color.setRGB(2.4, 1.3, 0.4).multiplyScalar(lift < 0.5 ? 0.25 + 0.2 * Math.sin(t * 1.5) : 1);
    const k = open.step();
    pagesOf.forEach((s, i) => { const on = i === shown ? k : 0; s.visible = on > 0.02; s.scale.set(s.userData.size[0] * on + 1e-4, s.userData.size[1] * on + 1e-4, 1); });
  }
  return { root, update, fetch };
}
