// Difference of two pictures after each is averaged over 8x8 px
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('usage: node blurdiff.mjs <dirA> <dirB> | <a1.png> <b1.png> ...');
  process.exit(2);
}

const pairs = [];
if (args.length === 2) {
  const st0 = fs.statSync(args[0], { throwIfNoEntry: false });
  const st1 = fs.statSync(args[1], { throwIfNoEntry: false });
  if (!st0 || !st1) {
    console.error(`blurdiff: path not found: ${!st0 ? args[0] : args[1]}`);
    process.exit(2);
  }
  if (st0.isDirectory() && st1.isDirectory()) {
    const pngsA = fs.readdirSync(args[0]).filter((f) => f.endsWith('.png')).sort();
    const setB = new Set(fs.readdirSync(args[1]).filter((f) => f.endsWith('.png')));
    const names = pngsA.filter((f) => setB.has(f));
    if (names.length === 0) {
      console.error(`blurdiff: no matching .png files between ${args[0]} and ${args[1]}`);
      process.exit(1);
    }
    for (const n of names) pairs.push([path.join(args[0], n), path.join(args[1], n)]);
  } else if (st0.isDirectory() !== st1.isDirectory()) {
    console.error('blurdiff: both arguments must be directories or both must be files');
    process.exit(2);
  } else {
    pairs.push([args[0], args[1]]);
  }
} else {
  if (args.length % 2 !== 0) {
    console.error('usage: node blurdiff.mjs <dirA> <dirB> | <a1.png> <b1.png> ...');
    process.exit(2);
  }
  for (let i = 0; i < args.length; i += 2) {
    const st0 = fs.statSync(args[i], { throwIfNoEntry: false });
    const st1 = fs.statSync(args[i + 1], { throwIfNoEntry: false });
    if (!st0?.isFile() || !st1?.isFile()) {
      console.error(`blurdiff: file not found: ${!st0?.isFile() ? args[i] : args[i + 1]}`);
      process.exit(2);
    }
    pairs.push([args[i], args[i + 1]]);
  }
}

const br = await chromium.launch();
try {
  const p = await br.newPage();
  for (const [aPath, bPath] of pairs) {
    const r = await p.evaluate(async ([x, y]) => {
      const load = async (d) => { const im = new Image(); im.src = 'data:image/png;base64,' + d; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
      const a = await load(x), b = await load(y), W = a.width, H = a.height, K = 8;
      if (W !== b.width || H !== b.height) throw new Error(`blurdiff: size mismatch ${W}x${H} vs ${b.width}x${b.height}`);
      let sum = 0, max = 0, n = 0, over2 = 0, raw = 0;
      for (let i = 0; i < a.data.length; i += 4) raw += Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      for (let by = 0; by + K <= H; by += K) for (let bx = 0; bx + K <= W; bx += K) {
        let d = 0;
        for (let ch = 0; ch < 3; ch++) { let sa = 0, sb = 0; for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) { const o = ((by + yy) * W + bx + xx) * 4 + ch; sa += a.data[o]; sb += b.data[o]; } d = Math.max(d, Math.abs(sa - sb) / (K * K)); }
        sum += d; max = Math.max(max, d); n++; if (d > 2) over2++;
      }
      return { raw_mean: +(raw / (W * H)).toFixed(3), blocks_mean: +(sum / n).toFixed(3), blocks_max: +max.toFixed(1), blocks_over2_pct: +(100 * over2 / n).toFixed(2) };
    }, [fs.readFileSync(aPath).toString('base64'), fs.readFileSync(bPath).toString('base64')]);
    console.log(bPath.split('/').slice(-2).join('/'), JSON.stringify(r));
  }
} finally {
  await br.close();
}
