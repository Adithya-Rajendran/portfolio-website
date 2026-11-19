// The route map above the navigation table: a rail line climbing from station to station, one station per stop.
// Inspired by star-rail style navigation charts, drawn in this site's own language: gold track, cyan instruments,
// everything additive HDR light. One ribbon mesh carries rails, sleepers and the moving pulse of the train in its
// shader; stations are small wire worlds with a ring, a drop line to the table and a label.
import * as THREE from 'three';

const GOLD = 'vec3(1.0, 0.62, 0.22)', CY = 'vec3(0.2, 0.78, 1.0)';
// Placeholder stops: replaced with the real career entries later.
export const STATIONS = [
  { title: 'STATION 01', sub: 'SPACE ELEVATOR', kind: 'elevator' }, { title: 'STATION 02', sub: 'STANFORD TORUS', kind: 'torus' },
  { title: 'STATION 03', sub: "O'NEILL CYLINDERS", kind: 'cylinders' }, { title: 'STATION 04', sub: 'BUSSARD RAMJET', kind: 'ramjet' },
  { title: 'STATION 05', sub: 'DYSON SWARM', kind: 'dyson' }, { title: 'NOW', sub: 'WARP-RING SHIP', kind: 'warp' },
];

function label(text, sub, color, ADD) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = color; c.textBaseline = 'middle'; if ('letterSpacing' in c) c.letterSpacing = '6px';
  c.font = '600 40px "Helvetica Neue", "Segoe UI", Arial, sans-serif'; c.fillText(text, 14, 44);
  c.globalAlpha = 0.8; c.fillRect(14, 74, Math.min(484, c.measureText(text).width), 2);
  c.font = '500 24px "Helvetica Neue", "Segoe UI", Arial, sans-serif'; c.globalAlpha = 0.75; c.fillText(sub, 14, 100);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, depthWrite: false, ...ADD }));
  s.center.set(0, 0.5); s.scale.set(1.0, 0.25, 1); return s;
}

