---
type: reference
title: The source files
depends: [docs/ref_room-files.md, docs/ref_bake-runners.md, docs/con_content-sources.md, docs/con_page-generator.md, docs/ref_review-pages.md]
---
# The source files

This reference gives the directories of the repository and the files that the site uses.

## Directories

| Directory | Contents |
|---|---|
| `public/` | The site. A static file server can serve it, for example `python3 -m http.server -d public`. |
| `public/assets/<room>/` | The packed files of each room. See [the room files](ref_room-files.md). |
| `public/vendor/` | three.js 0.181. |
| `assets-src/<room>/` | The bake files of each room, which Git keeps. |
| `blender/` | The Blender scripts that make the rooms, bake them and make the probes and the backdrops. |
| `blender/remote/` | The scripts for the bake machines. See [the bake runners](ref_bake-runners.md). |
| `data/` | The content of the portfolio. See [the content sources](con_content-sources.md). |
| `tools/` | The tools that pack the rooms, make the pages and run the checks. |
| `tests/e2e/` | The Playwright tests. |
| `docs/` | The documentation modules and the data files that the review pages read. |

Git does not keep the `.blend` files.

The Blender scripts make the `.blend` files.

## Files of the site

| File | Contents |
|---|---|
| `public/index.html` | The shell of the site. [The page generator](con_page-generator.md) makes each page from it. |
| `public/content.json` | All words of the rooms: the text of the pages, the wall screens, the hologram labels and the route stops. Change the words of the rooms in this file. |
| `public/main.js` | The renderer, the camera, the controls and the moves from room to room. |
| `public/js/room.js` | The loader that makes a room from its packed files. |
| `public/js/screens.js`, `public/js/hologram.js`, `public/js/routemap.js` | The wall screens, the hologram and the route map. |
| `public/js/post.js` | The image passes after the render. |
| `public/js/hud.js` | The display of the visitor: the display lock, the cue, the caption of the bar and the hint. |
| `public/js/comms.js` | The links of Comms. |
| `public/js/kit.js` | The functions that the other scripts share. |
| `public/js/site.js` | The function that fills the rooms from the data: the placards, the route stops and the shelves of the Library. |
| `public/js/reader.js` | The reader, which shows the article of a page on the reader panel. |
| `public/js/opening/scan.js`, `receive.js`, `unfold.js` | The three ways that a thing opens for the reader. |
| `public/post.css` | The styles of the pages that a visitor reads without the station. |
| `public/blueprint.html` | The 3D blueprint of the station. See [the review pages](ref_review-pages.md). |

## Images of Earth

The images of Earth come from two NASA images, which are in the public domain.

`blender/textures_dl/README.txt` gives the sources.
