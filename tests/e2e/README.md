# End-to-End Tests (`tests/e2e/`)

Playwright Test harness (`@playwright/test@1.65.1`) replacing the standalone scripts in `tools/docker/` piece by piece.
Legacy scripts in `tools/docker/*.mjs` and `tools/check.sh` remain intact until their owning UI tasks (`U2`–`U8`) replace them.

## Structure

- `tests/e2e/playwright.config.ts` — Playwright projects:
  - `desktop` (`1280x720`, Chromium with `--use-angle=gl-egl --enable-gpu --ignore-gpu-blocklist`)
  - `phone` (`390x844`, `hasTouch: true`, `isMobile: true`, Chromium with GPU flags)
  - `reduced` (`1280x720`, `reducedMotion: 'reduce'`, Chromium with GPU flags)
  - `smoke-firefox` (`960x540`, Firefox; runs `view.spec.ts`)
  - `smoke-webkit` (`960x540`, WebKit; runs `view.spec.ts`)
- `tests/e2e/serve.mjs` — static HTTP server serving `SITE_DIR` (`public/` by default) on `127.0.0.1:${PORT:-8080}` with `/assets/*` fallback (`ASSETS`, `<site_dir>/assets`, or main checkout via `git rev-parse --git-common-dir`).
- `tests/e2e/run.mjs` — runs non-`@timing` specs in parallel (`--grep-invert @timing`) followed by `@timing` specs serially (`--grep @timing --workers=1`).
- `tests/e2e/fixtures/site.ts` — served site data loaders (`/portfolio/index.json`, `/profile.json`, `/content.json`, `/blog/index.json`), profile fixture, error collector, and `addInitScript` helpers (`canvasSpyInitScript`, `waysRecorderInitScript`, `frameGateInitScript`).
- `tests/e2e/pages/station.ts` — `StationPage` and `ReaderPage` wrappers around `window.__lobby` hooks, raycasting, settled glyph boxes, frame checks, frame gate, and pen pointer helpers.
- `tests/e2e/helpers/plaincheck.ts` — DOM/accessibility/contrast/overflow checks for no-JS and no-WebGL pages.
- `tests/e2e/specs/` — ported Playwright specs.

## Script & Check Mapping (`tools/check.sh` -> `tests/e2e/`)

Every step in `tools/check.sh` (plus `view.mjs` and helper scripts listed on card `T1`) is accounted for below:

| `tools/check.sh` step / script | Scope | Target spec / tier | Owner | Status |
|---|---|---|---|---|
| `python3 tools/content.py` | Content schema & link validation | `tools/ci/run.sh static` | Infra | Stays in `static` |
| `python3 -m unittest tools/test_*.py` | 5 Python unit suites (141 tests) | `tools/ci/run.sh static` | Infra | Stays in `static` |
| `python3 tools/site.py` | Static HTML/JSON/feed generation | `static` & pre-step for `e2e` | Infra | Stays in `static` / setup |
| `page.mjs /blog/<slug>/` | Posts without JS (DOM, images, links) | `tests/e2e/specs/page.spec.ts` | `T1` | Ported |
| `page.mjs /about/ /portfolio/ /experience/ /contact/` | Room pages without JS | `tests/e2e/specs/page.spec.ts` | `T1` | Ported |
| `page.mjs /portfolio/<slug>/` | Projects without JS | `tests/e2e/specs/page.spec.ts` | `T1` | Ported |
| `plaincheck-selftest.mjs` | 9 synthetic plaincheck failure cases | `tests/e2e/specs/plaincheck.spec.ts` | `T1` | Ported |
| `plainpage.mjs` | No-JS (`desktop`/`phone`), no-WebGL, 404s | `tests/e2e/specs/plainpage.spec.ts` | `T1` | Ported |
| `opening.mjs all` | Ways of opening (`scan`, `receive`, `unfold`) | `tests/e2e/specs/opening.spec.ts` (`@timing`) | `T1` | Ported |
| `turn.mjs all` | Navigation route map turning & hint | `tests/e2e/specs/turn.spec.ts` (`@timing`) | `T1` | Ported |
| `endpoints.mjs` | Feeds, sitemap, llms.txt, résumé PDF, JSON contracts | `tests/e2e/specs/endpoints.spec.ts` | `T1` | Ported |
| `errs.mjs` (6 routes) | Console/page/request/HTTP errors & room load | `tests/e2e/specs/errs.spec.ts` | `T1` | Ported |
| `view.mjs` *(Card `T1`)* | Multi-engine WebGL smoke (`chromium`, `firefox`, `webkit`) | `tests/e2e/specs/view.spec.ts` | `T1` | Ported |
| `rooms.text.mjs all` | `.sub` rules, non-interactive wall screens | `tests/e2e/specs/` (`hud`/text) | `U2` | Legacy in `tools/docker/` |
| `rooms.others.mjs` | Navigation stations & Lounge wall/hero words | `tests/e2e/specs/` (`hud` / `reader`) | `U2` (`U5` reader) | Legacy in `tools/docker/` |
| `hostile.mjs` | XSS, 404/empty JSON, thin data resilience | `tests/e2e/specs/` (`hud`/data) | `U2` | Legacy in `tools/docker/` |
| `hud.mjs all` | Display words (`U2`), lock & stillness (`U4`) | `tests/e2e/specs/` (`hud`, `picks`) | `U2`, `U4` | Legacy in `tools/docker/` |
| `library.mjs all` | Library list & READ (`U3`), reader (`U5`) | `tests/e2e/specs/` (`bar`, `reader`) | `U3`, `U5` | Legacy in `tools/docker/` |
| `rooms.read.mjs all` | Bar (`U3`), reader (`U5`), room routes (`U8`) | `tests/e2e/specs/` (`bar`, `reader`, router) | `U3`, `U5`, `U8` | Legacy in `tools/docker/` |
| `ringline.mjs`, `door.mjs`, `tour.mjs` *(Card `T1`)* | Tour, doors, ringline bar helpers | `tests/e2e/specs/` (`bar`) | `U3` | Legacy in `tools/docker/` |
| `cue.mjs all` | Library `#cue` & drone errand timing | `tests/e2e/specs/` (`picks`) | `U4` | Legacy in `tools/docker/` |
| `rooms.cross.mjs` | Cross-room links inside `#reader` | `tests/e2e/specs/` (`reader`) | `U5` | Legacy in `tools/docker/` |
| `rooms.deeplink.mjs` | Project & timeline entry deeplinks | `tests/e2e/specs/` (`reader`, `offer`) | `U5`, `U7` | Legacy in `tools/docker/` |
| `contact.mjs all` | Contact links (`U6a`) & page-layer targets (`U6`) | `tests/e2e/specs/` (`contact`) | `U6` (`U6a` first) | Legacy in `tools/docker/` |
| `deeplink.mjs` (`desktop`, `phone`) | Article reading mode -> `#stepin` offer | `tests/e2e/specs/` (`offer`) | `U7` | Legacy in `tools/docker/` |
| `writing-alias.mjs` | `/?room=writing`, `/blog/`, Back/Forward | `tests/e2e/specs/` (router) | `U8` | Legacy in `tools/docker/` |
| `history.mjs` | History entries, Back/Forward, `#fragment`, cancel | `tests/e2e/specs/` (router) | `U8` | Legacy in `tools/docker/` |

