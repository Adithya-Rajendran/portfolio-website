// Vite configuration of the site build and of the review pages build
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type BuildEnvironmentOptions } from 'vite';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = resolve(ROOT, 'dist');
const PAGE_STYLES = '<link rel="stylesheet" href="style.css">\n<link rel="stylesheet" href="post.css">';

const common: BuildEnvironmentOptions = {
  outDir: DIST,
  target: 'esnext',
  assetsInlineLimit: 0,
  modulePreload: { polyfill: false },
};

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
      build: { ...common, emptyOutDir: true, assetsDir: 'app' },
      plugins: [notFoundStyles()],
    });
