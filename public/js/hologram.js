// The holographic mission display above the dais: Earth, the orbit of the station and their labels.
import * as THREE from 'three';
import { GLOW, VERT_XZ, CY, GOLD, V, cy, gold, uTime, uPx, lineMat, glow, glsl, cloud, label, sheet, spring } from './kit.js';

const maps = {};
const pixels = (src) => (maps[src] ??= (async () => {
  const img = new Image(); img.src = src; await img.decode();
  const cv = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
  return { d: cx.getImageData(0, 0, cv.width, cv.height).data, w: cv.width, h: cv.height };
})());
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

export async function createHologram({ scene, position, sunDir, text, base, ver = '', lensY = 0.52, gain = 1.5, radius = 0.62 }) {
  const R = radius, K = R / 0.62, DEG = Math.PI / 180;
  const root = new THREE.Group(); root.position.copy(position); scene.add(root);
  const U = { uTime, uPx, uSun: { value: sunDir }, uScan: { value: 0 }, uGain: { value: 1 } };
  const ll = (lat, lon, r = R) => V(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));

  const tilt = new THREE.Group(); tilt.rotation.z = 0.41; root.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  {
    const [land, city] = await Promise.all([pixels(`${base}/tex/landmask.png${ver}`), pixels(`${base}/tex/citylights.png${ver}`)]);
    const P = [], kind = [], seed = [];
    const isLand = (x, y) => land.d[(Math.min(land.h - 1, Math.max(0, y)) * land.w + ((x + land.w) % land.w)) * 4] > 127;
    const add = (v, k, i) => { P.push(v.x, v.y, v.z); kind.push(k); seed.push(i); };
    for (let y = 0; y < land.h; y++) {
      const lat = (0.5 - (y + 0.5) / land.h) * Math.PI; if (Math.abs(lat) > 1.45) continue;
      for (let x = 0; x < land.w; x++) {
        if (!isLand(x, y) || (isLand(x - 1, y) && isLand(x + 1, y) && isLand(x, y - 1) && isLand(x, y + 1))) continue;
        if (hash(x, y) > Math.cos(lat) * 1.15) continue;
        add(ll(lat, ((x + 0.5) / land.w - 0.5) * 2 * Math.PI), 1, hash(y, x));
      }
    }
    for (let i = 0, N = 12000; i < N; i++) {
      const lat = Math.asin(1 - 2 * (i + 0.5) / N), lon = ((i * 2.399963) % (2 * Math.PI)) - Math.PI;
      if (isLand(Math.floor((lon / (2 * Math.PI) + 0.5) * land.w), Math.floor((0.5 - lat / Math.PI) * land.h))) add(ll(lat, lon), 0, hash(i, 1));
    }
    for (let y = 0; y < city.h; y++) {
      const lat = (0.5 - (y + 0.5) / city.h) * Math.PI, c = Math.cos(lat);
      for (let x = 0; x < city.w; x++) {
        const v = city.d[(y * city.w + x) * 4] / 255;
        if (v < 0.12 || hash(x + 7, y + 3) > v * v * 2.4 * c + 0.03) continue;
        add(ll(lat, ((x + 0.5) / city.w - 0.5) * 2 * Math.PI, R * 1.004), 2, v);
      }
    }
    spin.add(cloud(P, new THREE.ShaderMaterial({ ...GLOW, uniforms: U,
      vertexShader: `attribute float aKind, aI; uniform vec3 uSun; uniform float uTime, uPx, uScan, uGain; varying vec3 vCol;
        void main(){
          vec4 w = modelMatrix*vec4(position, 1.0);
          vec3 n = normalize(mat3(modelMatrix)*position), v = normalize(cameraPosition - w.xyz);
          float facing = dot(n, v), day = smoothstep(-0.15, 0.25, dot(n, uSun));
          float front = smoothstep(-0.3, 0.12, facing);
          float rim = 1.0 + 1.5*pow(1.0 - abs(facing), 3.0);
          float scan = exp(-pow((n.y - uScan)/0.06, 2.0));
          vec3 col; float size;
          if (aKind > 1.5) {
            float tw = 0.7 + 0.3*sin(uTime*(1.5 + aI*4.0) + aI*57.0);
            col = ${GOLD}*(0.5 + 2.2*aI)*tw*(1.0 - 0.9*day); size = 0.009 + 0.012*aI;
          } else if (aKind > 0.5) { col = ${CY}*(0.5 + 0.7*day); size = 0.0085; }
          else { col = ${CY}*(0.10 + 0.32*day); size = 0.008; }
          col = col*mix(0.16, 1.0, front)*rim + ${CY}*scan*0.8*front;
          vec4 mv = viewMatrix*w; gl_Position = projectionMatrix*mv;
          float px = size*uPx/max(-mv.z, 0.01);
          gl_PointSize = max(px, 1.6);
          vCol = col*uGain*min(1.0, px*px/2.56);
        }`,
      fragmentShader: `varying vec3 vCol; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vCol*smoothstep(0.5, 0.15, d), 1.0); }`,
    }), { aKind: kind, aI: seed }));
  }
  {
    const p = [];
    for (let la = -60; la <= 60; la += 30) for (let i = 0; i < 96; i++) p.push(ll(la * DEG, i / 96 * 6.2832), ll(la * DEG, (i + 1) / 96 * 6.2832));
    for (let lo = 0; lo < 360; lo += 30) for (let i = 0; i < 48; i++) p.push(ll((i / 48 - 0.5) * Math.PI, lo * DEG), ll(((i + 1) / 48 - 0.5) * Math.PI, lo * DEG));
    spin.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(p), lineMat(cy(0.9), 0.1)));
    const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, -R * 1.32, 0), V(0, R * 1.32, 0)]),
      new THREE.LineDashedMaterial({ color: cy(1.2), dashSize: 0.03, gapSize: 0.025, opacity: 0.6, ...GLOW }));
    axis.computeLineDistances(); tilt.add(axis);
  }
  const shellMat = new THREE.ShaderMaterial({ ...GLOW, uniforms: U,
    vertexShader: `varying vec3 vN, vW;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uTime, uGain; varying vec3 vN, vW;
      void main(){ vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        float f = pow(1.0 - max(dot(n, v), 0.0), 2.6), day = smoothstep(-0.3, 0.4, dot(n, uSun));
        float lines = 0.8 + 0.2*sin(vW.y*230.0 - uTime*2.5);
        gl_FragColor = vec4(${CY}*(0.025 + 0.8*f)*(0.4 + 0.6*day)*lines*uGain, 1.0); }` });
  root.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 48, 32), shellMat));
  const scanDisc = new THREE.Mesh(new THREE.RingGeometry(0.001, 1, 72).rotateX(-Math.PI / 2), glsl(`uniform float uGain; varying vec2 vP;
    void main(){ float r = length(vP), a = smoothstep(0.84, 0.985, r)*(1.0 - smoothstep(0.985, 1.0, r))*0.5 + 0.025;
      gl_FragColor = vec4(${CY}*a*uGain, 1.0); }`, U, { vertexShader: VERT_XZ, side: THREE.DoubleSide }));
  root.add(scanDisc);

  const ringGeo = (r, tube) => new THREE.TorusGeometry(r, tube, 6, 220).rotateX(Math.PI / 2);
  const trailMat = (color, dots) => glsl(`uniform float uPhase, uGain; uniform vec3 uColor; varying vec2 vUv;
    void main(){ float d = fract(uPhase - vUv.x);
      float b = 0.2 + 1.9*exp(-d*9.0); ${dots ? 'b *= step(0.5, fract(vUv.x*150.0));' : ''}
      gl_FragColor = vec4(uColor*b*uGain, 1.0); }`, { uPhase: { value: 0 }, uColor: { value: color }, uGain: U.uGain });
  const marker = (r, color) => {
    const g = new THREE.Group(); g.halo = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(r * 2.4)), lineMat(color, 0.7));
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(r), glow(color)), g.halo); return g;
  };
  const orbit = new THREE.Group(); orbit.rotation.set(0.45, 0, 0); root.add(orbit);
  const RO = 0.78 * K, orbitMat = trailMat(cy(1.3), false);
  const station = marker(0.02, new THREE.Color(1.6, 2.6, 3.2)), stationLabel = label(text.station);
  orbit.add(new THREE.Mesh(ringGeo(RO, 0.0032), orbitMat), station, stationLabel);

  const moonOrbit = new THREE.Group(); moonOrbit.rotation.set(-0.12, 0, 0.1); root.add(moonOrbit);
  const RM = 1.5 * K, moonMat = trailMat(cy(0.7), true), moon = new THREE.Group();
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(0.085 * K, 24, 16), shellMat),
    new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.08 * K, 1)), lineMat(cy(1.0), 0.35)));
  moonOrbit.add(new THREE.Mesh(ringGeo(RM, 0.0026), moonMat), moon);

  const way = new THREE.CatmullRomCurve3(Array.from({ length: 81 }, (_, i) => {
    const s = i / 80, a = 0.6 + 4.2 * Math.pow(s, 0.75), r = RO + 1.25 * K * Math.pow(s, 1.7);
    return V(r * Math.cos(a), 0.75 * K * s * s, r * Math.sin(a));
  }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 14), glow(gold(2.2)));
  tip.position.copy(way.getPoint(1)); tip.quaternion.setFromUnitVectors(V(0, 1, 0), way.getTangent(1));
  const ark = marker(0.024, new THREE.Color(3.2, 2.2, 1.0)), arkLabel = label(text.destination, '#ffd9a8');
  arkLabel.position.copy(tip.position).add(V(0.06, 0.1, 0));
  orbit.add(tip, ark, arkLabel, new THREE.Mesh(new THREE.TubeGeometry(way, 260, 0.0048, 5, false), glsl(`uniform float uTime, uGain; varying vec2 vUv;
    void main(){ float flow = smoothstep(0.3, 0.5, fract(vUv.x*64.0 - uTime*0.55)), fade = smoothstep(0.0, 0.05, vUv.x)*smoothstep(1.0, 0.93, vUv.x);
      gl_FragColor = vec4(${GOLD}*(0.3 + 1.5*flow)*fade*uGain, 1.0); }`, U)));

  const y0 = lensY - position.y, y1 = -R * 0.78;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, 0.42, y1 - y0, 56, 1, true), glsl(`uniform float uTime, uGain; varying vec2 vUv;
    void main(){ float a = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.7)*0.2;
      a *= 0.72 + 0.28*sin(vUv.y*80.0 - uTime*4.5); a *= 0.82 + 0.18*sin(vUv.x*140.0);
      gl_FragColor = vec4(${CY}*a*uGain, 1.0); }`, U, { side: THREE.DoubleSide }));
  cone.position.y = (y0 + y1) / 2;
  const motes = cloud(Array.from({ length: 660 }, Math.random), new THREE.ShaderMaterial({ ...GLOW,
    uniforms: { ...U, uY: { value: new THREE.Vector2(y0, y1) }, uR: { value: new THREE.Vector2(0.38, R * 0.88) } },
    vertexShader: `uniform float uTime, uPx, uGain; uniform vec2 uY, uR; varying float vA;
      void main(){ float h = fract(position.z + uTime*0.07*(0.5 + position.y)), a = position.x*6.2832 + uTime*0.2;
        float r = mix(uR.x, uR.y, h)*sqrt(position.y);
        vec4 mv = modelViewMatrix*vec4(cos(a)*r, mix(uY.x, uY.y, h), sin(a)*r, 1.0); gl_Position = projectionMatrix*mv;
        float px = 0.012*uPx/max(-mv.z, 0.01); gl_PointSize = max(px, 1.6);
        vA = sin(h*3.14159)*uGain*min(1.0, px*px/2.56); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(${CY}*1.4*vA*smoothstep(0.5, 0.1, d), 1.0); }` }));
  const TICKS = ['b = step(0.07, fract(a*6.0))*0.75;',
    'float tk = fract(a*180.0), major = step(fract(a*18.0), 1.0/10.0); b = step(tk, 0.2)*mix(step(0.55, rr)*0.55, 1.0, major);',
    'b = step(fract(a*3.0), 0.6)*0.9;'];
  const dials = [[0.745, 0.76, 0.07], [0.9, 0.99, 0.12], [1.21, 1.225, 0.17]].map(([r0, r1, lift], mode) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0 * K, r1 * K, 160, 1).rotateX(-Math.PI / 2), glsl(`uniform float uGain; uniform vec2 uR; varying vec2 vP;
      void main(){ float a = atan(vP.y, vP.x)/6.2832 + 0.5, rr = (length(vP) - uR.x)/(uR.y - uR.x), b;
        ${TICKS[mode]}
        gl_FragColor = vec4(${CY}*b*uGain*0.9, 1.0); }`, { uGain: U.uGain, uR: { value: new THREE.Vector2(r0 * K, r1 * K) } }, { vertexShader: VERT_XZ, side: THREE.DoubleSide }));
    m.position.y = y0 + lift; return m;
  });
  root.add(cone, motes, ...dials);

  const details = [];
  const detail = (parent, ...children) => {
    const g = new THREE.Group(); g.scale.setScalar(1e-4); g.visible = false; parent.add(g); details.push(g);
    if (children.length) g.add(...children);
    return g;
  };
  {
    const leaders = [], cities = detail(spin);
    for (const [name, lat, lon] of text.cities) {
      const a = ll(lat * DEG, lon * DEG, R * 1.01), b = ll(lat * DEG, lon * DEG, R * 1.2); leaders.push(a, b);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glow(gold(2.4))); dot.position.copy(a);
      const tag = label([name, `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`], '#ffd9a8', 0.34);
      tag.position.copy(b); cities.add(dot, tag);
    }
    cities.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(leaders), lineMat(gold(1.6), 0.8)));
  }
  const RR = R * 1.24, relayTag = label(text.relay, undefined, 0.5); relayTag.position.set(RR, 0.06, 0);
  const relay = detail(root, relayTag, new THREE.Mesh(ringGeo(RR, 0.0018), glow(cy(0.5))),
    cloud(Array.from({ length: 24 }, (_, i) => [Math.cos(i / 24 * 6.2832) * RR, 0, Math.sin(i / 24 * 6.2832) * RR]).flat(), new THREE.PointsMaterial({ color: cy(2.2), size: 0.028, ...GLOW })));
  relay.rotation.set(-0.9, 0, 0.5);
  detail(moon, label(text.moon, undefined, 0.5)).position.set(0.12, 0.1, 0);
  detail(root, sheet(text.panel)).position.set(-R * 1.75, R * 0.55, 0.2);

  const open = spring(0.07), baseY = root.position.y;
  function update(t) {
    if (Math.abs(open.to - open.x) > 1e-3) {
      const k = open.step();
      root.scale.setScalar(1 + 0.55 * k); root.position.y = baseY + 0.55 * k;
      for (const g of details) { g.visible = k > 0.02; g.scale.setScalar(Math.max(1e-4, k)); }
    }
    relay.rotation.y = t * 0.07;
    U.uGain.value = gain * (0.95 + 0.05 * Math.sin(t * 23.0) * Math.sin(t * 5.1));
    spin.rotation.y = t * 0.09;
    const s = Math.sin(t * 0.42) * 0.97; U.uScan.value = s;
    scanDisc.position.y = s * R; scanDisc.scale.setScalar(R * Math.sqrt(1 - s * s) * 1.07);
    const p = (t * 0.03) % 1, a = p * 2 * Math.PI;
    orbitMat.uniforms.uPhase.value = p; station.position.set(RO * Math.cos(a), 0, RO * Math.sin(a));
    station.halo.rotation.y = t; station.halo.scale.setScalar(1 + 0.25 * Math.sin(t * 3));
    stationLabel.position.set(station.position.x + 0.05, 0.11, station.position.z);
    const pm = (t * 0.008 + 0.3) % 1, am = pm * 2 * Math.PI;
    moonMat.uniforms.uPhase.value = pm; moon.position.set(RM * Math.cos(am), 0, RM * Math.sin(am)); moon.rotation.y = t * 0.2;
    ark.position.copy(way.getPoint((t * 0.045) % 1)); ark.halo.rotation.x = t * 1.3; ark.halo.scale.setScalar(1 + 0.3 * Math.sin(t * 5));
    dials[0].rotation.y = t * 0.05; dials[1].rotation.y = -t * 0.025; dials[2].rotation.y = t * 0.11;
  }
  return { root, update, setExpanded: (v) => { open.to = +v; } };
}
