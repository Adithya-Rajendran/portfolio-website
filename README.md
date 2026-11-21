# Arcadia Station — 3D portfolio rooms

Path-traced sci-fi rooms designed in Blender and shown in the browser with three.js. Plain HTML, CSS and ES modules; no JS build step. On a fresh checkout install the packing tools (`tools/get-pack-tools.sh`) and run `python3 tools/pack.py` before serving the rooms.

- `public/` — the site. Serve it with any static file server, e.g. `python3 -m http.server -d public`.
  - `index.html` — the portfolio. Rooms are `?room=about`, `?room=projects`, `?room=experience`, `?room=writing` (no parameter: the Atrium);
    moving between them does not reload the page.
  - `content.json` — everything the site says: page text, wall screens, hologram labels, route-map stations. Edit words here.
  - `main.js` — the shell: renderer, camera, controls, room changes. `js/room.js` builds a room, `js/screens.js`, `js/hologram.js`
    and `js/routemap.js` are the things in it, `js/post.js` is the image pipeline, `js/kit.js` holds what they share.
  - `assets/<room>/` — `scene.json`, `room.glb` and `tex/` for each room, packed by `tools/pack.py` from the tracked `assets-src/<room>/` bake masters.
  - `blueprint.html` — the 3D station blueprint. `vendor/` — three.js 0.181.
- `blender/` — scene scripts (`build_scene.py` for the Atrium and shared kit, `room_*.py` per room), `bake.py`, `backdrop.py`.
  `.blend` files are generated and not committed. `remote/` holds the PowerShell runners used on the bake machine.
- `tools/` — Playwright helpers run in Docker: screenshots (`dshot.sh`), frame times (`dperf.sh`), before/after snapshots
  (`dsnap.sh`) and the room-switching test (`docker/rooms.mjs`).
- `docs/blueprint.md` — the station design.
- [`docs/scene-assets.md`](docs/scene-assets.md) — measured room inventory, overlap and extraction tests. Open `/asset-catalogue/` on the preview server for the visual catalogue; run `python3 tools/review-models.py --list` for the Blender studios.

Rebuild a room: `blender -b --python blender/room_about.py`, then `blender -b blender/about.blend --python blender/bake.py -- 1.0 192`.

Earth imagery: NASA Blue Marble and Black Marble (public domain), see `blender/textures_dl/README.txt`.
