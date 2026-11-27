// The route map above the navigation table: a strand of DNA with a station at each stop.
import * as THREE from 'three';
import { GLOW, VERT_XZ, CY, GOLD, V, uTime, uPx, lineMat, glow, glsl, cloud, label, sheet, spring } from './kit.js';
import { createTurn } from './turn.js';

export { TURN } from './turn.js';

const UP = new THREE.Vector3(0, 1, 0), STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CYAN = new THREE.Color(0.35, 1.3, 1.9), DIM = new THREE.Color(0.16, 0.55, 0.85), AMBER = new THREE.Color(2.0, 1.25, 0.5), TAU = 6.2832;
const wire = (geo, col = CYAN, op = 0.75) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), lineMat(col, op));
const path = (pts, col = CYAN, op = 0.8) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, op));
const pairs = (pts, col = CYAN, op = 0.8) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, op));
const solid = (geo, col) => new THREE.Mesh(geo, glow(col));
const dots = (arr, col, size = 0.022) => cloud(arr, new THREE.PointsMaterial({ color: col, size, ...GLOW }));
const circle = (r, n = 64, y = 0) => Array.from({ length: n + 1 }, (_, i) => V(Math.cos(i / n * TAU) * r, y, Math.sin(i / n * TAU) * r));
const at = (o, set) => { set(o); return o; };

