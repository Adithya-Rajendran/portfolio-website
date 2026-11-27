// Static HTTP server for the end-to-end specs
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const siteDir = resolve(process.env.SITE_DIR || process.argv[2] || join(ROOT, 'dist'));
const port = Number(process.env.PORT || process.argv[3] || 8080);

function hasEntries(dir) {
  try {
    return existsSync(dir) && statSync(dir).isDirectory() && readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

function resolveAssetsDir() {
  if (process.env.ASSETS) return resolve(process.env.ASSETS);
  const localAssets = join(siteDir, 'assets');
  if (hasEntries(localAssets)) return localAssets;
  try {
    const common = execFileSync('git', ['-C', ROOT, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (common) {
      const commonAbs = resolve(ROOT, common);
      const mainAssets = resolve(commonAbs, '..', 'public', 'assets');
      if (hasEntries(mainAssets)) return mainAssets;
    }
  } catch {
  }
  return hasEntries(localAssets) ? localAssets : null;
}

const assetsDir = resolveAssetsDir();
const localAssetsDir = join(siteDir, 'assets');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2',
  '.yaml': 'text/yaml; charset=utf-8',
};

function underRoot(file, root) {
  return file === root || file.startsWith(root + sep);
}

createServer((req, res) => {
  let url;
  let path;
  try {
    url = new URL((req.url || '/').replace(/^\/+/, '/'), 'http://x');
    path = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('Bad request');
    return;
  }

  let baseDir = siteDir;
  let relPath = normalize(path);
  if (assetsDir && assetsDir !== localAssetsDir && (path === '/assets' || path.startsWith('/assets/'))) {
    baseDir = assetsDir;
    relPath = normalize(path.slice('/assets'.length) || '/');
  }

  const file = resolve(baseDir, '.' + (relPath.startsWith('/') ? relPath : '/' + relPath));
  if (!underRoot(file, baseDir)) {
    res.writeHead(403).end();
    return;
  }

  let target = file;
  let st;
  try {
    st = statSync(target);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }

  if (st.isDirectory()) {
    if (!path.endsWith('/')) {
      res.writeHead(301, { location: path + '/' + url.search }).end();
      return;
    }
    target = join(target, 'index.html');
    try {
      st = statSync(target);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(target)] || 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-cache',
  });
  createReadStream(target).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.error(`serving ${siteDir}${assetsDir && assetsDir !== localAssetsDir ? ` (assets: ${assetsDir})` : ''} on 127.0.0.1:${port}`);
});
