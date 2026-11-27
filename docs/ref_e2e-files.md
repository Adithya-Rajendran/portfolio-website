---
type: reference
title: The Playwright tests
depends: [docs/ref_e2e-map.md]
---
# The Playwright tests

This reference gives the files of the Playwright tests in `tests/e2e/`, which use `@playwright/test` 1.65.1.

[The test map](ref_e2e-map.md) gives the scripts of `tools/check.sh` that these tests replace.

## Projects

| Project | Viewport | Browser | Tests |
|---|---|---|---|
| `desktop` | 1280 × 720 | Chromium with `--use-angle=gl-egl --enable-gpu --ignore-gpu-blocklist` | All specs |
| `phone` | 390 × 844, with `hasTouch: true` and `isMobile: true` | Chromium with the GPU flags | All specs |
| `reduced` | 1280 × 720, with `reducedMotion: 'reduce'` | Chromium with the GPU flags | All specs |
| `smoke-firefox` | 960 × 540 | Firefox | `view.spec.ts` |
| `smoke-webkit` | 960 × 540 | WebKit | `view.spec.ts` |

## Files

| File | Contents |
|---|---|
| `tests/e2e/playwright.config.ts` | The projects. |
| `tests/e2e/serve.mjs` | A static HTTP server for `SITE_DIR` (by default `public/`) on the loopback address, port `${PORT:-8080}`. For `/assets/*`, it uses `ASSETS`, then `<site_dir>/assets`, then the main checkout from `git rev-parse --git-common-dir`. |
| `tests/e2e/run.mjs` | Runs the specs without `@timing` in parallel (`--grep-invert @timing`), then the `@timing` specs one at a time (`--grep @timing --workers=1`). |
| `tests/e2e/fixtures/site.ts` | The loaders of the data of the site (`/portfolio/index.json`, `/profile.json`, `/content.json`, `/blog/index.json`), the profile fixture, the error collector, and the `addInitScript` helpers `canvasSpyInitScript`, `waysRecorderInitScript` and `frameGateInitScript`. |
| `tests/e2e/pages/station.ts` | `StationPage` and `ReaderPage`, around the `window.__lobby` hooks, with raycasts, the boxes of the glyph after it settles, frame checks, the frame gate and pen pointer helpers. |
| `tests/e2e/helpers/plaincheck.ts` | The checks of the DOM, of accessibility, of contrast and of overflow for the pages without JavaScript or WebGL. |
| `tests/e2e/specs/` | The specs. |

## Environment variables

| Variable | Use |
|---|---|
| `TMPDIR` | Chromium profiles and Playwright artifacts go to `TMPDIR`, by default `/tmp`. If `/tmp` is a small `tmpfs`, set `TMPDIR` to a file system with more free bytes, not under `/tmp`. |
| `ASSETS` | The packed rooms. `tests/e2e/serve.mjs` uses the `public/assets` of the main checkout without it. |
| `ORIGIN` | A server that runs. With `ORIGIN=http://<host>:<port>`, Playwright does not start its `webServer`. |
| `PORT` | The port of `tests/e2e/serve.mjs`. The default is 8080. |
| `DISPLAY` | With `DISPLAY`, `smoke-firefox` runs with a window (`xvfb-run` in the Docker image of CI), so Firefox on Linux can start WebGL2. |
| `PLAYWRIGHT_OUTPUT_DIR`, `PLAYWRIGHT_HTML_REPORT` | The output paths, for a `/repo` mount that does not permit writes in the Docker image of CI. |

- `smoke-firefox` and `smoke-webkit` use the Firefox and WebKit browsers of Playwright (`pnpm exec playwright install firefox webkit`), or the Docker image `mcr.microsoft.com/playwright:v1.65.1-noble`.
- Without a GPU, Firefox draws one frame in some seconds at full size, and the intro moves one step for each frame. For this reason, the Firefox smoke test loads `/?tier=1&scale=0.5`, which runs for approximately 1 minute in place of 10. WebKit and Chromium load `/`.