const MODELS = {
  elevator() {
    const o = new THREE.Group(), g = new THREE.Group(), planet = new THREE.Group(), climber = solid(new THREE.SphereGeometry(0.028, 10, 8), AMBER);
    planet.add(wire(new THREE.IcosahedronGeometry(0.42, 2), DIM, 0.45), solid(new THREE.SphereGeometry(0.4, 24, 16), new THREE.Color(0.01, 0.05, 0.09)), path(circle(0.425), CYAN, 0.9));
    for (const la of [-0.5, 0.5]) planet.add(path(circle(0.425 * Math.cos(la), 48, 0.425 * Math.sin(la)), DIM, 0.6));
    g.add(planet, climber, path([V(0.42, 0, 0), V(1.62, 0, 0)], AMBER, 0.9), path(circle(1.05, 96), DIM, 0.3),
      at(wire(new THREE.OctahedronGeometry(0.07), CYAN, 1), (p) => { p.position.x = 1.05; }),
      at(path(circle(0.15, 32), CYAN, 0.8), (p) => { p.rotation.z = Math.PI / 2; p.position.x = 1.05; }),
      at(wire(new THREE.BoxGeometry(0.12, 0.09, 0.09), AMBER, 1), (p) => { p.position.x = 1.62; }));
    g.rotation.z = -0.5; g.position.set(-0.45, -0.1, 0); o.add(g);
    o.tick = (t) => { planet.rotation.y = t * 0.25; climber.position.x = 0.45 + ((t * 0.1) % 1) * 1.12; };
    return o;
  },
  torus() {
    const o = new THREE.Group(), wheel = new THREE.Group(), mirror = new THREE.Group(), spokes = [], rays = [];
    for (let i = 0; i < 6; i++) { const c = Math.cos(i / 6 * TAU), s = Math.sin(i / 6 * TAU); spokes.push(V(c * 0.07, 0, s * 0.07), V(c * 0.47, 0, s * 0.47)); }
    for (let i = 0; i < 12; i++) { const c = Math.cos(i / 12 * TAU), s = Math.sin(i / 12 * TAU); rays.push(V(c * 0.3, 0, s * 0.3), V(c * 0.72, 0, s * 0.72)); }
    wheel.add(at(wire(new THREE.TorusGeometry(0.55, 0.085, 8, 40), CYAN, 0.55), (p) => { p.rotation.x = Math.PI / 2; }),
      wire(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), CYAN, 0.9), path(circle(0.47, 64), AMBER, 0.9), pairs(spokes, CYAN, 0.8),
      dots(circle(0.64, 12).slice(1).flatMap((p) => [p.x, p.y, p.z]), AMBER, 0.03));
    mirror.add(path(circle(0.72, 64), DIM, 0.8), path(circle(0.3, 32), DIM, 0.6), pairs(rays, DIM, 0.35));
    mirror.position.y = 0.5; mirror.rotation.x = 0.35;
    o.add(wheel, mirror, path([V(0, -0.45, 0), V(0, 0.5, 0)], CYAN, 0.6)); o.rotation.set(0.5, 0, 0.3);
    o.tick = (t) => { wheel.rotation.y = t * 0.6; };
    return o;
  },
  cylinders() {
    const o = new THREE.Group(), cyls = [-1, 1].map((d) => {
      const c = new THREE.Group(); c.position.z = d * 0.3;
      c.add(at(wire(new THREE.CylinderGeometry(0.19, 0.19, 1.1, 12, 4, true), d < 0 ? CYAN : DIM, 0.6), (p) => { p.rotation.z = Math.PI / 2; }));
      for (const e of [-1, 1]) c.add(at(wire(new THREE.ConeGeometry(0.19, 0.16, 12, 1, true), CYAN, 0.6), (p) => { p.rotation.z = -e * Math.PI / 2; p.position.x = e * 0.63; }));
      for (let i = 0; i < 3; i++) {
        const y = Math.cos(i / 3 * TAU), z = Math.sin(i / 3 * TAU), hinge = V(-0.55, y * 0.19, z * 0.19);
        c.add(path([hinge, V(0.5, y * 0.52, z * 0.52), V(0.5, y * 0.52 - z * 0.12, z * 0.52 + y * 0.12), V(-0.55, y * 0.19 - z * 0.07, z * 0.19 + y * 0.07), hinge], AMBER, 0.75));
      }
      o.add(c); return c;
    });
    o.add(pairs([V(-0.5, 0, -0.3), V(-0.5, 0, 0.3), V(0.5, 0, -0.3), V(0.5, 0, 0.3), V(-0.5, 0, -0.3), V(0.5, 0, 0.3)], DIM, 0.6)); o.rotation.set(0.25, 0.6, 0.2);
    o.tick = (t) => { cyls[0].rotation.x = t * 0.5; cyls[1].rotation.x = -t * 0.5; };
    return o;
  },
  ramjet() {
    const o = new THREE.Group(), R = (x) => 0.1 + 0.62 * Math.pow(Math.max(0, x - 0.1) / 0.85, 1.6);
    for (const x of [0.2, 0.4, 0.6, 0.8, 0.95]) o.add(at(path(circle(R(x), 48), DIM, 0.35 + x * 0.4), (p) => { p.rotation.z = Math.PI / 2; p.position.x = x; }));
    for (let i = 0; i < 8; i++) {
      const c = Math.cos(i / 8 * TAU), s = Math.sin(i / 8 * TAU);
      o.add(path(Array.from({ length: 12 }, (_, k) => { const x = 0.1 + k / 11 * 0.85; return V(x, c * R(x), s * R(x)); }), DIM, 0.4));
    }
    const hab = at(wire(new THREE.TorusGeometry(0.13, 0.03, 6, 20), CYAN, 0.8), (p) => { p.rotation.y = Math.PI / 2; p.position.x = -0.12; });
    const stream = (n, col, size) => { const p = dots(new Float32Array(n * 3), col, size); p.seed = Array.from({ length: n }, () => [Math.random(), Math.random() * TAU, Math.random()]); return p; };
    const gas = stream(70, new THREE.Color(0.5, 1.4, 2.0), 0.016), exhaust = stream(40, new THREE.Color(2.4, 1.5, 0.6), 0.024);
    o.add(hab, gas, exhaust, path([V(-0.85, 0, 0), V(0.12, 0, 0)], CYAN, 1),
      at(wire(new THREE.ConeGeometry(0.12, 0.2, 10, 1, true), AMBER, 0.9), (p) => { p.rotation.z = -Math.PI / 2; p.position.x = -0.85; }));
    for (const z of [-0.09, 0.09]) o.add(at(wire(new THREE.SphereGeometry(0.075, 8, 6), AMBER, 0.7), (p) => p.position.set(-0.45, 0, z)));
    o.rotation.set(0.15, -0.5, 0.25);
    const flow = (cloudOf, place) => { const a = cloudOf.geometry.attributes.position; cloudOf.seed.forEach((s, i) => a.setXYZ(i, ...place(...s))); a.needsUpdate = true; };
    o.tick = (t) => {
      flow(gas, (p, a, r) => { const x = 1.0 - ((p + t * 0.22) % 1) * 0.9, rr = R(x) * (0.2 + 0.8 * r); return [x, Math.cos(a) * rr, Math.sin(a) * rr]; });
      flow(exhaust, (p, a, r) => { const u = (p + t * 0.6) % 1, rr = r * 0.1 * (1 + u); return [-0.95 - u * 0.75, Math.cos(a) * rr, Math.sin(a) * rr]; });
      hab.rotation.x = t * 0.8;
    };
    return o;
  },
  dyson() {
    const o = new THREE.Group(), hexes = new THREE.Group(), jitter = (k) => (Math.random() - 0.5) * k;
    const rings = [[0.42, 110, 0.0, 0.5], [0.6, 150, 1.0, -0.33], [0.8, 190, -0.7, 0.22]].map(([r, n, tilt, speed]) => {
      const swarm = Array.from({ length: n }, (_, i) => { const a = i / n * TAU + Math.random() * 0.03, rr = r + jitter(0.05); return [Math.cos(a) * rr, jitter(0.07), Math.sin(a) * (r + jitter(0.05))]; });
      const h = new THREE.Group(), turn = new THREE.Group(); h.rotation.x = tilt; h.add(turn); turn.add(dots(swarm.flat(), CYAN, 0.02), path(circle(r, 96), DIM, 0.25)); o.add(h);
      return [turn, speed];
    });
    for (let i = 0; i < 16; i++) {
      const d = V(jitter(1), jitter(0.9), jitter(1)).normalize();
      hexes.add(at(path(circle(0.075, 6), AMBER, 0.8), (h) => { h.position.copy(d).multiplyScalar(0.52); h.quaternion.setFromUnitVectors(V(0, 1, 0), d); }));
    }
    o.add(hexes, solid(new THREE.SphereGeometry(0.15, 20, 14), new THREE.Color(3.0, 1.9, 0.7)), wire(new THREE.IcosahedronGeometry(0.21, 1), AMBER, 0.6)); o.rotation.set(0.35, 0, 0.2);
    o.tick = (t) => { for (const [turn, speed] of rings) turn.rotation.y = t * speed; hexes.rotation.y = t * 0.12; };
    return o;
  },
  warp() {
    const o = new THREE.Group(), grid = [];
    const rings = [-0.26, 0.26].map((x) => at(wire(new THREE.TorusGeometry(0.34, 0.045, 6, 32), AMBER, 0.7), (r) => { r.rotation.y = Math.PI / 2; r.position.x = x; }));
    const bump = (x, z) => -0.42 + 0.26 * (Math.exp(-((x - 0.55) ** 2 + z * z) * 5) - Math.exp(-((x + 0.55) ** 2 + z * z) * 5));
    for (let i = -6; i <= 6; i++) for (let k = 0; k < 24; k++) {
      const c = i * 0.17, a = -1.02 + k * 0.085, b = a + 0.085;
      grid.push(V(a, bump(a, c), c), V(b, bump(b, c), c), V(c, bump(c, a), a), V(c, bump(c, b), b));
    }
    o.add(...rings, pairs(grid, DIM, 0.5), at(wire(new THREE.OctahedronGeometry(0.11, 1), AMBER, 0.9), (h) => h.scale.set(3.4, 1, 1)),
      pairs([V(-0.26, 0.3, 0), V(-0.1, 0.06, 0), V(-0.26, -0.3, 0), V(-0.1, -0.06, 0), V(0.26, 0.3, 0), V(0.1, 0.06, 0), V(0.26, -0.3, 0), V(0.1, -0.06, 0)], AMBER, 0.6));
    o.rotation.set(0.3, -0.7, 0.1);
    o.tick = (t) => rings.forEach((r, i) => { r.rotation.x = t * (i ? 1.4 : -1.4); r.scale.setScalar(1 + 0.05 * Math.sin(t * 4 + i * 3.14)); });
    return o;
  },
};

