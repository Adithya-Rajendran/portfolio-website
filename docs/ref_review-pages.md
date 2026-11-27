---
type: reference
title: The review pages and the data files
depends: [docs/ref_lighting-checks.md]
---
# The review pages and the data files

This reference gives the pages for developers and the data files that they read.

`public/.assetsignore` keeps these pages out of the deployed site, but the previews and the test server serve them.

## Pages

| Page | Source | Contents |
|---|---|---|
| `/blueprint.html` | `public/blueprint.html`, `public/js/blueprint.js` | The 3D blueprint of the station, made from the models of the rooms. A hash selects a room, for example `/blueprint.html#about`. A query does not select a room. |
| `/asset-catalogue/parts.html` | `tools/scene-parts.py` | The parts inspector: each Blender object of each room before the bake, by builder, and the parts that move in the browser. |
| `/asset-catalogue/` | `tools/asset-catalogue.py` | The gallery of the models that the rooms share, from renders of their Blender studios. |
| `/lighting-review/` | `tools/finish-gallery.py` | Views of the packed rooms from the browser, the poses of the inspect views and two short films. |
| `/asset.html` | `public/asset.html`, `public/js/asset.js` | One live asset alone, for work on it, for example `asset.html?asset=drone&open=1`. |

The gallery shows renders from Blender.

The gallery is not evidence of the texture resolution or the shading in the browser.

## Data files

| File | Contents | Tool that writes it |
|---|---|---|
| `docs/scene-parts.tsv` | The totals of the objects of each room. | `tools/scene-parts.py` |
| `docs/asset-placements.tsv` | Each builder and the rooms that call it. | `tools/asset-inventory.py` |
| `docs/room-motion.json` | The parts that move, from the source code: shader effects and assemblies that only three.js makes. | Review of the source |
| `docs/motion-sample.jsonl` | A sample of the nodes that move in the packed rooms. | `tools/docker/motion-audit.mjs` |
| `docs/finish-evidence.json` | The measured results of the lighting checks, with the p95 values and the draw counts. | None. A person records the results of [the lighting checks](ref_lighting-checks.md). |
