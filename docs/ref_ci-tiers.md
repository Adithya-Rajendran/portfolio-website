---
type: reference
title: The check tiers
depends: [docs/con_suite.md, docs/ref_doc-checks.md, docs/ref_js-checks.md, docs/ref_ci-jobs.md, docs/ref_e2e-files.md]
---
# The check tiers

This reference gives the tiers that `tools/ci/run.sh <tier> [args]` runs.

Each tier that serves the site first runs `pnpm install` and `pnpm build`, and then serves `dist/`.

| Tier | Arguments | What it runs | Locks |
|---|---|---|---|
| `static` | None | `tools/content.py`, `tools/test_*.py`, `node --test tools/test_*.mjs`, `pnpm install` with [the type check, the lint check and the unit tests](ref_js-checks.md), [the documentation and comment checks](ref_doc-checks.md) and `tools/site.py` | `quiet.lock`, shared |
| `build` | None | `pnpm install` and `pnpm build`, and then the checks of [the build tier](#the-build-tier) | `quiet.lock`, shared |
| `unit` | `[vitest args...]` | `pnpm install` and the Vitest project `unit` in Node | `quiet.lock`, shared |
| `component` | `[vitest args...]` | `pnpm install` and the Vitest project `component` in `mcr.microsoft.com/playwright:v1.65.1-noble`. See [the tests in Chromium](#the-tests-in-chromium). | `quiet.lock`, shared, and `gpu.lock` |
| `smoke` | None | `errs.mjs` on `/`, `/about/`, `/portfolio/`, `/experience/`, `/contact/` and `/blog/` | `quiet.lock`, shared, and `gpu.lock` |
| `script` | `<name.mjs> [args...]` | One script `tools/docker/<name.mjs>`, through `tools/dtest.sh` | `quiet.lock`, shared, and `gpu.lock` |
| `suite` | None | `tools/check.sh`. See [the suite](con_suite.md). | `quiet.lock`, shared, and `gpu.lock` |
| `bench` | `"<query>" [runs] [seconds]` | `tools/docker/bench.mjs` at 1920 × 1080 px. The default of `runs` is 3, and the default of `seconds` is 8. | `quiet.lock`, exclusive, and `gpu.lock` |
| `snap` | `<name> <state=query>...` | Fixed 1920 × 1080 px screenshots with `detsnap.mjs` after 60 frames, into `$OUT/<name>/`. | `quiet.lock`, shared, and `gpu.lock` |
| `pdiff` | `<jobA/out/name> <jobB/out/name>` | The pixel difference with `pdiff.mjs`, in Docker without a GPU | `quiet.lock`, shared |
| `pictures` | `[--against <base>]` | The fixed states of `tools/ci/pictures.txt`, compared with golden pictures. See the list below. | `quiet.lock`, shared, `gpu.lock` and `pictures.lock` |
| `e2e` | `[playwright args...]` | [The Playwright tests](ref_e2e-files.md) through `tests/e2e/run.mjs`, in `mcr.microsoft.com/playwright:v1.65.1-noble`. | `quiet.lock`, shared, and `gpu.lock` |
| `perf` | `<subcommand> [args...]` | The performance commands `passes`, `cpuprof`, `unpinned`, `load`, `loadprof` and `bench`, and `blurdiff` with `<dirA> <dirB>` or pairs of images, without a GPU | `quiet.lock`, exclusive, but shared for `perf blurdiff`. `gpu.lock`, except for `blurdiff`. |

## The build tier

- The tier fails if `dist/index.html`, `dist/404.html`, `dist/blueprint.html` or `dist/asset.html` is not there.
- The tier fails if `dist/app/` has no script or no CSS file.
- The tier writes the number of files, the number of bytes and the number of pages in `dist/`.
- The tier writes the bytes of each script and CSS file in `dist/app/`, and their bytes in gzip.

## The tests in Chromium

- The tier passes without tests when `vitest.config.ts` has no project with the name `component`.
- The tier mounts the checkout at `/repo` and runs Vitest with `xvfb-run`.
- The person that starts the tier is the owner of the files that Vitest writes in the checkout.

## The pictures tier

- The tier renders the 34 fixed states of `tools/ci/pictures.txt` in the six rooms with `tools/docker/detsnap.mjs`.
- `detsnap.mjs` hides the HTML elements over the canvas without a change to the layout, under a fake clock that does not move.
- `detsnap.mjs` draws the 2D canvases in software (`--disable-accelerated-2d-canvas`), because text on a GPU canvas is not the same from run to run. The `snap` tier and `tools/detsnap.sh` use the same script, so they also draw in software.
- A state fails if requests or work on the page continue after 60 seconds of load or 20 seconds of frame steps.
- The tier compares each state with `pdiff.mjs --strict --fail-max=0`, so the maximum difference must be 0.
- Without `--against`, the tier compares the commit with the golden pictures of the same commit in the cache, and makes them on the first run.
- With `--against <base>`, the tier compares with the golden pictures of `<base>`. See [the golden cache](ref_ci-jobs.md#golden-pictures).
