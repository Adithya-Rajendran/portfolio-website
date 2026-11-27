// The type-check and lint ratchet: tsc and oxlint findings compared with their baseline files in tools/ci and with the baselines of the base branches.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BIN = join(ROOT, 'node_modules/.bin');

const isTest = (f) => /\.test\.tsx?$/.test(f);
export const PROJECTS = [
  { config: 'tsconfig.json', owns: (f) => /^src\/.*\.jsx?$/.test(f) && !f.startsWith('src/app/') },
  { config: 'tsconfig.strict.json', owns: (f) => f.startsWith('src/') && !isTest(f) && (f.startsWith('src/app/') || /\.tsx?$/.test(f)) },
  { config: 'tsconfig.node.json', owns: (f) => isTest(f) || /^[^/]+\.ts$/.test(f) || /^tests\/.*\.ts$/.test(f) },
];

const KINDS = {
  typecheck: { baseline: 'tools/ci/ts-baseline.txt', find: typeFindings, fix: 'pnpm typecheck --update' },
  lint: { baseline: 'tools/ci/lint-baseline.txt', find: lintFindings, fix: 'pnpm lint --update' },
};

const clean = (text) => text.replace(/[\t\r\n]+/g, ' ').trim();
const slash = (f) => f.replaceAll('\\', '/');

const ownedByAny = (f) => PROJECTS.some((p) => p.owns(f));

export function parseTsc(text, status, owns = () => true, config = 'tsc', anyOwns = ownedByAny) {
  const findings = [], errors = [], seen = new Set();
  let matched = 0;
  for (const line of text.split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (m) {
      matched++;
      const [, raw, row, col, code, message] = m, file = slash(raw);
      if (/(^|\/)tsconfig[^/]*\.json$/.test(file) || !anyOwns(file)) {
        errors.push(`${config}: an error in a file that no type-check project reports: ${line.trim()}`);
        continue;
      }
      if (!owns(file) || seen.has(`${file}:${row}:${col}:${code}`)) continue;
      seen.add(`${file}:${row}:${col}:${code}`);
      findings.push({ key: [file, code, clean(message)].join('\t'), where: `${file}(${row},${col})` });
    } else if (/^\S/.test(line) && /error TS\d+/.test(line)) {
      errors.push(`${config}: an error without a file: ${line.trim()}`);
    }
  }
  if (status === null) errors.push(`${config}: tsc did not exit`);
  else if (status !== 0 && matched === 0) errors.push(`${config}: tsc exited with ${status} and printed no finding that the ratchet can read`);
  return { findings, errors };
}

