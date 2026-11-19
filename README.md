# Arcadia Station — 3D portfolio rooms

Path-traced sci-fi rooms designed in Blender and shown in the browser with three.js. Plain HTML, CSS and ES modules; no build step.

- `public/` — the site. Serve it with any static file server, e.g. `python3 -m http.server -d public`.
  - `index.html` (Atrium), `about.html`, `projects.html`, `experience.html`, `blueprint.html` (3D station blueprint)
  - `main.js` + `js/` — the viewer; `vendor/` — three.js 0.181; `assets/` — baked meshes and textures per room
- `blender/` — scene scripts (`build_scene.py` for the Atrium and shared kit, `room_*.py` per room), `bake.py`, `backdrop.py`.
  `.blend` files are generated and not committed. `remote/` holds the PowerShell runners used on the bake machine.
- `tools/` — Playwright screenshot and timing helpers (`npm install` there first).
- `docs/blueprint.md` — the station design.

Rebuild a room: `blender -b --python blender/room_about.py`, then `blender -b blender/about.blend --python blender/bake.py -- 1.0 192`.

Earth imagery: NASA Blue Marble and Black Marble (public domain), see `blender/textures_dl/README.txt`.
