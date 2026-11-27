---
type: reference
title: The test map
depends: [docs/ref_browser-scripts.md]
---
# The test map

This reference gives each step of `tools/check.sh` and the test that holds it.

The scripts in `tools/docker/` and `tools/check.sh` continue to work until Playwright specs replace them.

See [the browser scripts](ref_browser-scripts.md) for what each script tests.

| Step or script of `tools/check.sh` | Subject | Test |
|---|---|---|
| `python3 tools/content.py` | The schema and the links of the content | The `static` tier |
| `python3 -m unittest tools/test_*.py` | The Python unit tests | The `static` tier |
| `python3 tools/site.py` | The pages, the JSON files and the feeds | The `static` tier, and the setup of `e2e` |
| `page.mjs /blog/<slug>/` | Posts without JavaScript: the DOM, the images and the links | `tests/e2e/specs/page.spec.ts` |
| `page.mjs /about/ /portfolio/ /experience/ /contact/` | The pages of the rooms without JavaScript | `tests/e2e/specs/page.spec.ts` |
| `page.mjs /portfolio/<slug>/` | Projects without JavaScript | `tests/e2e/specs/page.spec.ts` |
| `plaincheck-selftest.mjs` | 9 failures that the test makes, for plaincheck | `tests/e2e/specs/plaincheck.spec.ts` |
| `plainpage.mjs` | No JavaScript (`desktop`, `phone`), no WebGL, the 404 pages | `tests/e2e/specs/plainpage.spec.ts` |
| `opening.mjs all` | The ways that a thing opens: `scan`, `receive`, `unfold` | `tests/e2e/specs/opening.spec.ts` (`@timing`) |
| `turn.mjs all` | The turn of the route map, and the hint | `tests/e2e/specs/turn.spec.ts` (`@timing`) |
| `endpoints.mjs` | The feeds, the sitemap, `llms.txt`, the résumé PDF and the JSON files | `tests/e2e/specs/endpoints.spec.ts` |
| `errs.mjs`, for 6 paths | The same errors and the same load check as the script | `tests/e2e/specs/errs.spec.ts` |
| `view.mjs` | A WebGL smoke test in `chromium`, `firefox` and `webkit` | `tests/e2e/specs/view.spec.ts` |
| `rooms.text.mjs all, rooms.others.mjs, hostile.mjs, hud.mjs all, library.mjs all, rooms.read.mjs all, ringline.mjs, door.mjs, tour.mjs, cue.mjs all, rooms.cross.mjs, rooms.deeplink.mjs, contact.mjs all, deeplink.mjs, writing-alias.mjs, history.mjs` | These scripts check the display, the bar, the reader, the picks, Comms, the offer and the addresses | No spec. The script in `tools/docker/` is the test. |

- `writing-alias.mjs` tests `/blog/`, a room query that names no room, and Back and Forward.
- `ringline.mjs`, `door.mjs` and `tour.mjs` test the tour, the doors and the bar of the Ring Line.
- For the written again specs, `tests/e2e/fixtures/site.ts`, `tests/e2e/pages/station.ts` and `tests/e2e/serve.mjs` replace `rooms.kit.mjs`, `r2.kit.mjs` and `serve.mjs` of `tools/docker/`.
