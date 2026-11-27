---
type: reference
title: The room files
depends: [docs/ref_scene-json.md]
---
# The room files

This reference gives the files that `tools/pack.py` makes for each room in `public/assets/<room>/` from the bake files in `assets-src/<room>/`.

## Files

| File | Contents |
|---|---|
| `scene.json` | The cameras, the doors and the things in the room. See [the scene file](ref_scene-json.md). |
| `room.glb` | The geometry. |
| `tex/` | The textures of the baked light, in KTX2 format. |

## Textures

- Each sky angle and each orrery phase has one KTX2 file for each layer: `<group>_s0.ktx2` and `<group>_c0.ktx2` and the next numbers. `tex_layers` in `scene.json` gives the number of layers.
- The room loader loads the layers that the room uses before the cover goes away, and the other layers after it.
- The pack tool cuts each other texture, except the probe, into two files.
- `<name>.tail.ktx2` holds the levels that are more than a quarter of the full size.
- `<name>.head.ktx2` holds the other levels. The cover goes away when the room has the head files.
- The browser loads the tail after the head and joins the two parts. `tex_split` in `scene.json` gives the cuts.
- A texture with a maximum of 2 levels, or a texture with a tail of less than 64 KB (`MIN_TAIL` in `tools/pack.py`), is one file.

## Checks of the pack tool

- The pack tool refuses a room when its `room.glb` has faces on the same plane that overlap, or faces that are duplicates. This applies only when a camera, a door, an inspect position or an eye position can see them. These faces flicker in the browser.
- `python3 tools/geomcheck.py <room>` lists these faces.
- The pack tool checks all necessary layers before it replaces a room that works.
- The pack tool does not encode a stale layer that the room does not use.
- The pack tool refuses a room when a layer is not there, for example `probe_c3.webp`, and it keeps the room files that it made before.