export function createRouteMap({ scene, center, radius = 3.1, ADD, uTime, uPx, gain = 1.6 }) {
  const root = new THREE.Group(); root.position.copy(center); scene.add(root);
  const add = { transparent: true, depthWrite: false, ...ADD }, U = { uTime, uPx, uGain: { value: gain }, uTrain: { value: 0 } };
  const N = STATIONS.length;
  // stations on a rising spiral, the newest highest and nearest the viewer's right
  const P = STATIONS.map((_, i) => { const t = i / (N - 1), a = -2.5 + t * 5.4, r = radius * (0.78 - 0.3 * t);
    return new THREE.Vector3(Math.cos(a) * r, 0.75 + t * 3.0 + 0.25 * Math.sin(t * 9.0), -Math.sin(a) * r); });
  const lead = P[0].clone().add(new THREE.Vector3(-0.9, -0.5, 0.9)), tail = P[N - 1].clone().add(new THREE.Vector3(0.5, 0.9, 0.6));
  const curve = new THREE.CatmullRomCurve3([lead, ...P, tail], false, 'centripetal');
  const T0 = 1 / (N + 1), T1 = N / (N + 1);                                          // curve parameter of the first / last station

  // ---- the track: a flat ribbon that banks with the curve
  const SEG = 480, W = 0.2, pos = [], uv = [], idx = [], up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), p = new THREE.Vector3(), tan = new THREE.Vector3();
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG; curve.getPoint(t, p); curve.getTangent(t, tan); side.crossVectors(tan, up).normalize();
    pos.push(p.x - side.x * W / 2, p.y - side.y * W / 2, p.z - side.z * W / 2, p.x + side.x * W / 2, p.y + side.y * W / 2, p.z + side.z * W / 2);
    uv.push(0, t, 1, t); if (i < SEG) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const len = curve.getLength();
  const track = new THREE.Mesh(g, new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: { ...U, uLen: { value: len }, uEnds: { value: new THREE.Vector2(T0, T1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, uGain, uTrain, uLen; uniform vec2 uEnds; varying vec2 vUv;
      void main(){
        float x = abs(vUv.x - 0.5)*2.0, s = vUv.y*uLen;
        float rails = smoothstep(0.1, 0.0, abs(x - 0.82));                                // two rails
        float ties = step(x, 0.95)*step(fract(s*9.0), 0.22)*0.32;                         // sleepers
        float built = smoothstep(uEnds.x - 0.02, uEnds.x + 0.01, vUv.y)*(1.0 - smoothstep(uEnds.y, uEnds.y + 0.05, vUv.y));
        float ahead = smoothstep(uEnds.y, uEnds.y + 0.03, vUv.y)*step(0.5, fract(s*5.0));    // the line beyond "now": still dashed
        float d = uTrain - vUv.y;                                                         // > 0 behind the train
        float wake = d > 0.0 ? exp(-d*26.0) : 0.0, head = exp(-abs(d)*900.0);
        vec3 col = ${GOLD}*(rails*0.9 + ties)*(0.35 + 0.65*built)*(1.0 + 3.0*wake) + ${GOLD}*rails*ahead*0.5 + vec3(1.0, 0.92, 0.75)*head*3.0*step(x, 0.95);
        col *= smoothstep(0.0, 0.03, vUv.y)*smoothstep(1.0, 0.985, vUv.y);
        gl_FragColor = vec4(col*uGain, 1.0);
      }` }));
  track.frustumCulled = false; root.add(track);

  // ---- stations: each stop is a different piece of imagined engineering, drawn as a wire model that moves
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, opacity, ...add });
  const glow = (color) => new THREE.MeshBasicMaterial({ color, ...add });
  const CYAN = new THREE.Color(0.35, 1.3, 1.9), DIM = new THREE.Color(0.16, 0.55, 0.85), GOLDC = new THREE.Color(2.0, 1.25, 0.5), V = (x, y, z) => new THREE.Vector3(x, y, z);
  const wire = (geo, col = CYAN, op = 0.75, thr = 1) => new THREE.LineSegments(new THREE.EdgesGeometry(geo, thr), lineMat(col, op));
  const path = (pts, col = CYAN, op = 0.8) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, op));
  const pairs = (pts, col = CYAN, op = 0.8) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, op));
  const solid = (geo, col) => new THREE.Mesh(geo, glow(col));
  const dots = (arr, col, size = 0.022) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size, sizeAttenuation: true, ...add })); p.frustumCulled = false; return p; };
  const circle = (r, n = 64, y = 0) => Array.from({ length: n + 1 }, (_, i) => V(Math.cos(i / n * 6.2832) * r, y, Math.sin(i / n * 6.2832) * r));
  const BUILD = {
    // a tether from the equator to a counterweight beyond geostationary orbit, with a climber on its way up
    elevator() { const g = new THREE.Group(), planet = new THREE.Group(); g.add(planet); g.rotation.z = -0.5;
      planet.add(wire(new THREE.IcosahedronGeometry(0.42, 2), DIM, 0.45), solid(new THREE.SphereGeometry(0.4, 24, 16), new THREE.Color(0.01, 0.05, 0.09)), path(circle(0.425), CYAN, 0.9));
      for (const la of [-0.5, 0.5]) planet.add(path(circle(0.425 * Math.cos(la), 48, 0.425 * Math.sin(la)), DIM, 0.6));
      g.add(path([V(0.42, 0, 0), V(1.62, 0, 0)], GOLDC, 0.9));
      const port = wire(new THREE.OctahedronGeometry(0.07), CYAN, 1); port.position.x = 1.05; g.add(port);
      const ring = path(circle(0.15, 32), CYAN, 0.8); ring.rotation.z = Math.PI / 2; ring.position.x = 1.05; g.add(ring);
      const cw = wire(new THREE.BoxGeometry(0.12, 0.09, 0.09), GOLDC, 1); cw.position.x = 1.62; g.add(cw);
      g.add(path(circle(1.05, 96), DIM, 0.3));                                     // geostationary orbit
      const climber = solid(new THREE.SphereGeometry(0.028, 10, 8), GOLDC); g.add(climber);
      g.position.set(-0.45, -0.1, 0); const o = new THREE.Group(); o.add(g);
      o.tick = (t) => { planet.rotation.y = t * 0.25; climber.position.x = 0.45 + ((t * 0.1) % 1) * 1.12; }; return o; },
    // a spinning wheel habitat: rim, spokes, hub, and the big mirror that feeds it sunlight
    torus() { const o = new THREE.Group(), wheel = new THREE.Group(); o.add(wheel); o.rotation.set(0.5, 0, 0.3);
      const rim = wire(new THREE.TorusGeometry(0.55, 0.085, 8, 40), CYAN, 0.55); rim.rotation.x = Math.PI / 2; wheel.add(rim);
      wheel.add(wire(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), CYAN, 0.9), path(circle(0.47, 64), GOLDC, 0.9));
      const sp = [], lights = new Float32Array(36);
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; sp.push(V(Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07), V(Math.cos(a) * 0.47, 0, Math.sin(a) * 0.47)); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; lights.set([Math.cos(a) * 0.64, 0, Math.sin(a) * 0.64], i * 3); }
      wheel.add(pairs(sp, CYAN, 0.8), dots(lights, GOLDC, 0.03));
      const mirror = new THREE.Group(); mirror.add(path(circle(0.72, 64), DIM, 0.8), path(circle(0.3, 32), DIM, 0.6));
      const mr = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; mr.push(V(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3), V(Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72)); }
      mirror.add(pairs(mr, DIM, 0.35)); mirror.position.y = 0.5; mirror.rotation.x = 0.35; o.add(mirror);
      o.add(path([V(0, -0.45, 0), V(0, 0.5, 0)], CYAN, 0.6));
      o.tick = (t) => { wheel.rotation.y = t * 0.6; }; return o; },
    // a pair of counter-rotating cylinder habitats, each with three long mirrors
    cylinders() { const o = new THREE.Group(); o.rotation.set(0.25, 0.6, 0.2); const cyls = [];
      for (const d of [-1, 1]) { const c = new THREE.Group(); c.position.z = d * 0.3; o.add(c); cyls.push(c);
        const body = wire(new THREE.CylinderGeometry(0.19, 0.19, 1.1, 12, 4, true), d < 0 ? CYAN : DIM, 0.6); body.rotation.z = Math.PI / 2; c.add(body);
        for (const e of [-1, 1]) { const cap = wire(new THREE.ConeGeometry(0.19, 0.16, 12, 1, true), CYAN, 0.6); cap.rotation.z = -e * Math.PI / 2; cap.position.x = e * 0.63; c.add(cap); }
        for (let i = 0; i < 3; i++) { const a = i / 3 * 6.2832, y = Math.cos(a), z = Math.sin(a);       // mirrors hinged at one end, opened out
          c.add(path([V(-0.55, y * 0.19, z * 0.19), V(0.5, y * 0.52, z * 0.52), V(0.5, y * 0.52 - z * 0.12, z * 0.52 + y * 0.12), V(-0.55, y * 0.19 - z * 0.07, z * 0.19 + y * 0.07), V(-0.55, y * 0.19, z * 0.19)], GOLDC, 0.75)); } }
      o.add(pairs([V(-0.5, 0, -0.3), V(-0.5, 0, 0.3), V(0.5, 0, -0.3), V(0.5, 0, 0.3), V(-0.5, 0, -0.3), V(0.5, 0, 0.3)], DIM, 0.6));
      o.tick = (t) => { cyls[0].rotation.x = t * 0.5; cyls[1].rotation.x = -t * 0.5; }; return o; },
    // an interstellar ramjet: a magnetic funnel scooping up hydrogen ahead, a bright exhaust behind
    ramjet() { const o = new THREE.Group(); o.rotation.set(0.15, -0.5, 0.25);
      const R = (x) => 0.1 + 0.62 * Math.pow(Math.max(0, x - 0.1) / 0.85, 1.6);
      for (const x of [0.2, 0.4, 0.6, 0.8, 0.95]) { const c = path(circle(R(x), 48), DIM, 0.35 + x * 0.4); c.rotation.z = Math.PI / 2; c.position.x = x; o.add(c); }
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; o.add(path(Array.from({ length: 12 }, (_, k) => { const x = 0.1 + k / 11 * 0.85; return V(x, Math.cos(a) * R(x), Math.sin(a) * R(x)); }), DIM, 0.4)); }
      o.add(path([V(-0.85, 0, 0), V(0.12, 0, 0)], CYAN, 1));
      const hab = wire(new THREE.TorusGeometry(0.13, 0.03, 6, 20), CYAN, 0.8); hab.rotation.y = Math.PI / 2; hab.position.x = -0.12; o.add(hab);
      for (const z of [-0.09, 0.09]) { const tank = wire(new THREE.SphereGeometry(0.075, 8, 6), GOLDC, 0.7); tank.position.set(-0.45, 0, z); o.add(tank); }
      const noz = wire(new THREE.ConeGeometry(0.12, 0.2, 10, 1, true), GOLDC, 0.9); noz.rotation.z = -Math.PI / 2; noz.position.x = -0.85; o.add(noz);
      const N = 70, arr = new Float32Array(N * 3), seed = Array.from({ length: N }, () => [Math.random(), Math.random() * 6.2832, Math.random()]);
      const gas = dots(arr, new THREE.Color(0.5, 1.4, 2.0), 0.016); o.add(gas);
      const M = 40, arr2 = new Float32Array(M * 3), seed2 = Array.from({ length: M }, () => [Math.random(), Math.random() * 6.2832, Math.random()]);
      const exhaust = dots(arr2, new THREE.Color(2.4, 1.5, 0.6), 0.024); o.add(exhaust);
      o.tick = (t) => {
        seed.forEach(([p, a, r], i) => { const x = 1.0 - ((p + t * 0.22) % 1) * 0.9, rr = R(x) * (0.2 + 0.8 * r); arr.set([x, Math.cos(a) * rr, Math.sin(a) * rr], i * 3); });
        seed2.forEach(([p, a, r], i) => { const u = (p + t * 0.6) % 1; arr2.set([-0.95 - u * 0.75, Math.cos(a) * r * 0.1 * (1 + u), Math.sin(a) * r * 0.1 * (1 + u)], i * 3); });
        gas.geometry.attributes.position.needsUpdate = true; exhaust.geometry.attributes.position.needsUpdate = true; hab.rotation.x = t * 0.8; };
      return o; },
    // a star wrapped in rings of collectors
    dyson() { const o = new THREE.Group(); o.rotation.set(0.35, 0, 0.2);
      o.add(solid(new THREE.SphereGeometry(0.15, 20, 14), new THREE.Color(3.0, 1.9, 0.7)), wire(new THREE.IcosahedronGeometry(0.21, 1), GOLDC, 0.6));
      const rings = [[0.42, 110, 0.0, 0.5], [0.6, 150, 1.0, -0.33], [0.8, 190, -0.7, 0.22]].map(([r, n, tilt, speed]) => { const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + Math.random() * 0.03; arr.set([Math.cos(a) * (r + (Math.random() - 0.5) * 0.05), (Math.random() - 0.5) * 0.07, Math.sin(a) * (r + (Math.random() - 0.5) * 0.05)], i * 3); }
        const h = new THREE.Group(), sp = new THREE.Group(); h.rotation.x = tilt; h.add(sp); sp.add(dots(arr, CYAN, 0.02), path(circle(r, 96), DIM, 0.25)); o.add(h); return [sp, speed]; });
      const hexes = new THREE.Group(); o.add(hexes);                                 // a few large collectors, facing the star
      for (let i = 0; i < 16; i++) { const d = V(Math.random() - 0.5, (Math.random() - 0.5) * 0.9, Math.random() - 0.5).normalize(), h = path(circle(0.075, 6), GOLDC, 0.8);
        h.position.copy(d.clone().multiplyScalar(0.52)); h.quaternion.setFromUnitVectors(V(0, 1, 0), d); hexes.add(h); }
      o.tick = (t) => { for (const [sp, speed] of rings) sp.rotation.y = t * speed; hexes.rotation.y = t * 0.12; }; return o; },
    // a ship inside two field rings, riding a wave in space itself: squeezed ahead, stretched behind
    warp() { const o = new THREE.Group(); o.rotation.set(0.3, -0.7, 0.1);
      const hull = wire(new THREE.OctahedronGeometry(0.11, 1), GOLDC, 0.9); hull.scale.set(3.4, 1, 1); o.add(hull);
      const rings = [-0.26, 0.26].map((x) => { const r = wire(new THREE.TorusGeometry(0.34, 0.045, 6, 32), GOLDC, 0.7); r.rotation.y = Math.PI / 2; r.position.x = x; o.add(r); return r; });
      o.add(pairs([V(-0.26, 0.3, 0), V(-0.1, 0.06, 0), V(-0.26, -0.3, 0), V(-0.1, -0.06, 0), V(0.26, 0.3, 0), V(0.1, 0.06, 0), V(0.26, -0.3, 0), V(0.1, -0.06, 0)], GOLDC, 0.6));
      const bump = (x, z) => -0.42 + 0.26 * (Math.exp(-((x - 0.55) ** 2 + z * z) * 5) - Math.exp(-((x + 0.55) ** 2 + z * z) * 5)), gp = [];
      for (let i = -6; i <= 6; i++) { const c = i * 0.17;
        for (let k = 0; k < 24; k++) { const a = -1.02 + k * 0.085, b = a + 0.085; gp.push(V(a, bump(a, c), c), V(b, bump(b, c), c), V(c, bump(c, a), a), V(c, bump(c, b), b)); } }
      o.add(pairs(gp, DIM, 0.5));
      o.tick = (t) => { rings.forEach((r, i) => { r.rotation.x = t * (i ? 1.4 : -1.4); r.scale.setScalar(1 + 0.05 * Math.sin(t * 4 + i * 3.14)); }); }; return o; },
  };
  const SPECS = {
    elevator: [['PROPOSED', 'TSIOLKOVSKY  ·  1895'], ['TETHER', '~100,000 KM'], ['ANCHOR', 'EQUATOR'], ['STATION AT', 'GEO  ·  35,786 KM'], ['CLIMB', 'ABOUT A WEEK']],
    torus: [['STUDY', 'NASA / STANFORD  ·  1975'], ['DIAMETER', '1.8 KM'], ['SPIN', '1 RPM  ·  1 g AT RIM'], ['RESIDENTS', '10,000'], ['LIGHT', 'OVERHEAD MIRROR']],
    cylinders: [['PROPOSED', "G. K. O'NEILL  ·  1976"], ['EACH', '8 KM x 32 KM'], ['LAYOUT', 'COUNTER-ROTATING PAIR'], ['INTERIOR', '3 LAND  ·  3 WINDOW STRIPS'], ['RESIDENTS', 'MILLIONS']],
    ramjet: [['PROPOSED', 'R. W. BUSSARD  ·  1960'], ['FUEL', 'INTERSTELLAR HYDROGEN'], ['COLLECTOR', 'MAGNETIC SCOOP'], ['DRIVE', 'FUSION'], ['CARRIES', 'NO PROPELLANT']],
    dyson: [['PROPOSED', 'F. DYSON  ·  1960'], ['FORM', 'SWARM OF COLLECTORS'], ['CAPTURES', 'A STAR\'S OUTPUT'], ['SOL', '3.8 x 10^26 W'], ['SIGNATURE', 'INFRARED EXCESS']],
    warp: [['METRIC', 'M. ALCUBIERRE  ·  1994'], ['AHEAD', 'SPACE CONTRACTS'], ['BEHIND', 'SPACE EXPANDS'], ['SHIP', 'AT REST IN ITS BUBBLE'], ['NEEDS', 'NEGATIVE ENERGY']],
  };
  const stations = STATIONS.map((s, i) => {
    const grp = new THREE.Group(); grp.position.copy(P[i]); root.add(grp);
    const now = i === N - 1, model = BUILD[s.kind](), size = now ? 0.62 : 0.5, lift = 0.5;
    const holder = new THREE.Group(); holder.position.y = lift; holder.scale.setScalar(size); holder.add(model); grp.add(holder);
    // the stop itself: a platform halo round the track, a stem up to the model, a signal lamp
    const halo = path(circle(0.17, 48), now ? GOLDC : CYAN, 0.9); grp.add(halo, path(circle(0.21, 48), DIM, 0.5));
    grp.add(path([V(0, 0.02, 0), V(0, lift - 0.14, 0)], now ? GOLDC : CYAN, 0.6), solid(new THREE.SphereGeometry(0.03, 10, 8), now ? GOLDC : CYAN));
    // drop line to the table and a footprint ring there
    const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, -0.1, 0), V(0, -P[i].y + 0.02, 0)]),
      new THREE.LineDashedMaterial({ color: new THREE.Color(0.3, 0.9, 1.2), dashSize: 0.05, gapSize: 0.05, opacity: 0.4, ...add })); drop.computeLineDistances(); grp.add(drop);
    const foot = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.18, 48).rotateX(-Math.PI / 2), glow(new THREE.Color(0.3, 0.9, 1.2))); foot.position.y = -P[i].y + 0.02; grp.add(foot);
    const l = label(s.title, s.sub, now ? '#ffd9a8' : '#bfefff', ADD); l.position.set(0.27, 0.1, 0); l.scale.set(0.8, 0.2, 1); grp.add(l);       // beside the platform, under its model
    // data sheet, unfolded when the station is opened
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const c = cv.getContext('2d'), F = '"Helvetica Neue", "Segoe UI", Arial, sans-serif', col = now ? '#ffd9a8' : '#bfefff';
    c.textBaseline = 'middle'; c.fillStyle = col; if ('letterSpacing' in c) c.letterSpacing = '5px'; c.font = `600 30px ${F}`; c.fillText(s.sub, 16, 30); c.fillRect(16, 54, 480, 2);
    (SPECS[s.kind] || []).forEach(([k, v], j) => { const y = 96 + j * 46; c.font = `500 19px ${F}`; c.globalAlpha = 0.6; c.textAlign = 'left'; c.fillText(k, 16, y); c.globalAlpha = 1; c.font = `500 23px ${F}`; c.textAlign = 'right'; c.fillText(v, 496, y);
      c.globalAlpha = 0.25; c.fillRect(16, y + 22, 480, 1); c.globalAlpha = 1; });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sheet = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, depthWrite: false, depthTest: false, ...ADD })); sheet.center.set(1, 0.5);
    sheet.position.set(-0.75, lift + 0.25, 0); sheet.visible = false; sheet.renderOrder = 10; grp.add(sheet);
    return { grp, holder, model, size, sheet, label: l, ex: 0, target: 0, setExpanded(v) { this.target = v ? 1 : 0; }, t: (i + 1) / (N + 1) };
  });

  // ---- the table surface: chart rings and bearings
  const dial = new THREE.Mesh(new THREE.RingGeometry(0.66, radius - 0.08, 160, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: { ...U, uR: { value: radius } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, uGain, uR; varying vec2 vP;
      void main(){ float r = length(vP)/uR, a = atan(vP.y, vP.x)/6.2832 + 0.5;
        float rings = smoothstep(0.012, 0.0, abs(fract(r*6.0) - 0.5) - 0.47)*0.5;
        float ticks = step(0.9, r)*step(fract(a*120.0), 0.12)*0.8 + step(0.86, r)*step(fract(a*24.0), 0.03);
        float spokes = step(fract(a*12.0), 0.004)*0.6*step(r, 0.86);
        float sweep = pow(max(0.0, 1.0 - fract(a - uTime*0.03)*5.0), 2.0)*0.35*step(r, 0.86);
        gl_FragColor = vec4(${CY}*(rings + ticks + spokes + sweep)*0.35*uGain, 1.0); }` }));
  dial.position.y = 0.03; root.add(dial);

  // ---- stars drifting in the volume, and the projector's light
  { const M = 420, s = new Float32Array(M * 3); for (let i = 0; i < M * 3; i++) s[i] = Math.random();
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(s, 3));
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({ ...add, uniforms: { ...U, uR: { value: radius } },
      vertexShader: `uniform float uTime, uPx, uGain, uR; varying float vA;
        void main(){ float a = position.x*6.2832 + uTime*0.02*(0.3 + position.z), r = uR*1.15*sqrt(position.y);
          vec3 p = vec3(cos(a)*r, 0.3 + position.z*4.6, sin(a)*r);
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          float px = (0.008 + 0.014*fract(position.x*31.0))*uPx/max(-mv.z, 0.01); gl_PointSize = max(px, 1.6);
          vA = (0.35 + 0.65*sin(uTime*(0.6 + position.y*2.0) + position.x*40.0))*uGain*min(1.0, px*px/2.56)*0.6; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.7, 0.88, 1.0)*vA*smoothstep(0.5, 0.1, d), 1.0); }` }));
    stars.frustumCulled = false; root.add(stars); }
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, 0.5, 4.4, 56, 1, true), new THREE.ShaderMaterial({ ...add, side: THREE.DoubleSide, uniforms: U,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime, uGain; varying vec2 vUv;
      void main(){ float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 2.2)*0.07*(0.8 + 0.2*sin(vUv.x*120.0));
        gl_FragColor = vec4(${CY}*a*uGain, 1.0); }` }));
  cone.position.y = 2.2; root.add(cone);

  const train = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glow(new THREE.Color(3.0, 2.4, 1.6))); root.add(train);
  function update(t) {
    // the train runs the built line from the first station to "now", pauses, and starts again
    const cyc = (t * 0.06) % 1.25, u = Math.min(cyc, 1), e = u * u * (3 - 2 * u), tt = T0 + (T1 - T0) * e;
    U.uTrain.value = tt; curve.getPoint(tt, train.position);
    const open = stations.some((s) => s.target > 0);
    for (const s of stations) {
      s.model.tick(t); s.label.visible = !open || s.target > 0;            // while one station is open the other name tags step back
      s.ex += (s.target - s.ex) * 0.08; const k = s.ex * s.ex * (3 - 2 * s.ex);                              // opened: the model grows, its data sheet unfolds
      s.sheet.visible = k > 0.02; s.sheet.scale.set(1.5 * k + 1e-4, 0.88 * k + 1e-4, 1); s.holder.position.y = 0.5 + 0.35 * k;
      const near = Math.exp(-Math.pow((tt - s.t) * 28.0, 2)); s.holder.scale.setScalar(s.size * (1 + 0.3 * near) * (1 + 0.9 * k));   // a station swells as the train calls
    }
  }
  return { root, update, stations, curve };
}
