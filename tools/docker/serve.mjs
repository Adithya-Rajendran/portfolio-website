// A static server for tests, run inside the Playwright container:  node serve.mjs <dir> <port>
// Serves <dir> the way the site is hosted: /folder/ -> /folder/index.html, /folder -> 301 /folder/, no caching.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
const [dir, port] = [process.argv[2], +process.argv[3] || 8080];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2', '.yaml': 'text/yaml; charset=utf-8' };
createServer((req, res) => {
  let url, path;
  try {
    url = new URL((req.url || '/').replace(/^\/+/, '/'), 'http://x');
    path = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('Bad request');
    return;
  }
  const file = join(dir, normalize(path));
  if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
  let f = file, st; try { st = statSync(f); } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  if (st.isDirectory()) {
    if (!path.endsWith('/')) { res.writeHead(301, { location: path + '/' + url.search }).end(); return; }
    f = join(f, 'index.html'); try { st = statSync(f); } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache' });
  createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.error(`serving ${dir} on 127.0.0.1:${port}`));
