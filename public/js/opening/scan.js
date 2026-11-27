// The opening of the reader that scans a thing in the room and unfolds the frame over it.
import * as THREE from 'three';
import { CY, V } from '../kit.js';

const rad = THREE.MathUtils.degToRad, clamp = THREE.MathUtils.clamp, UP = V(0, 1, 0);
const SWEEP = [0.25, 1.35], GROW = 0.24, PAD = 0.006;

export function createScan({ root, anchor, camera, light, ramp, ease }) {
  const uScan = { value: 0 }, uK = { value: 0 }, uSnap = { value: 0 }, uPage = { value: new THREE.Vector2(1, 1) };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), light(`uniform float uScan, uK, uSnap; uniform vec2 uPage; varying vec2 vUv, vM;
    void main(){
      vec2 h = uPage*0.5, a = abs(vM), s = vec2(min(uPage.x, uPage.y));
      float px = max(length(fwidth(vM)), 1e-5), on = step(a.x, h.x)*step(a.y, h.y);
      vec2 d = a - h - s*mix(0.2, 0.03, uSnap);
      float arm = s.x*0.17, w = px*1.1;
      float mark = max((1.0 - smoothstep(w, w + px, abs(d.y)))*smoothstep(-arm - px, -arm, d.x)*(1.0 - smoothstep(w, w + px, d.x)),
                       (1.0 - smoothstep(w, w + px, abs(d.x)))*smoothstep(-arm - px, -arm, d.y)*(1.0 - smoothstep(w, w + px, d.y)));
      float v = 1.0 - vUv.y, e = uScan - v;
      float line = exp(-pow(e*90.0, 2.0)), read = step(0.0, e)*exp(-e*5.0);
      float grid = step(0.86, fract(vUv.x*24.0)) + step(0.8, fract(v*34.0));
      gl_FragColor = vec4(${CY}*((line*3.2 + read*(0.10 + 0.22*grid))*on*uK + mark*(1.5 + 2.0*(1.0 - uSnap))*min(uK*4.0, 1.0)), 1.0);
    }`, { uScan, uK, uSnap, uPage }, { vertexShader: 'uniform vec2 uPage; varying vec2 vUv, vM; void main(){ vUv = position.xy + 0.5; vM = position.xy*uPage; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }' }));
  sheet.name = 'ScanSheet'; sheet.renderOrder = 7; sheet.visible = false; anchor.add(sheet);

  const uAxis = { value: V(0, 0, 1) }, unit = new THREE.BoxGeometry(1, 1, 1), boxes = [];
  const boxMat = (half, arm, uAt, fade) => light(`uniform vec3 uHalf, uAxis; uniform float uAt, uK, uSnap, uArm, uFade; varying vec3 vP, vN, vW, vNw;
    void main(){
      if (vN.y < -0.5) discard;
      vec3 d = uHalf - abs(vP) + abs(vN)*1e3;
      float near = min(d.x, min(d.y, d.z)), far = d.x + d.y + d.z - near - max(d.x, max(d.y, d.z));
      float px = max(length(fwidth(vP)), 1e-5), w = px*1.1;
      float mark = (1.0 - smoothstep(w, w + px, near))*(1.0 - smoothstep(uArm - px, uArm, far));
      float e = uAt - dot(vW, uAxis), across = 1.0 - smoothstep(0.7, 0.96, abs(dot(normalize(vNw), uAxis)));
      float line = exp(-pow(e/max(px*2.0, 0.004), 2.0)) + 0.3*exp(-pow(e/max(px*9.0, 0.018), 2.0)), read = step(0.0, e)*exp(-e*uFade);
      vec3 side = cross(uAxis, vec3(0.0, 1.0, 0.0));
      float grid = step(0.86, fract(dot(vW, side)*42.0 + vW.y*42.0)) + step(0.8, fract(dot(vW, uAxis)*58.0));
      gl_FragColor = vec4(${CY}*((line*3.6 + read*(0.05 + 0.3*grid))*across*uK + mark*(1.5 + 2.0*(1.0 - uSnap))*min(uK*4.0, 1.0)), 1.0);
    }`, { uAt, uK, uSnap, uAxis, uFade: { value: fade }, uHalf: { value: half }, uArm: { value: arm } },
    { side: THREE.FrontSide, vertexShader: `uniform vec3 uHalf; varying vec3 vP, vN, vW, vNw;
      void main(){ vP = position*2.0*uHalf; vN = normal; vNw = mat3(modelMatrix)*normal; vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }` });

  const uGain = { value: 1 }, fanMat = light(`uniform float uK, uGain; varying vec2 vUv;
    void main(){ float x = (vUv.x - 0.5)/max(vUv.y, 0.02) + 0.5, ray = 0.6 + 0.4*sin(x*90.0);
      gl_FragColor = vec4(${CY}*pow(vUv.y, 1.6)*ray*0.42*uGain*uK, 1.0); }`, { uK, uGain }, { depthTest: false }), fans = [];
  const fanAt = (i) => {
    while (fans.length <= i) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0.5, 0, 0, 1, 1, 1]), 2));
      const f = new THREE.Mesh(g, fanMat); f.name = 'ScanFan'; f.frustumCulled = false; f.renderOrder = 19; f.visible = false; root.add(f); fans.push(f);
    }
    return fans[i];
  };
  fanAt(0);
  const _a = V(), _b = V(), _e = V(), _p = V(), _q = V();
  const eye = () => _e.copy(camera.position).addScaledVector(camera.getWorldDirection(_b), 0.5).addScaledVector(_a.copy(UP).applyQuaternion(camera.quaternion), -0.56 * Math.tan(rad(camera.fov / 2)));
  const aim = (f, p, q) => { const a = f.geometry.attributes.position; a.setXYZ(0, ...eye().toArray()); a.setXYZ(1, ...p.toArray()); a.setXYZ(2, ...q.toArray()); a.needsUpdate = true; f.visible = true; };

  function chord(b, at, p, q) {
    const { c, x, z, hw, hd } = b, nx = x.dot(uAxis.value), nz = z.dot(uAxis.value), k = at - c.dot(uAxis.value), ends = [];
    if (Math.abs(nz) > 1e-4) for (const a of [-hw, hw]) { const v = (k - a * nx) / nz; if (Math.abs(v) <= hd) ends.push([a, v]); }
    if (Math.abs(nx) > 1e-4) for (const v of [-hd, hd]) { const a = (k - v * nz) / nx; if (Math.abs(a) < hw) ends.push([a, v]); }
    if (ends.length < 2) return false;
    p.copy(c).addScaledVector(x, ends[0][0]).addScaledVector(z, ends[0][1]); q.copy(c).addScaledVector(x, ends[1][0]).addScaledVector(z, ends[1][1]); return true;
  }
  return {
    asks: true, word: 'scanning', from: 0,
    quiet: () => boxes.length > 0,
    ACT: SWEEP, UNFOLD: [1.15, 1.95], REVEAL: [1.75, 2.65],
    lay(s) {
      for (const b of boxes) { b.mesh.removeFromParent(); b.mesh.material.dispose(); } boxes.length = 0;
      uK.value = 0;
      if (!s) return;
      const [w, h] = s.sheet.size, m = 0.26 * Math.min(w, h);
      uPage.value.set(w, h); sheet.geometry.dispose(); sheet.geometry = new THREE.PlaneGeometry(1 + 2 * m / w, 1 + 2 * m / h);
      uGain.value = s.bodies?.length ? 2.4 : 1;
      if (!s.bodies?.length) return;
      uAxis.value.copy(s.facing);
      for (const body of s.bodies) {
        const [bw, bh, bd] = body.size, size = V(bw, bh, bd), second = [bw, bh, bd].sort((a, b) => b - a)[1];
        const x = V(1, 0, 0).applyQuaternion(body.quaternion), y = V(0, 1, 0).applyQuaternion(body.quaternion), z = V(0, 0, 1).applyQuaternion(body.quaternion);
        const reach = (Math.abs(x.dot(s.facing)) * bw + Math.abs(y.dot(s.facing)) * bh + Math.abs(z.dot(s.facing)) * bd) / 2, mid = body.position.dot(s.facing), uAt = { value: 0 };
        const mesh = new THREE.Mesh(unit, boxMat(size.clone().multiplyScalar(0.5), 0.17 * second, uAt, 2.5 / Math.max(reach, 0.02)));
        mesh.name = 'ScanBody'; mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion); mesh.renderOrder = 7; mesh.visible = false; root.add(mesh);
        boxes.push({ mesh, size, uAt, lo: mid - reach, hi: mid + reach, reads: !!body.reads, c: body.position.clone().addScaledVector(y, bh / 2 + PAD), x, z, hw: bw / 2, hd: bd / 2 });
      }
    },
    update({ on, T }) {
      const sweep = on ? ramp(T, SWEEP) : 0; uScan.value = sweep * 1.04; ease(uK, on && T < SWEEP[1] + 0.25 ? 1 : 0, 0.2);
      uSnap.value = on ? 1 - (1 - clamp(T / 0.2, 0, 1)) ** 3 : 0;
      const show = uK.value > 0.01 && !!anchor.parent;
      sheet.visible = show && !boxes.length; for (const f of fans) f.visible = false;
      if (sheet.visible) { const y = 0.5 - uScan.value; aim(fans[0], anchor.localToWorld(_p.set(-0.5, y, 0)), anchor.localToWorld(_q.set(0.5, y, 0))); }
      boxes.forEach((b, i) => {
        b.mesh.visible = show; if (!show) return;
        b.uAt.value = b.lo - 0.01 + (b.hi - b.lo + 0.02) * uScan.value;
        const grow = 1 + GROW * (1 - uSnap.value); b.mesh.scale.copy(b.size).multiplyScalar(grow).addScalar(2 * PAD);
        if (sweep > 0 && chord(b, b.uAt.value, _p, _q)) aim(fanAt(i), _p, _q);
      });
    },
    beam(p, q, s) {
      const b = boxes.find((x) => x.reads) ?? boxes[0];
      if (!b) { const y = s.sheet.top ? 0.5 : -0.5; anchor.localToWorld(p.set(-0.5, y, 0)); anchor.localToWorld(q.set(0.5, y, 0)); return true; }
      const side = _a.crossVectors(UP, uAxis.value).normalize(), half = Math.abs(b.x.dot(side)) * b.hw + Math.abs(b.z.dot(side)) * b.hd;
      p.copy(b.c).addScaledVector(side, -half); q.copy(b.c).addScaledVector(side, half); return true;
    },
    dispose() { for (const b of boxes) { b.mesh.removeFromParent(); b.mesh.material.dispose(); } unit.dispose(); sheet.geometry.dispose(); sheet.material.dispose(); },
  };
}
