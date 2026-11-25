// Pixel diff (tools/pdiff.sh, tools/ci/run.sh).
//   node pdiff.mjs [--strict] [--fail-max=N] <dirA> <dirB> [heatdir]
// Per common png: max / mean abs difference (0-255, max over channels), % of pixels > 2 and > 8.
import { chromium } from 'playwright';
import fs from 'fs';

const args = process.argv.slice(2);
let strict = false;
let failMax = null;
const pos = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--strict') {
    strict = true;
  } else if (a.startsWith('--fail-max=')) {
    failMax = Number(a.slice(11));
  } else if (a === '--fail-max') {
    failMax = Number(args[++i]);
  } else {
    pos.push(a);
  }
}

if (failMax !== null && (Number.isNaN(failMax) || failMax < 0)) {
  console.error('pdiff: invalid --fail-max value');
  process.exit(2);
}

const [A, B, heat] = pos;
if (!A || !B) {
  console.error('usage: node pdiff.mjs [--strict] [--fail-max=N] <dirA> <dirB> [heatdir]');
  process.exit(2);
}

const pngsA = fs.readdirSync(A).filter((f) => f.endsWith('.png')).sort();
const pngsB = fs.readdirSync(B).filter((f) => f.endsWith('.png')).sort();
const setB = new Set(pngsB);
const setA = new Set(pngsA);
const names = pngsA.filter((f) => setB.has(f));

let failed = false;
if (strict) {
  const missingInB = pngsA.filter((f) => !setB.has(f));
  const missingInA = pngsB.filter((f) => !setA.has(f));
  if (missingInB.length || missingInA.length) {
    if (missingInB.length) console.error(`pdiff: missing in B: ${missingInB.join(', ')}`);
    if (missingInA.length) console.error(`pdiff: missing in A: ${missingInA.join(', ')}`);
    failed = true;
  }
}

if (names.length === 0) {
  console.error(`pdiff: no matching .png files between ${A} and ${B}`);
  process.exit(1);
}

if (heat) fs.mkdirSync(heat, { recursive: true });

const br = await chromium.launch();
const p = await br.newPage();
let worst = 0;

for (const n of names) {
  const r = await p.evaluate(async ([x, y]) => {
    const load = async (d) => {
      const i = new Image();
      i.src = 'data:image/png;base64,' + d;
      await i.decode();
      const c = document.createElement('canvas');
      c.width = i.width; c.height = i.height;
      const g = c.getContext('2d');
      g.drawImage(i, 0, 0);
      return [g.getImageData(0, 0, c.width, c.height), c.width, c.height];
    };
    const [a, w, h] = await load(x), [b, bw, bh] = await load(y);
    if (w !== bw || h !== bh) {
      return { mismatch: `${w}x${h} vs ${bw}x${bh}`, max: 255, mean: 255, gt2: 100, gt8: 100, heat: null };
    }
    const hc = document.createElement('canvas');
    hc.width = w; hc.height = h;
    const hg = hc.getContext('2d'), hm = hg.createImageData(w, h);
    let max = 0, sum = 0, n2 = 0, n8 = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      max = Math.max(max, d); sum += d; if (d > 2) n2++; if (d > 8) n8++;
      hm.data[i] = Math.min(255, d * 16); hm.data[i + 1] = hm.data[i + 2] = Math.min(255, d * 4); hm.data[i + 3] = 255;
    }
    hg.putImageData(hm, 0, 0);
    const N = a.data.length / 4;
    return { max, mean: +(sum / N).toFixed(3), gt2: +(100 * n2 / N).toFixed(3), gt8: +(100 * n8 / N).toFixed(3), heat: hc.toDataURL('image/png') };
  }, [fs.readFileSync(`${A}/${n}`).toString('base64'), fs.readFileSync(`${B}/${n}`).toString('base64')]);

  if (r.mismatch) failed = true;
  worst = Math.max(worst, r.max);
  if (heat && r.heat && (failMax === null || r.max > 0)) {
    fs.writeFileSync(`${heat}/${n}`, Buffer.from(r.heat.split(',')[1], 'base64'));
  }
  const out = { state: n.replace('.png', ''), max: r.max, mean: r.mean, 'pct>2': r.gt2, 'pct>8': r.gt8 };
  if (r.mismatch) out.mismatch = r.mismatch;
  console.log(JSON.stringify(out));
}

await br.close();
if (failed || (failMax !== null && worst > failMax)) {
  process.exit(1);
}
