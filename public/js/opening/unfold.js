// The opening of the reader that unfolds the own sheet of a hologram into the frame.
import * as THREE from 'three';
import { V } from '../kit.js';

const GROW = [0.05, 0.95], UP = V(0, 1, 0);

export function createUnfold({ panel, camera, light, ramp, still, uVeil, uGrown }) {
  const tCard = { value: null }, uK = { value: 0 };
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), light(`uniform sampler2D tCard; uniform float uK; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tCard, vUv); gl_FragColor = vec4(c.rgb*c.a*1.5*uK, 1.0); }`, { tCard, uK }, { depthTest: false }));
  print.name = 'ReadPrint'; print.renderOrder = 9; print.visible = false; print.position.z = 0.0005; panel.add(print);
  const from = { p: V(), q: new THREE.Quaternion(), s: V(1, 1, 1) }, _p = V(), _s = V(), _x = V();
  let station = null, taken = false;
  const show = (v) => { if (station?.page) station.page.material.opacity = +v; };
  function take() {
    const page = station?.page; if (!page) return false;
    page.parent.getWorldScale(_s); const [w, h] = page.userData.size.map((v, i) => v * (i ? _s.y : _s.x));
    from.q.copy(camera.quaternion); from.s.set(w, h, 1);
    from.p.copy(page.getWorldPosition(_p)).addScaledVector(_x.set(1, 0, 0).applyQuaternion(camera.quaternion), -w * (page.center.x - 0.5));
    return true;
  }
  return {
    asks: true, word: null, quiet: () => true, from: 0,
    ACT: GROW, UNFOLD: [-1, 0], REVEAL: [0.95, 1.75], BEAM: 0.1,
    lay(s) { show(true); station = s?.station ?? null; tCard.value = station?.page?.material.map ?? null; taken = false; },
    start() { taken = false; },
    update({ on }) {
      if (!on) { taken = false; uK.value = 0; }
      show(!(on && (taken || still))); print.visible = uK.value > 0.01 && !!tCard.value;
    },
    shape(T) {
      if (T >= GROW[1] || !station) return;
      if (!taken) taken = take(); if (!taken) return;
      const x = THREE.MathUtils.clamp((T - GROW[0]) / (GROW[1] - GROW[0]), 0, 1), g = 1 - (1 - x) ** 3;
      _s.copy(panel.scale); uGrown.value = (from.s.x / _s.x) ** (1 - g);
      panel.position.lerpVectors(from.p, panel.position, g); panel.quaternion.slerpQuaternions(from.q, panel.quaternion, g);
      panel.scale.set(from.s.x * (_s.x / from.s.x) ** g, from.s.y * (_s.y / from.s.y) ** g, 1);
      const v0 = station.page.userData.pane || 0.12; uVeil.value = v0 + (1 - v0) * ramp(x, [0.05, 0.7]);
      uK.value = 1 - ramp(g, [0.2, 0.62]);
    },
    beam(p, q, s) {
      if (!station?.holder) return false;
      const c = station.holder.getWorldPosition(_p), side = _x.crossVectors(UP, s.facing).normalize();
      p.copy(c).addScaledVector(side, -0.24); q.copy(c).addScaledVector(side, 0.24); return true;
    },
    dispose() { show(true); print.geometry.dispose(); print.material.dispose(); },
  };
}
