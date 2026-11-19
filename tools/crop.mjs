// node crop.mjs in.png out.png x y w h scale
import { chromium } from 'playwright'; import fs from 'fs';
const [inp, out, x, y, w, h, s = 3] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w * s, height: h * s } });
const d = fs.readFileSync(inp).toString('base64');
await p.setContent(`<body style="margin:0;overflow:hidden"><img src="data:image/png;base64,${d}" style="position:absolute;left:${-x * s}px;top:${-y * s}px;transform-origin:0 0;transform:scale(${s});image-rendering:pixelated">`);
await p.screenshot({ path: out }); await b.close();
