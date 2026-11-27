// The developer host test and the URL switches for tuning and tests.
export const PUBLIC_KEYS = [];

export function isDevHost(hostname) {
  const h = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '[::1]') return true;
  if (h.endsWith('.local') || h.endsWith('.ts.net')) return true;
  if (!h.includes('.') && !h.includes(':')) return h !== '';
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

export function paramsFor(search, dev) {
  const all = new URLSearchParams(search);
  if (dev) return all;
  const out = new URLSearchParams();
  for (const k of PUBLIC_KEYS) if (all.has(k)) out.set(k, all.get(k));
  return out;
}

export const DEV = typeof location !== 'undefined' && (isDevHost(location.hostname) || !!import.meta.env?.DEV);
export const params = () => paramsFor(location.search, DEV);
