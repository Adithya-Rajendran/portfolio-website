// Vite configuration of the site build and of the review pages build
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type BuildEnvironmentOptions } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = resolve(ROOT, 'dist');
const PUBLIC = resolve(ROOT, 'public');
const PAGE_STYLES = '<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="post.css">';

const common: BuildEnvironmentOptions = {
  outDir: DIST,
  target: 'esnext',
  assetsInlineLimit: 0,
  modulePreload: { polyfill: false },
};

function publicPages(): Plugin {
  return {
    name: 'arcadia:public-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        const path = url.split('?')[0];
        if (path !== '/' && path.endsWith('/')) {
          const page = resolve(PUBLIC, '.' + decodeURIComponent(path), 'index.html');
          if (page.startsWith(PUBLIC + '/') && existsSync(page)) req.url = path + 'index.html' + url.slice(path.length);
        }
        next();
      });
    },
  };
}

function notFoundStyles(): Plugin {
  return {
    name: 'arcadia:404-styles',
    apply: 'build',
    closeBundle() {
      const links = readFileSync(resolve(DIST, 'index.html'), 'utf8').match(/<link rel="stylesheet"[^>]*>/g) ?? [];
      if (links.length === 0) throw new Error('dist/index.html links no stylesheet');
      const file = resolve(DIST, '404.html');
      const page = readFileSync(file, 'utf8');
      if (page.split(PAGE_STYLES).length !== 2) throw new Error('public/404.html must link style.css and post.css once');
      writeFileSync(file, page.replace(PAGE_STYLES, links.join('\n')));
    },
  };
}

export default defineConfig(({ mode }) => mode === 'review'
  ? {
      root: resolve(ROOT, 'src/pages'),
      publicDir: false,
      build: {
        ...common,
        emptyOutDir: false,
        assetsDir: 'app/review',
        rollupOptions: { input: { blueprint: resolve(ROOT, 'src/pages/blueprint.html'), asset: resolve(ROOT, 'src/pages/asset.html') } },
      },
    }
  : {
      root: ROOT,
      build: { ...common, emptyOutDir: true, assetsDir: 'app', sourcemap: 'hidden',
        modulePreload: { polyfill: false, resolveDependencies: (_file, deps, { hostType }) => (hostType === 'html' ? [] : deps) } },
      plugins: [publicPages(), notFoundStyles()],
    });
