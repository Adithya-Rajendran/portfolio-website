// The type-check and lint ratchet: tsc and oxlint findings compared with their baseline files in tools/ci.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = join(ROOT, 'node_modules/.bin');
const KINDS = {
  typecheck: { baseline: 'tools/ci/ts-baseline.txt', find: typeFindings, fix: 'pnpm typecheck --update' },
  lint: { baseline: 'tools/ci/lint-baseline.txt', find: lintFindings, fix: 'pnpm lint --update' },
};

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (typeof err.stdout === 'string' && err.status !== null) return err.stdout;
    throw err;
  }
}

const clean = (text) => text.replace(/[\t\r\n]+/g, ' ').trim();

function typeFindings() {
  const seen = new Set(), out = [];
  for (const project of ['tsconfig.json', 'tsconfig.strict.json']) {
    for (const line of run(join(BIN, 'tsc'), ['-p', project, '--pretty', 'false']).split('\n')) {
      const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
      if (!m) continue;
      const [, file, row, col, code, message] = m;
      const where = `${file}:${row}:${col}:${code}`;
      if (seen.has(where)) continue;
      seen.add(where);
      out.push({ key: [file.replaceAll('\\', '/'), code, clean(message)].join('\t'), where: `${file}(${row},${col})` });
    }
  }
  return out;
}

function lintFindings() {
  const report = JSON.parse(run(join(BIN, 'oxlint'), ['--format', 'json']));
  return report.diagnostics.map((d) => {
    const file = relative(ROOT, resolve(ROOT, d.filename)).replaceAll('\\', '/'), at = d.labels?.[0]?.span;
    return { key: [file, d.code, clean(d.message)].join('\t'), where: at ? `${file}(${at.line},${at.column})` : file };
  });
}

const readList = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()) : []);

function counts(keys) {
  const map = new Map();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return map;
}

function main(argv) {
  const [kind, ...rest] = argv;
  const spec = KINDS[kind];
  if (!spec) {
    console.error('usage: node tools/ci/ratchet.mjs <typecheck|lint> [--update] [--base <baseline file>]...');
    return 2;
  }
  const update = rest.includes('--update'), bases = [];
  for (let i = 0; i < rest.length; i++) if (rest[i] === '--base') bases.push(rest[++i]);
  const started = Date.now(), findings = spec.find(), baselinePath = join(ROOT, spec.baseline), baseline = readList(baselinePath);
  const allowed = counts(baseline), current = counts(findings.map((f) => f.key));
  const fresh = [], used = new Map();
  for (const f of findings) {
    const n = (used.get(f.key) ?? 0) + 1;
    used.set(f.key, n);
    if (n > (allowed.get(f.key) ?? 0)) fresh.push(f);
  }
  const stale = [];
  for (const [key, n] of allowed) for (let i = current.get(key) ?? 0; i < n; i++) stale.push(key);
  let rc = 0;
  if (fresh.length && !(update && !existsSync(baselinePath))) {
    rc = 1;
    console.error(`${kind}: ${fresh.length} finding(s) not on ${spec.baseline}:`);
    for (const f of fresh) console.error(`  ${f.where}  ${f.key.split('\t').slice(1).join('  ')}`);
  }
  if (update) {
    if (fresh.length && existsSync(baselinePath)) {
      console.error(`${kind}: --update only removes lines; fix the findings above first`);
      return 1;
    }
    writeFileSync(baselinePath, findings.map((f) => f.key).sort().join('\n') + (findings.length ? '\n' : ''));
    console.log(`${kind}: ${spec.baseline} now has ${findings.length} line(s), ${stale.length} removed`);
    return 0;
  }
  if (stale.length) {
    rc = 1;
    console.error(`${kind}: ${stale.length} line(s) of ${spec.baseline} no longer occur; remove them with ${spec.fix}:`);
    for (const key of stale) console.error(`  ${key.replaceAll('\t', '  ')}`);
  }
  const limits = bases.filter((b) => existsSync(b)).map((b) => readList(b).length);
  if (limits.length && baseline.length > Math.max(...limits)) {
    rc = 1;
    console.error(`${kind}: ${spec.baseline} has ${baseline.length} lines, more than the ${Math.max(...limits)} of its base branches; the baseline may only shrink`);
  }
  console.log(`${kind}: ${findings.length} finding(s), baseline ${baseline.length}, new ${fresh.length}, fixed ${stale.length}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return rc;
}

process.exitCode = main(process.argv.slice(2));
