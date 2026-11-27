// Unit tests for the type-check and lint ratchet, tools/ci/ratchet.mjs (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROJECTS, checkBases, compare, parseTsc } from './ci/ratchet.mjs';

const key = (file, code, message) => [file, code, message].join('\t');
const A = key('src/a.js', 'TS2339', "Property 'x' does not exist on type 'Y'.");
const B = key('src/b.js', 'TS2556', 'A spread argument must either have a tuple type or be passed to a rest parameter.');
const C = key('src/c.js', 'TS2345', "Argument of type 'string' is not assignable to parameter of type 'number'.");
const found = (...keys) => keys.map((k) => ({ key: k, where: k.split('\t')[0] }));

test('a finding that is not on the baseline is new', () => {
  const { fresh, stale } = compare([A], found(A, B));
  assert.deepEqual(fresh.map((f) => f.key), [B]);
  assert.deepEqual(stale, []);
});

test('a second copy of a listed finding is new', () => {
  assert.equal(compare([A], found(A, A)).fresh.length, 1);
});

test('a baseline line without its finding is stale', () => {
  const { fresh, stale } = compare([A, B], found(A));
  assert.deepEqual(fresh, []);
  assert.deepEqual(stale, [B]);
});

test('the baseline is a sub-multiset of each base: a removed line passes', () => {
  assert.deepEqual(checkBases([A], [{ name: 'prog/int', lines: [A, B] }]), []);
});

test('a swapped line fails although the length is the same', () => {
  const errors = checkBases([A, C], [{ name: 'prog/int', lines: [A, B] }]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /src\/c\.js/);
});

test('growth to the largest base fails against the smaller base', () => {
  const errors = checkBases([A, B], [{ name: 'prog/int', lines: [A] }, { name: 'prog/ws-found', lines: [A, B] }]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /prog\/int/);
});

test('a duplicate line that the base has once fails', () => {
  assert.equal(checkBases([A, A], [{ name: 'prog/int', lines: [A] }]).length, 1);
});

test('moved code passes when the same code and message leave the old path', () => {
  const moved = key('src/engine/turn.js', 'TS2339', "Property 'x' does not exist on type 'Y'.");
  assert.deepEqual(checkBases([moved, B], [{ name: 'prog/int', lines: [A, B] }]), []);
});

test('moved code with another message fails', () => {
  const other = key('src/engine/turn.js', 'TS2339', "Property 'z' does not exist on type 'Y'.");
  assert.equal(checkBases([other, B], [{ name: 'prog/int', lines: [A, B] }]).length, 1);
});

test('moved code cannot reuse one removed line twice', () => {
  const m1 = key('src/d.js', 'TS2339', "Property 'x' does not exist on type 'Y'.");
  const m2 = key('src/e.js', 'TS2339', "Property 'x' does not exist on type 'Y'.");
  assert.equal(checkBases([m1, m2], [{ name: 'prog/int', lines: [A] }]).length, 1);
});

test('a new baseline written after the file was deleted is checked against the bases', () => {
  assert.equal(checkBases([A, B, C].sort(), [{ name: 'prog/int', lines: [A, B] }]).length, 1);
  assert.deepEqual(checkBases([A, B], [{ name: 'prog/int', lines: [A, B] }]), []);
});

test('without bases nothing is compared', () => {
  assert.deepEqual(checkBases([A, B, C], []), []);
});

test('tsc output is read with its continuation lines', () => {
  const text = "src/a.js(3,7): error TS2339: Property 'x' does not exist on type 'Y'.\n  Detail line.\nsrc/a.js(3,7): error TS2339: Property 'x' does not exist on type 'Y'.\n";
  const { findings, errors } = parseTsc(text, 2);
  assert.deepEqual(errors, []);
  assert.deepEqual(findings.map((f) => f.key), [A]);
});

test('a non-zero tsc exit without readable findings fails', () => {
  assert.equal(parseTsc('Segmentation fault\n', 1).errors.length, 1);
  assert.equal(parseTsc('', 2).errors.length, 1);
  assert.equal(parseTsc('x', null).errors.length, 1);
});

test('a tsc error without a file fails', () => {
  const text = "error TS5083: Cannot read file 'tsconfig.json'.\nsrc/a.js(3,7): error TS2339: Property 'x' does not exist on type 'Y'.\n";
  assert.equal(parseTsc(text, 1).errors.length, 1);
});

test('a clean tsc run has no findings and no errors', () => {
  assert.deepEqual(parseTsc('', 0), { findings: [], errors: [] });
});

test('findings of files that a project does not own are dropped', () => {
  const owns = (f) => f !== 'src/a.js';
  assert.equal(parseTsc("src/a.js(3,7): error TS2339: Property 'x' does not exist on type 'Y'.\n", 2, owns).findings.length, 0);
});

test('each source file belongs to exactly one project, and src/app is strict', () => {
  const owner = (f) => PROJECTS.filter((p) => p.owns(f)).map((p) => p.config);
  assert.deepEqual(owner('src/main.js'), ['tsconfig.json']);
  assert.deepEqual(owner('src/engine/room.js'), ['tsconfig.json']);
  assert.deepEqual(owner('src/app/main.js'), ['tsconfig.strict.json']);
  assert.deepEqual(owner('src/app/routes/home.tsx'), ['tsconfig.strict.json']);
  assert.deepEqual(owner('src/engine/station.ts'), ['tsconfig.strict.json']);
  assert.deepEqual(owner('src/engine/turn.test.ts'), ['tsconfig.node.json']);
  assert.deepEqual(owner('tests/e2e/pages/station.ts'), ['tsconfig.node.json']);
  assert.deepEqual(owner('vite.config.ts'), ['tsconfig.node.json']);
});
