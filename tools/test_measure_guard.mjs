// Tests for the pinned-state check and the deadline of tools/docker/measure-guard.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pinnedProblem, requirePinned, NEEDED } from './docker/measure-guard.mjs';

const pinned = { hasLobby: true, hasTimer: true, allPinned: true, scalePinned: true, tierPinned: true };

test('a pinned state passes', () => assert.equal(pinnedProblem(pinned), null));

test('an unpinned state names the switches it needs', () => {
  const why = pinnedProblem({ ...pinned, allPinned: false, tierPinned: false });
  assert.match(why, /tier=0/);
  assert.match(why, /scale=1/);
  assert.match(why, /tier pinned: false/);
  assert.ok(why.includes(NEEDED));
});

test('a page with no lobby or no timer extension fails with its own message', () => {
  assert.match(pinnedProblem({ hasLobby: false }), /__lobby/);
  assert.match(pinnedProblem({ ...pinned, hasTimer: false }), /EXT_disjoint_timer_query_webgl2/);
});

test('requirePinned throws the message of an unpinned page', async () => {
  const page = { evaluate: async () => ({ ...pinned, allPinned: false, scalePinned: false }) };
  await assert.rejects(requirePinned(page), /measure: the governor is not pinned/);
  await requirePinned({ evaluate: async () => pinned });
});

test('the deadline ends a script that hangs, with exit code 3 and its name', () => {
  const hang = resolve(import.meta.dirname, 'docker/measure-hang.mjs');
  const t = Date.now();
  const r = spawnSync('node', [hang], { encoding: 'utf8', timeout: 20000, env: { ...process.env, MEASURE_TIMEOUT_S: '1' } });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /hang: no result after 1 s/);
  assert.ok(Date.now() - t < 15000);
});
