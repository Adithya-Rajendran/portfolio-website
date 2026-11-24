// A way of opening what is read (js/reader.js): the thing is itself a hologram (a stop on Navigation's route map), and
// it already shows a small sheet of its own beside its model. Nothing is scanned: that sheet opens up. A frame leaves
// the sheet's place, grows and turns to face the visitor, and darkens as it comes, with the sheet's own print fading out
// of it; light from the station's model rises to its foot; then the words are there. It moves because the visitor
// asked for something, and it ends.
import * as THREE from 'three';
import { V } from '../kit.js';

const GROW = [0.05, 0.95], UP = V(0, 1, 0);                    // the growing, in seconds from the request

/** @param panel  the reader's frame. Each frame the reader puts it where it stands at rest and then calls shape(): this way
 *                moves it from there. uVeil: how much of what is behind the frame it puts out (1 at rest); uGrown: its size
 *                now over its size at rest (the frame keeps its lines as fine on screen as they are at rest). */
export function createUnfold({ panel, camera, light, ramp, still, uVeil, uGrown }) {
  const tCard = { value: null }, uK = { value: 0 };
  // the sheet's print, carried in the frame as it grows (drawn as the sheet draws it: light, added to the room)
  const print = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), light(`uniform sampler2D tCard; uniform float uK; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tCard, vUv); gl_FragColor = vec4(c.rgb*c.a*1.5*uK, 1.0); }`, { tCard, uK }, { depthTest: false }));
  print.name = 'ReadPrint'; print.renderOrder = 9; print.visible = false; print.position.z = 0.0005; panel.add(print);
  const from = { p: V(), q: new THREE.Quaternion(), s: V(1, 1, 1) }, _p = V(), _s = V(), _x = V();
  let station = null, taken = false;
  const show = (v) => { if (station?.page) station.page.material.opacity = +v; };      // the station's own sheet: not there while the frame carries its print away
  /** Where the station's sheet is now, as a plane: it hangs from its right edge and faces the visitor. */
  function take() {
    const page = station?.page; if (!page) return false;
    page.parent.getWorldScale(_s); const [w, h] = page.userData.size.map((v, i) => v * (i ? _s.y : _s.x));     // at its full size, though it may be folding away
    from.q.copy(camera.quaternion); from.s.set(w, h, 1);
    from.p.copy(page.getWorldPosition(_p)).addScaledVector(_x.set(1, 0, 0).applyQuaternion(camera.quaternion), -w * (page.center.x - 0.5));
    return true;
  }
  return {
    asks: true, word: null, quiet: () => true, from: 0,          // READ is offered under the station; asked, it gets out of the way: what opens is in plain sight
    ACT: GROW, UNFOLD: [-1, 0], REVEAL: [0.95, 1.75], BEAM: 0.1,   // the frame is whole from the start (it is its place and size that change)
    /** The source now laid (null: none): source.station is the stop's own display { page: its sheet (a sprite), holder: its model }. */
    lay(s) { show(true); station = s?.station ?? null; tCard.value = station?.page?.material.map ?? null; taken = false; },
    /** A reading starts: the sheet is taken from where it is now. */
    start() { taken = false; },
    update({ on }) {
      if (!on) { taken = false; uK.value = 0; }
      show(!(on && (taken || still))); print.visible = uK.value > 0.01 && !!tCard.value;      // (reduced motion: no growing, the frame is simply there, and the sheet is not)
    },
    /** The frame stands at rest: move it to where it is at T. */
    shape(T) {
      if (T >= GROW[1] || !station) return;
      if (!taken) taken = take(); if (!taken) return;
      const x = THREE.MathUtils.clamp((T - GROW[0]) / (GROW[1] - GROW[0]), 0, 1), g = 1 - (1 - x) ** 3;     // away fast, and gently into place
      _s.copy(panel.scale); uGrown.value = (from.s.x / _s.x) ** (1 - g);
      panel.position.lerpVectors(from.p, panel.position, g); panel.quaternion.slerpQuaternions(from.q, panel.quaternion, g);
      panel.scale.set(from.s.x * (_s.x / from.s.x) ** g, from.s.y * (_s.y / from.s.y) ** g, 1);
      const v0 = station.page.userData.pane || 0.12; uVeil.value = v0 + (1 - v0) * ramp(x, [0.05, 0.7]);      // as dark as the sheet was, to begin with
      uK.value = 1 - ramp(g, [0.2, 0.62]);                       // its print goes while the frame is still small: the frame arrives clear, for the words
    },
    /** The curtain of light under the frame rises from the station's model. */
    beam(p, q, s) {
      if (!station?.holder) return false;
      const c = station.holder.getWorldPosition(_p), side = _x.crossVectors(UP, s.facing).normalize();
      p.copy(c).addScaledVector(side, -0.24); q.copy(c).addScaledVector(side, 0.24); return true;
    },
    dispose() { show(true); print.geometry.dispose(); print.material.dispose(); },
  };
}
