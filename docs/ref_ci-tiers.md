---
type: reference
title: The check tiers
depends: [docs/con_suite.md, docs/ref_doc-checks.md, docs/ref_ci-jobs.md]
---
# The check tiers

This reference gives the tiers that `tools/ci/run.sh <tier> [args]` runs.

| Tier | Arguments | What it runs | Locks |
|---|---|---|---|
| `static` | None | `tools/content.py`, `tools/test_*.py`, `node --test tools/test_*.mjs`, [the documentation and comment checks](ref_doc-checks.md) and `tools/site.py` | `quiet.lock`, shared |
| `smoke` | None | `errs.mjs` on `/`, `/about/`, `/portfolio/`, `/experience/`, `/contact/` and `/blog/` | `quiet.lock`, shared, and `gpu.lock` |
| `script` | `<name.mjs> [args...]` | One script `tools/docker/<name.mjs>`, through `tools/dtest.sh` | `quiet.lock`, shared, and `gpu.lock` |
| `suite` | None | `tools/check.sh`. See [the suite](con_suite.md). | `quiet.lock`, shared, and `gpu.lock` |
| `bench` | `"<query>" [runs] [seconds]` | `tools/docker/bench.mjs` at 1920 × 1080 px. The default of `runs` is 3, and the default of `seconds` is 8. | `quiet.lock`, exclusive, and `gpu.lock` |
| `snap` | `<name> <state=query>...` | Fixed 1920 × 1080 px screenshots with `detsnap.mjs` after 60 frames, into `$OUT/<name>/`. | `quiet.lock`, shared, and `gpu.lock` |
| `pdiff` | `<jobA/out/name> <jobB/out/name>` | The pixel difference with `pdiff.mjs`, in Docker without a GPU | `quiet.lock`, shared |
| `pictures` | `[--against <base>]` | The fixed states of `tools/ci/pictures.txt`, compared with golden pictures. See the list below. | `quiet.lock`, shared, `gpu.lock` and `pictures.lock` |
| `e2e` | `[playwright args...]` | The Playwright tests, `tests/e2e/run.mjs`, in `mcr.microsoft.com/playwright:v1.65.1-noble`. First the tests without `@timing` in parallel, then the `@timing` tests one at a time. | `quiet.lock`, shared, and `gpu.lock` |
| `perf` | `<subcommand> [args...]` | The performance commands `passes`, `cpuprof`, `unpinned`, `load`, `loadprof` and `bench`, and `blurdiff` with `<dirA> <dirB>` or pairs of images, without a GPU | `quiet.lock`, exclusive, but shared for `perf blurdiff`. `gpu.lock`, except for `blurdiff`. |

## The pictures tier

- The tier renders the 34 fixed states of `tools/ci/pictures.txt` in the six rooms with `tools/docker/detsnap.mjs`.
- `detsnap.mjs` hides the DOM layers without a change to the layout, under a fake clock that does not move.
- `detsnap.mjs` draws the 2D canvases in software (`--disable-accelerated-2d-canvas`), because text on a GPU canvas is not the same from run to run. The `snap` tier and `tools/detsnap.sh` use the same script, so they also draw in software.
- A state fails if requests or work on the page continue after 60 seconds of load or 20 seconds of frame steps.
- The tier compares each state with `pdiff.mjs --strict --fail-max=0`, so the maximum difference must be 0.
- Without `--against`, the tier compares the commit with the golden pictures of the same commit in the cache, and makes them on the first run.
- With `--against <base>`, the tier compares with the golden pictures of `<base>`. See [the golden cache](ref_ci-jobs.md#golden-pictures).