Legacy shared modules (`rooms.kit.mjs`, `r2.kit.mjs`, `serve.mjs`) are replaced for ported specs by `tests/e2e/fixtures/site.ts`, `tests/e2e/pages/station.ts`, and `tests/e2e/serve.mjs`, and remain in `tools/docker/` until `U8` removes `tools/check.sh`.

## Running Locally

1. Generate static pages first:
   ```sh
   python3 tools/site.py
   ```
2. Install dependencies (using `pnpm@12.23.0`):
   ```sh
   pnpm install --frozen-lockfile
   ```
3. Run the full suite (non-`@timing` parallel pass + `@timing` 1-worker serial pass):
   ```sh
   pnpm test:e2e
   ```
   Or invoke Playwright directly:
   ```sh
   pnpm exec playwright test -c tests/e2e/playwright.config.ts --grep-invert @timing
   pnpm exec playwright test -c tests/e2e/playwright.config.ts --grep @timing --workers=1
   ```

### Notes for Local & Worktree Runs

- **`TMPDIR` on tight `/tmp` filesystems:** Chromium profiles and Playwright artifacts write to `TMPDIR` (default `/tmp`). If `/tmp` is a small `tmpfs`, export a `TMPDIR` on a filesystem with ample free space (not under `/tmp`) before running Playwright locally.
- **Worktrees (`ASSETS`):** `tests/e2e/serve.mjs` automatically falls back to the main checkout's `public/assets` via `git rev-parse --git-common-dir`, or you can explicitly set `ASSETS=/path/to/public/assets`.
- **Existing server:** Set `ORIGIN=http://127.0.0.1:8080` to skip launching `webServer` and test against an already-running server.
- **Firefox / WebKit locally:** `smoke-firefox` and `smoke-webkit` require Playwright's Firefox and WebKit browsers (`pnpm exec playwright install firefox webkit`) or running via the CI Docker image (`mcr.microsoft.com/playwright:v1.65.1-noble`). `smoke-firefox` runs non-headless when `DISPLAY` is set (`xvfb-run` in CI Docker) so Linux Firefox can initialize WebGL2. Without a GPU, Firefox draws a frame every few seconds at full size (the intro advances per frame), so the Firefox smoke loads `/?tier=1&scale=0.5` (about 1 minute instead of 10); WebKit and Chromium load `/`.
- **Read-only `/repo` mounts (CI Docker):** Override output paths via `PLAYWRIGHT_OUTPUT_DIR` and `PLAYWRIGHT_HTML_REPORT`.

## Running on the CI Host

```sh
git push ci HEAD:<branch>
ssh arcadia-ci '/srv/arcadia/bin/ci <branch> e2e'
```