export function createRouteMap({ scene, center, stops, radius = 3.1, gain = 1.6 }) {
  const root = new THREE.Group(); root.position.copy(center); scene.add(root);
  const U = { uTime, uPx, uGain: { value: gain }, uTrain: { value: 0 } }, N = stops.length;
  const P = stops.map((_, i) => { const t = N > 1 ? i / (N - 1) : 1, a = -2.5 + t * 5.4, r = radius * (0.78 - 0.3 * t); return V(Math.cos(a) * r, 0.75 + t * 3.0 + 0.25 * Math.sin(t * 9.0), -Math.sin(a) * r); });
  const curve = new THREE.CatmullRomCurve3([P[0].clone().add(V(-0.9, -0.5, 0.9)), ...P, P[N - 1].clone().add(V(0.5, 0.9, 0.6))], false, 'centripetal');
  const T0 = 1 / (N + 1), T1 = N / (N + 1);

  const FAINT = '0.13', SPIN = '0.16';
  const R = 0.085, PITCH = 0.62, PER_TURN = 10, GROOVE = 0.78 * Math.PI, SEG = 520, SIDES = 5;
  const LEN = curve.getLength(), TURNS = LEN / PITCH, pos = [], nor = [], aT = [], aK = [], aC = [], aAx = [], idx = [], p = V(), tan = V(), n = V(), b = V();
  const on = (t, phase) => {
    curve.getPoint(t, p); curve.getTangent(t, tan); n.crossVectors(tan, V(0, 1, 0)).normalize(); b.crossVectors(n, tan);
    const a = t * TURNS * TAU + phase; return p.clone().addScaledVector(n, Math.cos(a) * R).addScaledVector(b, Math.sin(a) * R);
  };
  function tube(pts, ts, r, kind) {
    const base = pos.length / 3, u = V(), v = V(), dir = V();
    pts.forEach((q, i) => {
      dir.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
      u.crossVectors(dir, Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0)).normalize(); v.crossVectors(dir, u);
      for (let s = 0; s < SIDES; s++) {
        const a = s / SIDES * TAU, x = Math.cos(a), y = Math.sin(a), nx = u.x * x + v.x * y, ny = u.y * x + v.y * y, nz = u.z * x + v.z * y;
        pos.push(q.x + nx * r, q.y + ny * r, q.z + nz * r); nor.push(nx, ny, nz); aT.push(ts[i]); aK.push(kind);
        curve.getPoint(ts[i], p); curve.getTangent(ts[i], tan); aC.push(p.x, p.y, p.z); aAx.push(tan.x, tan.y, tan.z);
        if (i) { const c = base + i * SIDES + s, d = base + i * SIDES + (s + 1) % SIDES; idx.push(c - SIDES, d - SIDES, c, d - SIDES, d, c); }
      }
    });
  }
  const ts = Array.from({ length: SEG + 1 }, (_, i) => i / SEG);
  for (const k of [0, 1]) tube(ts.map((t) => on(t, k * GROOVE)), ts, 0.007, k);
  for (let i = 1, count = Math.floor(TURNS * PER_TURN); i < count; i++) {
    const t = i / count, a = on(t, 0), c = on(t, GROOVE), mid = a.clone().lerp(c, 0.5), flip = i % 2;
    tube([a, mid], [t, t], 0.004, 2 + flip); tube([mid, c], [t, t], 0.004, 3 - flip);
  }
  const helix = new THREE.BufferGeometry(); helix.setIndex(idx);
  for (const [name, arr, size] of [['position', pos, 3], ['normal', nor, 3], ['aT', aT, 1], ['aK', aK, 1], ['aC', aC, 3], ['aAx', aAx, 3]]) helix.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
  const track = new THREE.Mesh(helix, glsl(`uniform float uTime, uGain, uTrain, uLen; uniform vec2 uEnds; varying float vT, vK, vFace;
    void main(){
      float s = vT*uLen, strand = step(vK, 1.5);
      float built = smoothstep(uEnds.x - 0.02, uEnds.x + 0.01, vT)*(1.0 - smoothstep(uEnds.y, uEnds.y + 0.05, vT));
      float ahead = smoothstep(uEnds.y, uEnds.y + 0.03, vT);
      float d = uTrain - vT;
      float wake = d > 0.0 ? exp(-d*26.0) : 0.0, head = exp(-abs(d)*700.0);
      vec3 base = vK < 2.5 ? ${CY} : ${GOLD};
      vec3 col = strand > 0.5
        ? ${GOLD}*(0.3 + 0.7*built)*(1.0 + 1.5*wake)*mix(1.0, 0.5*step(0.5, fract(s*5.0)), ahead)
        : base*(0.08 + 0.3*built)*(1.0 + 2.5*wake)*(1.0 - 0.8*ahead);
      col = col*${FAINT} + vec3(1.0, 0.92, 0.75)*head*0.35;
      col *= (0.35 + 0.65*vFace)*smoothstep(0.0, 0.03, vT)*smoothstep(1.0, 0.985, vT);
      gl_FragColor = vec4(col*uGain, 1.0);
    }`, { ...U, uLen: { value: LEN }, uEnds: { value: new THREE.Vector2(T0, T1) } }, {
    vertexShader: `attribute float aT, aK; varying float vT, vK, vFace;
      attribute vec3 aC, aAx; uniform float uTime;
      vec3 turn(vec3 v, vec3 k, float a){ return v*cos(a) + cross(k, v)*sin(a) + k*dot(k, v)*(1.0 - cos(a)); }
      void main(){ vT = aT; vK = aK; float a = uTime*${SPIN};
        vec4 w = modelMatrix*vec4(aC + turn(position - aC, aAx, a), 1.0);
        vFace = abs(dot(normalize(mat3(modelMatrix)*turn(normal, aAx, a)), normalize(cameraPosition - w.xyz))); gl_Position = projectionMatrix*viewMatrix*w; }` }));
  track.frustumCulled = false;

  const stations = stops.map((s, i) => {
    const grp = new THREE.Group(), holder = new THREE.Group(), model = MODELS[s.model](), now = i === N - 1, col = now ? AMBER : CYAN, ink = now ? '#ffd9a8' : '#bfefff';
    const tag = label([s.title, s.sub], ink, 0.8), page = sheet({ title: s.sub, rows: s.specs }, ink, 1.5, 0.9), floor = 0.02 - P[i].y, pale = new THREE.Color(0.3, 0.9, 1.2);
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, -0.1, 0), V(0, floor, 0)]), new THREE.LineDashedMaterial({ color: pale, dashSize: 0.05, gapSize: 0.05, opacity: 0.4, ...GLOW }));
    drop.computeLineDistances(); tag.position.set(0.27, 0.1, 0); page.position.set(-0.75, 0.75, 0); page.visible = false;
    holder.add(model); holder.position.y = 0.5; grp.position.copy(P[i]); root.add(grp);
    grp.add(holder, tag, page, drop, path(circle(0.17, 48), col, 0.9), path(circle(0.21, 48), DIM, 0.5), path([V(0, 0.02, 0), V(0, 0.36, 0)], col, 0.6),
      solid(new THREE.SphereGeometry(0.03, 10, 8), col), at(solid(new THREE.RingGeometry(0.16, 0.18, 48).rotateX(-Math.PI / 2), pale), (f) => { f.position.y = floor; }));
    const open = spring(0.08);
    return { grp, holder, model, tag, page, open, size: now ? 0.62 : 0.5, t: (i + 1) / (N + 1), setExpanded: (v) => { open.to = +v; } };
  });

  const dial = new THREE.Mesh(new THREE.RingGeometry(0.66, radius - 0.08, 160, 1).rotateX(-Math.PI / 2), glsl(`uniform float uTime, uGain, uR; varying vec2 vP;
    float rule(float t,float w){float d=abs(fract(t+.5)-.5), aa=clamp(fwidth(t),.0001,.30);
      return (1.-smoothstep(max(0.,w-aa*.5),w+aa*.5,d))*min(1.,2.*w/aa);}
    void main(){ float r = length(vP)/uR, a = atan(vP.y, vP.x)/6.2832 + 0.5;
      float rings = rule(r*6.,.009)*.42;
      float ticks = step(.86,r)*(1.-step(.904,r))*rule(a*24.,.021)*.72;
      float spokes = rule(a*12.,.004)*.41*step(r,.86);
      float sweep = pow(max(0.,1.-fract(a-uTime*.03)*11.),2.)*.075*step(r,.86);
      gl_FragColor = vec4(${CY}*(rings + ticks + spokes + sweep)*0.35*uGain, 1.0); }`, { ...U, uR: { value: radius } }, { vertexShader: VERT_XZ, side: THREE.DoubleSide }));
  dial.position.y = 0.03;
  const stars = cloud(Array.from({ length: 1260 }, Math.random), new THREE.ShaderMaterial({ ...GLOW, uniforms: { ...U, uR: { value: radius } },
    vertexShader: `uniform float uTime, uPx, uGain, uR; varying float vA;
      void main(){ float a = position.x*6.2832 + uTime*0.02*(0.3 + position.z), r = uR*1.15*sqrt(position.y);
        vec4 mv = modelViewMatrix*vec4(cos(a)*r, 0.3 + position.z*4.6, sin(a)*r, 1.0); gl_Position = projectionMatrix*mv;
        float px = (0.008 + 0.014*fract(position.x*31.0))*uPx/max(-mv.z, 0.01); gl_PointSize = max(px, 1.6);
        vA = (0.35 + 0.65*sin(uTime*(0.6 + position.y*2.0) + position.x*40.0))*uGain*min(1.0, px*px/2.56)*0.6; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.7, 0.88, 1.0)*vA*smoothstep(0.5, 0.1, d), 1.0); }` }));
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, 0.5, 4.4, 56, 1, true), glsl(`uniform float uGain; varying vec2 vUv;
    void main(){ float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.2)*0.07*(0.8 + 0.2*sin(vUv.x*120.0)); gl_FragColor = vec4(${CY}*a*uGain, 1.0); }`, U, { side: THREE.DoubleSide }));
  cone.position.y = 2.2;
  const train = solid(new THREE.SphereGeometry(0.05, 12, 8), new THREE.Color(3.0, 2.4, 1.6));
  const spin = new THREE.Group(); spin.add(track, train);
  root.add(spin, dial, stars, cone);
  root.traverse(o => { if(o!==dial && !o.isSprite && (o.isMesh || o.isLine || o.isPoints)) o.layers.enable(2); });

  let last = null;
  const { turn, face, advance, homeAngle } = createTurn({ points: P, center, still: STILL });
  const home = (i) => P[i].clone().applyAxisAngle(UP, homeAngle(i)).add(center);
  function turning(dt) {
    advance(dt);
    spin.rotation.y = turn.angle();
    stations.forEach((s, i) => s.grp.position.copy(P[i]).applyAxisAngle(UP, turn.angle()));
  }

  function update(t) {
    turning(last === null ? 0 : Math.min(0.05, Math.max(0, t - last))); last = t;
    const u = Math.min((t * 0.06) % 1.25, 1), where = T0 + (T1 - T0) * u * u * (3 - 2 * u), anyOpen = stations.some((s) => s.open.to);
    U.uTrain.value = where; curve.getPoint(where, train.position);
    for (const s of stations) {
      const k = s.open.step(), calling = Math.exp(-Math.pow((where - s.t) * 28.0, 2));
      s.model.tick(t); s.tag.visible = !anyOpen || !!s.open.to;
      s.page.visible = k > 0.02; s.page.scale.set(s.page.userData.size[0] * k + 1e-4, s.page.userData.size[1] * k + 1e-4, 1);
      s.holder.position.y = 0.5 + 0.35 * k; s.holder.scale.setScalar(s.size * (1 + 0.3 * calling) * (1 + 0.9 * k));
    }
  }
  return { root, update, stations, turn, face, home };
}
