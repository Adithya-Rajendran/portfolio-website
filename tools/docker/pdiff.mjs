// Pixel diff (tools/pdiff.sh).  node pdiff.mjs <dirA> <dirB> [heatdir]  -> per common png: max / mean abs difference (0-255, max over channels), % of pixels > 2 and > 8
import { chromium } from 'playwright'; import fs from 'fs';
const [A, B, heat] = process.argv.slice(2);
const names = fs.readdirSync(A).filter((f) => f.endsWith('.png') && fs.existsSync(`${B}/${f}`)).sort();
const br = await chromium.launch(); const p = await br.newPage();
for (const n of names) {
  const r = await p.evaluate(async ([x, y]) => {
    const load = async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return [g.getImageData(0, 0, c.width, c.height), c.width, c.height]; };
    const [a, w, h] = await load(x), [b] = await load(y), hc = document.createElement('canvas'); hc.width = w; hc.height = h;
    const hg = hc.getContext('2d'), hm = hg.createImageData(w, h);
    let max = 0, sum = 0, n2 = 0, n8 = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
      max = Math.max(max, d); sum += d; if (d > 2) n2++; if (d > 8) n8++;
      hm.data[i] = Math.min(255, d * 16); hm.data[i + 1] = hm.data[i + 2] = Math.min(255, d * 4); hm.data[i + 3] = 255;
    }
    hg.putImageData(hm, 0, 0); const N = a.data.length / 4;
    return { max, mean: +(sum / N).toFixed(3), gt2: +(100 * n2 / N).toFixed(3), gt8: +(100 * n8 / N).toFixed(3), heat: hc.toDataURL('image/png') };
  }, [fs.readFileSync(`${A}/${n}`).toString('base64'), fs.readFileSync(`${B}/${n}`).toString('base64')]);
  if (heat) fs.writeFileSync(`${heat}/${n}`, Buffer.from(r.heat.split(',')[1], 'base64'));
  console.log(JSON.stringify({ state: n.replace('.png', ''), max: r.max, mean: r.mean, 'pct>2': r.gt2, 'pct>8': r.gt8 }));
}
await br.close();
