import test from 'node:test';
import assert from 'node:assert/strict';
import { isDevHost, paramsFor, PUBLIC_KEYS } from '../public/js/dev.js';

test('the production host and other public hosts are not DEV', () => {
  for (const h of ['adithya-rajendran.com', 'www.adithya-rajendran.com', 'arcadia-station.example.workers.dev', 'example.com', '8.8.8.8', '172.32.0.1', '100.128.0.1', '192.169.1.1', 'localhost.example.com', '127.0.0.1.example.com', '', undefined])
    assert.equal(isDevHost(h), false, String(h));
});

test('localhost, loopback, private and LAN addresses, tailnet and bare names are DEV', () => {
  for (const h of ['localhost', 'app.localhost', '127.0.0.1', '127.1.2.3', '[::1]', '10.1.2.3', '192.168.0.9', '172.16.0.1', '172.31.255.1', '100.64.0.1', '169.254.1.1', 'box.local', 'box.tailnet-name.ts.net', 'ci-host', 'LOCALHOST'])
    assert.equal(isDevHost(h), true, h);
});

test('off DEV only the public keys survive; on DEV everything does', () => {
  const q = '?room=about&bloom=0&tier=1&skip=mirror&debug=1&dev=1&shot=hero';
  assert.equal(paramsFor(q, false).toString(), 'room=about');
  assert.deepEqual([...paramsFor(q, false).keys()], PUBLIC_KEYS.filter((k) => k === 'room'));
  assert.equal(paramsFor('?bloom=0.5', false).toString(), '');
  assert.equal(paramsFor(q, true).get('bloom'), '0');
  assert.equal(paramsFor(q, true).get('tier'), '1');
});
