// Unit tests of the stored and the polled values that the Station gives to the page.
import { expect, test } from 'vitest';
import { polled, same, store } from './readable.ts';

test('a stored value calls its followers only when the value changes', () => {
  const s = store({ a: 1, b: [1, 2] }), seen: unknown[] = [];
  const stop = s.subscribe((v) => seen.push(v));
  s.set({ a: 1, b: [1, 2] });
  s.set({ a: 2, b: [1, 2] });
  stop();
  s.set({ a: 3, b: [1, 2] });
  expect(seen).toEqual([{ a: 2, b: [1, 2] }]);
  expect(s.get()).toEqual({ a: 3, b: [1, 2] });
});

test('a polled value reads its source on get and calls its followers when its key changes', () => {
  let n = 0, k = 0;
  const p = polled(() => ({ n: ++n }), () => k), seen: unknown[] = [];
  p.subscribe((v) => seen.push(v));
  p.poll();
  expect(seen).toEqual([]);
  k = 1; p.poll();
  expect(seen).toEqual([{ n: 1 }]);
  expect(p.get()).toEqual({ n: 2 });
});

test('same compares values in depth', () => {
  expect(same([1, { a: null }], [1, { a: null }])).toBe(true);
  expect(same([1], { 0: 1 })).toBe(false);
  expect(same({ a: 1 }, { a: 1, b: undefined })).toBe(false);
});
