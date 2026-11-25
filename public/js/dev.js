// The one switch for the developer, tuning and test URL switches (?bloom=, ?tier=, ?shot=, ?skip=, ?debug= ...).
//
// DEV is true on this machine, on a private or LAN address, on a Tailscale name or address (*.ts.net) and on a
// single-label host name (the CI and preview hosts are reached that way), and false everywhere else, which is every
// public host name, the production one included. On a host where DEV is false, params() hands out nothing, so a shared
// link cannot change how the site looks or runs. Every file that reads the address goes through params() (kit.js
// exports its result as Q); none reads location.search itself.
//
// There is no public switch: a room is named by its path (/about/, /blog/ ...), never by a query. The room query was removed on
// every host, DEV included; an address that has it opens the Atrium and stays as it is.
//
// What DEV also does: room.js is strict on a DEV host (a missing or unused texture throws instead of being skipped), so
// it is strict on a LAN or tailnet preview as well as on localhost. The old ?dev= override is gone: DEV is the host and
// nothing else.
//
// Caveat: *.ts.net is DEV because previews are reached through a tailnet name, served privately. Tailscale Funnel serves
// a *.ts.net name on the public internet; a copy exposed through Funnel would accept every switch. Do not Funnel a
// preview. (The production site is not served that way.)
//
// After F1 (the Vite build) DEV becomes import.meta.env.DEV or this host check, whichever is true.

/** Keys that stay readable off a DEV host. None: every switch is a developer switch. */
export const PUBLIC_KEYS = [];

/** True for a host name or address that is not on the public internet. Written for URL.hostname (lower case, IPv6 in brackets). */
export function isDevHost(hostname) {
  const h = String(hostname ?? '').toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '[::1]') return true;
  if (h.endsWith('.local') || h.endsWith('.ts.net')) return true;
  if (!h.includes('.') && !h.includes(':')) return h !== '';                     // a bare name such as a LAN host
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/** The query as the page may read it: everything on a DEV host, only PUBLIC_KEYS elsewhere. */
export function paramsFor(search, dev) {
  const all = new URLSearchParams(search);
  if (dev) return all;
  const out = new URLSearchParams();
  for (const k of PUBLIC_KEYS) if (all.has(k)) out.set(k, all.get(k));
  return out;
}

export const DEV = typeof location !== 'undefined' && (isDevHost(location.hostname) || !!import.meta.env?.DEV);
export const params = () => paramsFor(location.search, DEV);
