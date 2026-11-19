// node diff.mjs a.png b.png -> mean absolute difference per channel (0-255) and the share of pixels that changed visibly
import { chromium } from 'playwright'; import fs from 'fs';
const [a, b] = process.argv.slice(2), b64 = (f) => fs.readFileSync(f).toString('base64');
const br = await chromium.launch(); const p = await br.newPage();
const r = await p.evaluate(async ([A, B]) => {
  const load = async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
  const x = await load(A), y = await load(B); let s = 0, n = 0, big = 0;
  for (let i = 0; i < x.length; i += 4) { const d = (Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2])) / 3; s += d; n++; if (d > 6) big++; }
  return { mean: +(s / n).toFixed(2), changed: +(100 * big / n).toFixed(1) + '%' };
}, [b64(a), b64(b)]);
console.log(JSON.stringify(r)); await br.close();
