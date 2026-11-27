// The route map's turn: the angle of the strand and its coasting, settling and easing between the stops.
import * as THREE from 'three';

export const TURN = {
  REACH: 2.0,
  SLOPE: 1,
  WHEEL: 0.005,
  LINE: 33,
  VERTICAL: false,
  IDLE: 160,
  LEAN: 0.5,
  STEP: 100,
  FLING: 0.1,
  FAST: 9,
  FRICTION: 2.5,
  SLOW: 0.6,
  SETTLE: 7,
  GLIDE: 1.4,
  FRONT: 0,
};
const ROUND = 2 * Math.PI;

export function createTurn({ points, center, still = false }) {
  const N = points.length;
  let ahead = TURN.FRONT, homes = [];
  const midY = points.reduce((s, q) => s + q.y, 0) / N, T = { a: 0, v: 0, mode: 'rest', goal: 0, to: 0, from: 0, v0: 0, f: 0, lean: 0, hand: false };
  const near = (a, i) => homes[i] + ROUND * Math.round((a - homes[i]) / ROUND);
  const closest = (a) => { let k = 0; for (let i = 1; i < N; i++) if (Math.abs(near(a, i) - a) < Math.abs(near(a, k) - a)) k = i; return k; };
  function face(point) { ahead = Math.atan2(point.x - center.x, point.z - center.z) + TURN.FRONT; homes = points.map((q) => ahead - Math.atan2(q.x, q.z)); }
  face(center.clone().add(new THREE.Vector3(0, 0, 1)));
  const land = (i) => { T.a = near(T.a, i); T.v = 0; T.goal = i; T.mode = 'rest'; };
  const turn = {
    angle: () => T.a,
    front: () => closest(T.a),
    settled: () => T.mode === 'rest',
    moving: () => T.mode === 'coast' || T.mode === 'settle',
    byHand: () => T.hand,
    heading: () => (T.mode === 'settle' || T.mode === 'ease' ? T.goal : T.mode === 'rest' && Math.abs(near(T.a, closest(T.a)) - T.a) < 1e-6 ? closest(T.a) : null),
    grab() { T.mode = 'held'; T.v = 0; T.hand = true; return T.a; },
    drag(a) { if (T.mode !== 'held') turn.grab(); T.a = a; },
    release(v = 0, lean = 0) {
      if (T.mode !== 'held') return;
      T.hand = true; if (still) return land(closest(T.a + lean));
      T.v = THREE.MathUtils.clamp(v, -TURN.FAST, TURN.FAST); T.lean = lean; T.mode = 'coast';
    },
    to(i, now = false) {
      if (!(i >= 0 && i < N)) return;
      T.hand = false;
      if (now || still) return land(i);
      if (turn.heading() === i) return;
      Object.assign(T, { mode: 'ease', goal: i, from: T.a, v0: T.v, to: near(T.a, i), f: 0 });
    },
    step(d) { T.hand = true; land(((closest(T.a) + d) % N + N) % N); },
    nudge(r) { turn.drag(turn.grab() + r); turn.release(0); },
    grip(camera) {
      const d = camera.position.distanceTo(new THREE.Vector3(Math.sin(ahead) * TURN.REACH, midY, Math.cos(ahead) * TURN.REACH).add(center));
      return TURN.REACH * innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(d, 0.5));
    },
  };
  function advance(dt) {
    if (T.mode === 'coast') {
      T.v *= Math.exp(-TURN.FRICTION * dt); T.a += T.v * dt;
      if (Math.abs(T.v) < TURN.SLOW) { const rest = T.a + T.v / TURN.FRICTION + T.lean; T.goal = closest(rest); T.to = near(rest, T.goal); T.mode = 'settle'; }
    } else if (T.mode === 'settle') {
      const k = TURN.SETTLE, x = T.a - T.to, c = T.v + k * x, e = Math.exp(-k * dt);
      T.a = T.to + (x + c * dt) * e; T.v = (c - k * (x + c * dt)) * e;
      if (Math.abs(T.a - T.to) < 1e-4 && Math.abs(T.v) < 1e-3) land(T.goal);
    } else if (T.mode === 'ease') {
      const D = TURN.GLIDE, f = T.f = Math.min(1, T.f + dt / D), f2 = f * f, f3 = f2 * f;
      T.a = (2 * f3 - 3 * f2 + 1) * T.from + (f3 - 2 * f2 + f) * D * T.v0 + (3 * f2 - 2 * f3) * T.to;
      T.v = ((6 * f2 - 6 * f) * T.from + (3 * f2 - 4 * f + 1) * D * T.v0 + (6 * f - 6 * f2) * T.to) / D;
      if (f >= 1) land(T.goal);
    }
  }
  return { turn, face, advance, homeAngle: (i) => homes[i] };
}
