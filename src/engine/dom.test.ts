// Unit test that the lines of src/engine that use the page are the lines that docs/ref_engine-dom.md gives.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DOC = readFileSync(join(ROOT, 'docs/ref_engine-dom.md'), 'utf8');
const PATTERN = new RegExp(/```text\n(.+)\n```/.exec(DOC)![1]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(js|ts)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

test('only the files in docs/ref_engine-dom.md use the page, with the count of lines that it gives', () => {
  const found: Record<string, number> = {};
  for (const path of sources(join(ROOT, 'src/engine'))) {
    const n = readFileSync(path, 'utf8').split('\n').filter((line) => PATTERN.test(line)).length;
    if (n) found[relative(ROOT, path)] = n;
  }
  const allowed: Record<string, number> = {};
  for (const m of DOC.matchAll(/^\| `(src\/engine\/[^`]+)` \| (\d+) \|/gm)) allowed[m[1]] = Number(m[2]);
  expect(found).toEqual(allowed);
});
