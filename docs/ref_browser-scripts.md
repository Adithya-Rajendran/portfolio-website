---
type: reference
title: The browser scripts
depends: [docs/con_display.md, docs/con_reading.md, docs/ref_lighting-checks.md]
---
# The browser scripts

This reference gives the Playwright scripts in `tools/docker/` that check the site, and the tools that run them.

## Tools

| Tool | Use |
|---|---|
| `tools/dtest.sh <script.mjs> [args]` | Runs a script from `tools/docker/` on the checkout that holds it. It serves `public/` inside the container at `http://127.0.0.1:8080` (`ORIGIN`), and the host opens no port. The screenshots go to `/out`, which is `$OUT` on the host, by default `/tmp/dtest`. |
| `tools/dshot.sh` | Screenshots. |
| `tools/dperf.sh` | Frame times. |
| `tools/dsnap.sh` | Screenshots before and after a change. |
| `tools/detsnap.sh` | Fixed screenshots with `detsnap.mjs`. |
| `tools/pdiff.sh` | The pixel difference of two sets of screenshots. |

## Scripts

Each script shows `ok` or `FAIL [item] what`, and it stops with the exit code 1 after a failure.

`tools/check.sh` runs them all, and `tools/dtest.sh <script> [desktop|phone|reduced]` runs one of them.

| Script | Tests |
|---|---|
| `hud.mjs`, with `desktop`, `phone`, `reduced` or `all` | [The display of the visitor](con_display.md): the lock, the names, the caption of the bar and the hint. The READ glyph and the scan do not move until the visitor requests READ. |
| `rooms.text.mjs` | The words of the page (`sub`), and the wall screens that are not picks. |
| `opening.mjs` | The ways that a thing opens for [the reader](con_reading.md): Fabrication (scan, receive), the books of the Lounge and a station that unfolds. |
| `turn.mjs` | The turn of the route map with a mouse, a pen, touch and a wheel, the tour and the hint of Navigation. |
| `cue.mjs` | The cue of the Library and the errand of the drone. |
| `contact.mjs` | The three links of Comms: LinkedIn as the way to write, GitHub and the resume. Also the keyboard, the new tabs and the contrast of the text. |
| `rooms.read.mjs` | Each room at its path. |
| `rooms.others.mjs` | The things that the visitor reads in Fabrication, Navigation and the Lounge, from the profile. |
| `rooms.cross.mjs` | The links from one article in `#reader` to a different article. |
| `rooms.deeplink.mjs` | The address of a project and of a timeline entry. |
| `library.mjs` | The Library. |
| `history.mjs` | The address and Back. |
| `deeplink.mjs` | The address of an article, and the offer `#stepin`. |
| `hostile.mjs` | The rooms with hostile data and with thin data. |
| `rooms.mjs` | The moves from room to room without a new load of the page: a nav link, Back and a door. Also a check for leaks over many visits. |
| `page.mjs <path>` | A page that the generator wrote, with JavaScript off, for example `dtest.sh page.mjs /blog/<slug>/`. |
| `errs.mjs <url>` | The errors of the console, of the page, of the requests and of HTTP, and the load of the room. |

- `rooms.kit.mjs` and `r2.kit.mjs` hold what these scripts share: the profiles, a recorder of the meshes of the reader, and a gate on the frames of the page.
- [The lighting checks](ref_lighting-checks.md) are also scripts in `tools/docker/`.
