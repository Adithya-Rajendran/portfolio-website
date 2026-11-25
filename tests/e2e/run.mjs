import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const E2E_DIR = import.meta.dirname;
const ROOT = resolve(E2E_DIR, '../..');
const CLI = resolve(ROOT, 'node_modules/@playwright/test/cli.js');
const CONFIG = resolve(E2E_DIR, 'playwright.config.ts');

const args = process.argv.slice(2);
const hasGrep = args.some(
  (a) => a === '--grep' || a.startsWith('--grep=') || a === '-g' || a === '--grep-invert' || a.startsWith('--grep-invert='),
);

function run(extra, suffix = '') {
  const env = { ...process.env };
  if (suffix) {
    const baseOutput = process.env.PLAYWRIGHT_OUTPUT_DIR || join(ROOT, 'test-results');
    const baseReport = process.env.PLAYWRIGHT_HTML_REPORT || join(ROOT, 'playwright-report');
    env.PLAYWRIGHT_OUTPUT_DIR = join(baseOutput, suffix);
    env.PLAYWRIGHT_HTML_REPORT = join(baseReport, suffix);
  }
  const res = spawnSync(process.execPath, [CLI, 'test', '-c', CONFIG, ...extra, ...args], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  return res.status ?? 1;
}

if (hasGrep) {
  process.exit(run([]));
}

const parallelStatus = run(['--grep-invert', '@timing', '--pass-with-no-tests'], 'parallel');
const serialStatus = run(['--grep', '@timing', '--workers=1', '--pass-with-no-tests'], 'timing');
process.exit(parallelStatus !== 0 ? parallelStatus : serialStatus);
