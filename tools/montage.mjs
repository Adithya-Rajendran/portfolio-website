// node montage.mjs out.png cols cellW a.png b.png ...
import { chromium } from 'playwright'; import fs from 'fs';
const [out, cols, cw, ...imgs] = process.argv.slice(2);
const b = await chromium.launch(); const rows = Math.ceil(imgs.length / cols);
const p = await b.newPage({ viewport: { width: cols * cw, height: 100 } });
await p.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${cw}px)">` + imgs.map((f) => `<div style="position:relative"><img width=${cw} src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><span style="position:absolute;left:4px;top:2px;color:#fff;font:12px sans-serif">${f.split('/').pop()}</span></div>`).join(''));
await p.screenshot({ path: out, fullPage: true }); await b.close();
