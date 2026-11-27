---
type: reference
title: The source files
depends: [docs/ref_room-files.md, docs/ref_bake-runners.md, docs/con_content-sources.md, docs/con_page-generator.md, docs/ref_review-pages.md, docs/con_vite-output.md]
---
# The source files

This reference gives the directories of the repository and the files that the site uses.

## Directories

| Directory | Contents |
|---|---|
| `src/` | The scripts and the CSS files of the site. See [the Vite output](con_vite-output.md). |
| `src/engine/` | The scripts of the 3D station that `src/main.js` uses. |
| `src/pages/` | The review pages and their scripts. See [the review pages](ref_review-pages.md). |
| `src/styles/` | The CSS files. |
| `public/` | The files that `pnpm build` copies into `dist/` with no change. |
| `public/assets/<room>/` | The packed files of each room. See [the room files](ref_room-files.md). |
| `public/vendor/basis/` | The Basis transcoder of three.js 0.181.2. |
| `dist/` | The site that `pnpm build` makes. A static file server can serve it, for example `python3 tools/serve.py`. |
| `assets-src/<room>/` | The bake files of each room, which Git keeps. |
| `blender/` | The Blender scripts that make the rooms, bake them and make the probes and the backdrops. |
| `blender/remote/` | The scripts for the bake machines. See [the bake runners](ref_bake-runners.md). |
| `data/` | The content of the portfolio. See [the content sources](con_content-sources.md). |
| `tools/` | The tools that pack the rooms, make the pages and run the checks. |
| `tools/migrate/` | `f1-layout.sh`, which moved the files of the site from `public/` to `src/`, and `f1-map.txt`, the list of the paths before and after the move. |
| `tests/e2e/` | The Playwright tests. |
| `docs/` | The documentation modules and the data files that the review pages read. |

Git does not keep the `.blend` files, `dist/` or `node_modules/`.

The Blender scripts make the `.blend` files.

## Files of the site

| File | Contents |
|---|---|
| `index.html` | The shell of the site. [The page generator](con_page-generator.md) makes each page from the copy that Vite writes to `dist/index.html`. |
| `public/content.json` | All words of the rooms: the text of the pages, the wall screens, the hologram labels and the route stops. Change the words of the rooms in this file. |
| `src/main.js` | The renderer, the camera, the controls and the moves from room to room. |
| `src/engine/room.js` | The loader that makes a room from its packed files. |
| `src/engine/screens.js`, `src/engine/hologram.js`, `src/engine/routemap.js` | The wall screens, the hologram and the route map. |
| `src/engine/post.js` | The image passes after the render. |
| `src/engine/hud.js` | The display of the visitor: the display lock, the cue, the caption of the bar and the hint. |
| `src/engine/comms.js` | The links of Comms. |
| `src/engine/kit.js` | The functions that the other scripts share. |
| `src/engine/site.js` | The function that fills the rooms from the data: the placards, the route stops and the shelves of the Library. |
| `src/engine/reader.js` | The reader, which shows the article of a page on the reader panel. |
| `src/engine/opening/scan.js`, `receive.js`, `unfold.js` | The three ways that a thing opens for the reader. |
| `src/styles/post.css` | The styles of the pages that a visitor reads without the station. |
| `src/pages/blueprint.html` | The 3D blueprint of the station. See [the review pages](ref_review-pages.md). |
| `vite.config.ts`, `package.json`, `pnpm-lock.yaml` | The configuration of Vite, the scripts of pnpm and the versions of the packages. |

## Images of Earth

The images of Earth come from two NASA images, which are in the public domain.

`blender/textures_dl/README.txt` gives the sources.
