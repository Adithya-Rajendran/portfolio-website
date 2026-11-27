---
type: reference
title: The lighting checks
depends: []
---
# The lighting checks

This reference gives the browser scripts in `tools/docker/` that check the light of the packed rooms.

Run each script in the Docker and Playwright environment of the repository.

The query `?lightcheck=1` uses the same passes for the room, the shadow, the reflection and the post image as the standard page.

The query `?lightcheck=1` can also set a fixed eye, target and time.

The test lamps and the layer masks of these scripts are not in the scene of a visitor.

| Command | Check |
|---|---|
| `node lighting.mjs URL outdir all` | Compares the reflection on and off at the same points in the room. Compares red test lamps with the image that the geometry predicts, in two planes. Checks the floor mirror, the polished glass and the sunlight from fixed camera poses. |
| `node floor-check.mjs URL` | Repeats the check of the virtual image on a clear part of the deck in each room. Compares the sun depths in each room with a window: first the eye moves, then the sun turns. In the Library, it isolates the drone from the sun map and the window light from its PBR materials during a request. |
| `node inspect-finish.mjs URL outdir about projects writing` | Captures the pick poses, which include an open volume from the drone. The near view of the Lounge has a label. |
| `node light-clips.mjs URL outdir <ffmpeg>` | Records the two short films from live draws of the frame buffer. `<ffmpeg>` is the path of `ffmpeg-linux` under `/ms-playwright/`. |
| `node detsnap.mjs ORIGIN OUT 10 'experience=/experience/?shot=hero&tier=0&scale=1&rollat=0&chand=0'` | Makes a fixed hero view with a seed. Use the other room ids for the other rooms. |
| `node grazing.mjs BEFORE AFTER SHOTS/diagnostics` | Renders the same camera on the table in two builds of the site. |
| `node light-compat.mjs URL chromium 960 540` | Checks the default reduced motion. Compares lit frames with frames without the rough base batches, because a page can remove the loader while the opaque bakes are dark. Use `webkit` in place of `chromium` for WebKit. Set `LIGHT_DEFAULT=1` to use the adaptive quality settings of the site. |
| `node finish-bench.mjs BEFORE_URL AFTER_URL 150` | Measures the frame time of two packs on the same GPU, with a warm up for each visit. |
| `python3 tools/finish-gallery.py SHOTS` | Makes `/lighting-review/` from `matched-before/`, `after/`, `inspect/`, `clips/` and `diagnostics/grazing-{before,after}.png`. It does not use studio images. |
| `node motion-audit.mjs URL` | Records the nodes that move in the packed rooms. On success, save its six JSON lines to `docs/motion-sample.jsonl`. |

- The motion sample counts the nodes with a local transform that changes, under nodes that can be visible. It does not count the camera, inherited transforms, vertices or particles that move without a node, shader motion, canvas draws or post effects.
