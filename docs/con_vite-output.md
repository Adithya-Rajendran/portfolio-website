---
type: concept
title: The Vite output
depends: [docs/con_page-generator.md, docs/ref_review-pages.md, docs/ref_endpoints.md, docs/ref_test-hooks.md]
---
# The Vite output

`pnpm build` makes the site that the servers send and that Cloudflare publishes.
It writes all files into `dist/`, and Git does not keep this directory.

## Commands

`pnpm build` runs these three commands, in this sequence:

| Command | Output |
|---|---|
| `vite build` | `dist/index.html`, one bundle and one CSS file in `dist/app/`, and a copy of each file of `public/` |
| `vite build --mode review` | The review pages `dist/blueprint.html` and `dist/asset.html`, with their scripts in `dist/app/review/` |
| `python3 tools/site.py --shell dist/index.html --out dist` | The pages, the JSON files and the endpoints, from the shell that Vite wrote |

- [The page generator](con_page-generator.md) tells how the generator makes a page from the shell.
- [The review pages](ref_review-pages.md) tells which pages the upload does not include.

## Files

Vite makes one bundle from `src/main.js`, the scripts that it uses and three.js.
Vite makes one CSS file from `src/styles/style.css` and `src/styles/post.css`.
The name of each file in `/app/` has a hash of its content, so a new version of a file has a new name.
For this reason, the cache rule of `/app/*` is `immutable`. See [the cache rules](ref_endpoints.md#cache-rules).

- three.js 0.181.2 comes from the `three` package.
- The Basis transcoder is not in the bundle. The KTX2 loader reads its two files from `public/vendor/basis/`.
- `public/404.html` does not move. After `vite build`, `pnpm build` changes its two links to CSS files into the link to the CSS file in `dist/app/`.
- `vite.config.ts` holds the configuration of the two Vite commands.
- `package.json` gives the scripts `dev`, `build` and `preview`, and the versions of the packages.
- `pnpm-lock.yaml` records the versions of all packages.
- The CI host installs the packages with `pnpm install --frozen-lockfile --ignore-scripts`, so no package runs a script when it installs.

## The server of Vite

`pnpm dev` writes the pages into `public/` with `tools/site.py --shell index.html --out public`.
Then it starts the server of Vite, which serves `index.html`, `src/` and `public/`.
These pages load `/src/main.js` from the server of Vite, so a change to a script shows after a new load of the page.
The server of Vite shows the review pages at `/src/pages/blueprint.html` and `/src/pages/asset.html`.

On the server of Vite and on each DEV host, `src/main.js` also sets `window.__modules` for the tests. See [the test hooks](ref_test-hooks.md#modules-for-the-tests).
