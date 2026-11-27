// The live values of the rooms: the departure clock and the counters, and the fill of their names in a text.
let depart = 0, counters = {};
export function initLive({ depart: clock, live }) {
  const [h, m, s] = clock.split(':').map(Number);
  depart = Date.now() + ((h * 60 + m) * 60 + s) * 1000; counters = live;
}
export function live(t = performance.now() / 1000) {
  const s = Math.max(0, Math.floor((depart - Date.now()) / 1000)), two = (n) => String(n).padStart(2, '0');
  const v = { tminus: `${two(Math.floor(s / 3600))}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` };
  for (const [k, c] of Object.entries(counters)) v[k] = Math.min(c.max ?? Infinity, c.from + Math.floor(t * c.per));
  return v;
}
export const counter = (k) => counters[k];
export const fill = (str, v) => str.replace(/\{(\w+)\}/g, (_, k) => (typeof v[k] === 'number' ? v[k].toLocaleString('en-US') : v[k] ?? ''));
