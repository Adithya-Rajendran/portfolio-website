---
type: reference
title: The test map
depends: [docs/ref_browser-scripts.md]
---
# The test map

This reference gives each step of `tools/check.sh` and the test that holds it.

The scripts in `tools/docker/` and `tools/check.sh` continue to work until Playwright specs replace them.

See [the browser scripts](ref_browser-scripts.md) for what each script tests.

| Step or script of `tools/check.sh` | Test |
|---|---|
| `python3 tools/content.py` | The `static` tier |
| `python3 -m unittest tools/test_*.py` | The `static` tier |
| `python3 tools/site.py` | The `static` tier, and the setup of `e2e` |
| `page.mjs /blog/<slug>/` | `tests/e2e/specs/page.spec.ts` |
| `page.mjs /about/ /portfolio/ /experience/ /contact/` | `tests/e2e/specs/page.spec.ts` |
| `page.mjs /portfolio/<slug>/` | `tests/e2e/specs/page.spec.ts` |
| `plaincheck-selftest.mjs` | `tests/e2e/specs/plaincheck.spec.ts` |
| `plainpage.mjs` | `tests/e2e/specs/plainpage.spec.ts` |
| `opening.mjs all` | `tests/e2e/specs/opening.spec.ts` (`@timing`) |
| `turn.mjs all` | `tests/e2e/specs/turn.spec.ts` (`@timing`) |
| `endpoints.mjs` | `tests/e2e/specs/endpoints.spec.ts` |
| `errs.mjs`, for 6 paths | `tests/e2e/specs/errs.spec.ts` |
| `view.mjs` | `tests/e2e/specs/view.spec.ts` |
| `rooms.text.mjs all, rooms.others.mjs, hostile.mjs, hud.mjs all, library.mjs all, rooms.read.mjs all, ringline.mjs, door.mjs, tour.mjs, cue.mjs all, rooms.cross.mjs, rooms.deeplink.mjs, contact.mjs all, deeplink.mjs, writing-alias.mjs, history.mjs` | No spec. The script in `tools/docker/` is the test. |

- In the Playwright specs, `tests/e2e/fixtures/site.ts`, `tests/e2e/pages/station.ts` and `tests/e2e/serve.mjs` replace `rooms.kit.mjs`, `r2.kit.mjs` and `serve.mjs` of `tools/docker/`.
