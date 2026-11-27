// Tests for the DEV host and parameter rules of public/js/dev.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { isDevHost, paramsFor, PUBLIC_KEYS } from '../public/js/dev.js';

test('a public host name, a look-alike of one, or an address outside the private ranges is not DEV', () => {
  for (const h of ['www.example.com', 'example.com', 'www.example.com.example.net', 'localhost.www.example.com', '127.0.0.1.www.example.com', 'sub.workers.dev',
    '8.8.8.8', '172.32.0.1', '100.128.0.1', '192.169.1.1', '11.0.0.1', '', undefined])
    assert.equal(isDevHost(h), false, String(h));
});

test('localhost, loopback, private and LAN addresses, tailnet and bare names are DEV', () => {
  for (const h of ['localhost', 'app.localhost', '127.0.0.1', '127.1.2.3', '[::1]', '10.1.2.3', '192.168.0.9', '172.16.0.1', '172.31.255.1', '100.64.0.1', '169.254.1.1', 'box.local', 'box.tailnet-name.ts.net', 'ci-host', 'LOCALHOST'])
    assert.equal(isDevHost(h), true, h);
});

test('off DEV nothing is readable; on DEV everything is; no key is public', () => {
  const q = '?bloom=0&tier=1&skip=mirror&debug=1&dev=1&shot=hero&room=about';
  assert.deepEqual(PUBLIC_KEYS, []);
  assert.equal(paramsFor(q, false).toString(), '');
  assert.equal(paramsFor('?bloom=0.5', false).toString(), '');
  assert.equal(paramsFor(q, true).get('bloom'), '0');
  assert.equal(paramsFor(q, true).get('tier'), '1');
});

const ROOT = resolve(import.meta.dirname, '..'), SELF = resolve(import.meta.filename);
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'assets', '.git', 'dist']), TEXT = /\.(m?js|ts|tsx|sh|py|html|css|json|md|txt|jsonc|yml|yaml)$/;
const BAD = /[?&]room=|searchParams\.(get|set|has|append|delete)\(\s*['"]room['"]|URLSearchParams\(\s*['"\x60]room=|search\s*=\s*['"\x60]room=|URLSearchParams\(\{\s*room\b/;
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name), s = statSync(p);
    if (s.isDirectory()) yield* walk(p); else if (TEXT.test(name) && p !== SELF) yield p;
  }
}
test('?room= is not read, built or linked anywhere in public/, tools/ or tests/', () => {
  const found = [];
  for (const top of ['public', 'tools', 'tests'])
    for (const f of walk(join(ROOT, top))) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (BAD.test(l)) found.push(relative(ROOT, f).split(sep).join('/') + ':' + (i + 1)); });
  assert.deepEqual(found, []);
});
