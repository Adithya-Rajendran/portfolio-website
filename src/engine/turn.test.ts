// Unit tests of createTurn(): one step of the route map's turn, and its easing, coasting and settling.
import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { TURN, createTurn } from './turn.js';

const ROUND = 2 * Math.PI;
const points = [0, 1, 2, 3].map((i) => new Vector3(Math.cos(i * 1.3) * 2, 1 + i, -Math.sin(i * 1.3) * 2));
const make = (still = false) => createTurn({ points, center: new Vector3(0, 0, 0), still });
const onHome = (angle: number, home: number) => Math.abs(((angle - home) % ROUND + ROUND) % ROUND) < 1e-9 || Math.abs(((angle - home) % ROUND + ROUND) % ROUND - ROUND) < 1e-9;
function run(advance: (dt: number) => void, settled: () => boolean, seconds: number) {
  let t = 0;
  for (; t < seconds && !settled(); t += 1 / 60) advance(1 / 60);
  return t;
}

describe('turn', () => {
  test('one step lands on the next stop at once', () => {
    const { turn, homeAngle } = make();
    const from = turn.front();
    turn.step(1);
    const to = (from + 1) % points.length;
    expect(turn.front()).toBe(to);
    expect(turn.settled()).toBe(true);
    expect(turn.heading()).toBe(to);
    expect(turn.byHand()).toBe(true);
    expect(onHome(turn.angle(), homeAngle(to))).toBe(true);
  });

  test('a step back from the first stop goes to the last', () => {
    const { turn } = make();
    turn.to(0, true);
    turn.step(-1);
    expect(turn.front()).toBe(points.length - 1);
  });

  test('to() eases to the stop in TURN.GLIDE seconds', () => {
    const { turn, advance, homeAngle } = make();
    turn.to(2);
    expect(turn.settled()).toBe(false);
    expect(turn.heading()).toBe(2);
    advance(TURN.GLIDE / 2);
    expect(turn.settled()).toBe(false);
    advance(TURN.GLIDE / 2);
    expect(turn.settled()).toBe(true);
    expect(turn.front()).toBe(2);
    expect(onHome(turn.angle(), homeAngle(2))).toBe(true);
  });

  test('a fling coasts, settles and rests on a stop', () => {
    const { turn, advance, homeAngle } = make();
    turn.grab();
    turn.drag(turn.angle() + 0.2);
    turn.release(4);
    expect(turn.moving()).toBe(true);
    const t = run(advance, turn.settled, 20);
    expect(t).toBeLessThan(20);
    expect(turn.settled()).toBe(true);
    expect(onHome(turn.angle(), homeAngle(turn.front()))).toBe(true);
  });

  test('with reduced motion a release lands at once', () => {
    const { turn, homeAngle } = make(true);
    turn.grab();
    turn.drag(turn.angle() + 0.3);
    turn.release(4);
    expect(turn.settled()).toBe(true);
    expect(onHome(turn.angle(), homeAngle(turn.front()))).toBe(true);
  });
});