function typeFindings() {
  const findings = [], errors = [];
  for (const p of PROJECTS) {
    const r = spawnSync(join(BIN, 'tsc'), ['-p', p.config, '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw r.error;
    const out = parseTsc(`${r.stdout}\n${r.stderr}`, r.status, p.owns, p.config);
    findings.push(...out.findings);
    errors.push(...out.errors);
  }
  return { findings, errors };
}

function lintFindings() {
  const r = spawnSync(join(BIN, 'oxlint'), ['--format', 'json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw r.error;
  let report;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    return { findings: [], errors: [`oxlint exited with ${r.status} and printed no report that the ratchet can read`] };
  }
  const findings = report.diagnostics.map((d) => {
    const file = slash(relative(ROOT, resolve(ROOT, d.filename))), at = d.labels?.[0]?.span;
    return { key: [file, d.code, clean(d.message)].join('\t'), where: at ? `${file}(${at.line},${at.column})` : file };
  });
  return { findings, errors: [] };
}

export const readList = (path) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter((l) => l.trim()) : []);

function counts(keys) {
  const map = new Map();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return map;
}

function minus(a, b) {
  const left = counts(b), out = [];
  for (const k of a) {
    const n = left.get(k) ?? 0;
    if (n > 0) left.set(k, n - 1);
    else out.push(k);
  }
  return out;
}

const finding = (key) => key.split('\t').slice(1).join('\t');

export function checkBases(lines, bases) {
  const errors = [];
  for (const { name, lines: base } of bases) {
    const extra = minus(lines, base), gone = counts(minus(base, lines).map(finding));
    for (const key of extra) {
      const n = gone.get(finding(key)) ?? 0;
      if (n > 0) gone.set(finding(key), n - 1);
      else errors.push(`not on the base baseline ${name}, and no line with the same code and message left another path: ${key.replaceAll('\t', '  ')}`);
    }
  }
  return errors;
}

export function compare(lines, findings) {
  const fresh = [], allowed = counts(lines), used = new Map();
  for (const f of findings) {
    const n = (used.get(f.key) ?? 0) + 1;
    used.set(f.key, n);
    if (n > (allowed.get(f.key) ?? 0)) fresh.push(f);
  }
  return { fresh, stale: minus(lines, findings.map((f) => f.key)) };
}

function gitBases(relPath) {
  const out = [];
  let refs = [];
  try {
    refs = execFileSync('git', ['-C', ROOT, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/prog/int', 'refs/heads/prog/ws-*'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch {
    return out;
  }
  for (const ref of refs) {
    try {
      const text = execFileSync('git', ['-C', ROOT, 'show', `${ref}:${relPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      out.push({ name: ref, lines: text.split('\n').filter((l) => l.trim()) });
    } catch {
      continue;
    }
  }
  return out;
}

export function main(argv) {
  const [kind, ...rest] = argv;
  const spec = KINDS[kind];
  if (!spec) {
    console.error('usage: node tools/ci/ratchet.mjs <typecheck|lint> [--update] [--base <baseline file>]...');
    return 2;
  }
  const update = rest.includes('--update'), baseFiles = [];
  for (let i = 0; i < rest.length; i++) if (rest[i] === '--base') baseFiles.push(rest[++i]);
  const bases = baseFiles.length ? baseFiles.filter((b) => existsSync(b)).map((b) => ({ name: b, lines: readList(b) })) : gitBases(spec.baseline);
  const started = Date.now(), { findings, errors } = spec.find(), baselinePath = join(ROOT, spec.baseline);
  const exists = existsSync(baselinePath), lines = readList(baselinePath);
  for (const e of errors) console.error(`${kind}: ${e}`);
  if (errors.length) return 1;
  const { fresh, stale } = compare(lines, findings);
  let rc = 0;
  if (update) {
    if (fresh.length && exists) {
      console.error(`${kind}: ${fresh.length} finding(s) not on ${spec.baseline}:`);
      for (const f of fresh) console.error(`  ${f.where}  ${finding(f.key).replaceAll('\t', '  ')}`);
      console.error(`${kind}: --update only removes lines; fix the findings above first`);
      return 1;
    }
    const next = findings.map((f) => f.key).sort(), baseErrors = checkBases(next, bases);
    if (baseErrors.length) {
      for (const e of baseErrors) console.error(`${kind}: ${e}`);
      console.error(`${kind}: --update did not write ${spec.baseline}; the baseline may only shrink`);
      return 1;
    }
    writeFileSync(baselinePath, next.join('\n') + (next.length ? '\n' : ''));
    console.log(`${kind}: ${spec.baseline} now has ${next.length} line(s), ${stale.length} removed`);
    return 0;
  }
  if (fresh.length) {
    rc = 1;
    console.error(`${kind}: ${fresh.length} finding(s) not on ${spec.baseline}:`);
    for (const f of fresh) console.error(`  ${f.where}  ${finding(f.key).replaceAll('\t', '  ')}`);
  }
  if (stale.length) {
    rc = 1;
    console.error(`${kind}: ${stale.length} line(s) of ${spec.baseline} no longer occur; remove them with ${spec.fix}:`);
    for (const key of stale) console.error(`  ${key.replaceAll('\t', '  ')}`);
  }
  const baseErrors = checkBases(lines, bases);
  if (baseErrors.length) {
    rc = 1;
    for (const e of baseErrors) console.error(`${kind}: ${spec.baseline}: ${e}`);
  }
  console.log(`${kind}: ${findings.length} finding(s), baseline ${lines.length}, new ${fresh.length}, fixed ${stale.length}, base baselines ${bases.length}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return rc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));