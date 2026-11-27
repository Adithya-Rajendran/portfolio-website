// Values that anything can read and follow: a stored value, and a value that a function gives and a poll compares.
import type { Readable } from './types.ts';

export interface Store<T> extends Readable<T> {
  set(value: T): void;
}

export interface Polled<T> extends Readable<T> {
  poll(): void;
}

function emitter<T>() {
  const fns = new Set<(value: T) => void>();
  return {
    emit(value: T) { for (const fn of Array.from(fns)) fn(value); },
    subscribe(fn: (value: T) => void) { fns.add(fn); return () => { fns.delete(fn); }; },
  };
}

export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  const ra = a as Record<string, unknown>, rb = b as Record<string, unknown>;
  return ka.every((k) => same(ra[k], rb[k]));
}

export function store<T>(initial: T): Store<T> {
  let value = initial;
  const e = emitter<T>();
  return {
    get: () => value,
    set(next: T) { if (same(value, next)) return; value = next; e.emit(value); },
    subscribe: e.subscribe,
  };
}

export function polled<T>(read: () => T, key: () => unknown = read): Polled<T> {
  let last: unknown = key();
  const e = emitter<T>();
  return {
    get: read,
    poll() { const k = key(); if (same(k, last)) return; last = k; e.emit(read()); },
    subscribe: e.subscribe,
  };
}
