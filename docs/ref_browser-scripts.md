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
| `tools/dtest.sh <script.mjs> [args]` | Runs a script from `tools/docker/` on the checkout that holds it. It serves `dist/`, which `pnpm build` makes, inside the container at the loopback address of the container, port 8080 (`ORIGIN`), and the host opens no port. The screenshots go to `/out`, which is `$OUT` on the host, by default `/tmp/dtest`. |
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
| `hud.mjs`, with `desktop`, `phone`, `reduced` or `all` | [The display of the visitor](con_display.md): the display lock, the names, the caption of the bar and the hint. The READ glyph and the scan do not move until the visitor requests READ. |
| `rooms.text.mjs` | The words of the page (`sub`), and the wall screens that are not picks. |
| `opening.mjs` | The ways that a thing opens for [the reader](con_reading.md): Fabrication (scan, receive), the books of the Lounge and a route stop that unfolds. |
| `turn.mjs` | The turn of the route map with a mouse, a pen, touch and a wheel, the tour and the hint of Navigation. |
| `cue.mjs` | The cue of the Library and the errand of the drone. |
| `contact.mjs` | The three links of Comms: LinkedIn as the way to write, GitHub and the résumé. Also the keyboard, the new tabs and the contrast of the text. |
| `rooms.read.mjs` | Each room at its path. |
| `rooms.others.mjs` | The things that the visitor reads in Fabrication, Navigation and the Lounge, from the profile. |
| `rooms.cross.mjs` | The links from one article in `#reader` to a different article. |
| `rooms.deeplink.mjs` | The address of a project and of a timeline entry, and the size of the reader while it moves. |
| `library.mjs` | The Library. |
| `history.mjs` | The address and Back. |
| `deeplink.mjs` | The address of an article, and the offer `#stepin`. |
| `hostile.mjs` | The rooms with hostile data and with thin data. |
| `rooms.mjs` | The moves from room to room without a new load of the page: a nav link, Back and a door. Also a check for leaks over many visits. |
| `page.mjs <path>` | A page that the generator wrote, with JavaScript off, for example `dtest.sh page.mjs /blog/<slug>/`. |
| `errs.mjs <url>` | The errors of the console, of the page, of the requests and of HTTP, and the load of the room. |
| `endpoints.mjs` | The feeds, the sitemap, `llms.txt`, the résumé PDF and the JSON files. |
| `plainpage.mjs` | The pages with no JavaScript (`desktop`, `phone`), with no WebGL, and the 404 pages. |
| `plaincheck-selftest.mjs` | 9 failures that the script makes, to test the checks of `plaincheck.mjs`. |
| `view.mjs` | A WebGL smoke test in `chromium`, `firefox` and `webkit`. |
| `ringline.mjs`, `door.mjs`, `tour.mjs` | The tour, the doors and the bar of the Ring Line. |
| `writing-alias.mjs` | `/blog/`, a room query that names no room, and Back and Forward. |
| `measure-selftest.mjs` | [The measure scripts](#the-measure-scripts): a plain page fails at once, the hero page with a pin gives GPU ms, and the deadline stops a script. |

- `rooms.kit.mjs` and `r2.kit.mjs` hold what these scripts share: the profiles, a recorder of the meshes of the reader, and a gate on the frames of the page.
- `r2.kit.mjs` also holds a clock that adds the time of the frames of the page.
- [The lighting checks](ref_lighting-checks.md) are also scripts in `tools/docker/`.

## The measure scripts

`passes.mjs` and `bench.mjs` use a timer query of the GPU, and a page can have only one timer query at a time.

| Rule | What the scripts do |
|---|---|
| Pin | The query of the page must pin the governor with `tier=0` or `tier=1`, and with `scale=1`, for example `/?shot=hero&tier=0&scale=1`. |
| Page without a pin | The script stops at once with the exit code 1, and its message names `tier` and `scale`. |
| No sample | The script stops with the exit code 1 when no GPU result comes. |
| Deadline | After 180 seconds and 3 seconds for each second of measure, the script stops the browser and ends with the exit code 3. |
| Deadline of `bench.mjs` | The time is 180 seconds, and 60 seconds and 3 seconds for each second of measure, for each run. |
| Variable | `MEASURE_TIMEOUT_S` sets the deadline in seconds. |

- `measure-guard.mjs` holds the pin check and the deadline that both scripts use.
- `tools/test_measure_guard.mjs` tests them without a browser, with `measure-hang.mjs` as a script that does not stop.
- `ci <ref> script measure-selftest.mjs` runs both scripts on a plain page and on the hero page with a pin.
