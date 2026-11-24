# U0b Stack Spike Notes: Solid 2 + UI SDK + Vite 8 + Vitest 5 + Three.js

**Status:** Verified empirically in `spikes/solid-uisdk/` (Chromium component tests, Vite dev server in headless Chromium, Vite production build, and isolated gzip measurements).

---

## 1. Does `optimizeDeps.exclude: ['@ui-sdk/core']` suffice?

**Answer: Yes.** In both Vite `8.3.8` dev mode and Vitest `5.1.1` browser mode (with `@solidjs/vite-plugin@3.0.1` in plain mode `solid()`), `optimizeDeps.exclude: ['@ui-sdk/core']` is both necessary and sufficient.

### Why & How It Works

1. `@solidjs/vite-plugin@3.0.1` automatically calls `crawlFrameworkPkgs`:
   - Packages with a `"solid"` export condition (`@ui-sdk/solid`) are automatically excluded from `optimizeDeps`.
   - Core Solid runtimes (`solid-js`, `@solidjs/web`, `@solidjs/signals`, `solid-js/attribution`, `@solidjs/web/performance-tracks`, `@solidjs/diagnostics/*`) are automatically included in `optimizeDeps.include` and deduped.
2. `@ui-sdk/core` does **not** declare a `"solid"` export condition or `solid-js` peer dependency. Therefore:
   - When `optimizeDeps.exclude: ['@ui-sdk/core']` is **omitted**, any direct import of `@ui-sdk/core` or `@ui-sdk/core/*` (for example `@ui-sdk/core/testing` in Vitest, or `definePrimitive` / `dialog` in app code) gets pre-bundled into `node_modules/.vite/.../deps/@ui-sdk_core_*.js`, splitting its module instance from `@ui-sdk/solid`'s unbundled import of `@ui-sdk/core/*`.
   - Observed directly in Vitest's `deps/_metadata.json` when `exclude` was omitted:
     ```json
     "@ui-sdk/core/testing": {
       "src": "../../../../.pnpm/@ui-sdk+core@0.1.0-beta.16/node_modules/@ui-sdk/core/dist/testing.js",
       "file": "@ui-sdk_core_testing.js",
       "needsInterop": false
     }
     ```
   - With `optimizeDeps.exclude: ['@ui-sdk/core']` in both `vite.config.ts` and `vitest.config.ts`, **no** `@ui-sdk/core*` entry appears in `deps/_metadata.json`, keeping a single unbundled `@ui-sdk/core` module graph across `@ui-sdk/solid`, app code, and test utilities.

### Verification Commands & Observed Outputs

- **Vite dev server cold-start + headless Chromium interaction** (`vite --port 4173 --strictPort --force`):
  - Server output:
    ```text
    VITE v8.3.8  ready in 1634 ms
      ➜  Local:   http://localhost:4173/
      ➜  Solid diagnostics: http://localhost:4173/__solid/diagnostics ... — auto-enabled; `diagnostics: false` opts out
    ```
  - Playwright Chromium interaction (`initialText: "Selected: atrium"` -> click `Fabrication` -> `"Selected: fabrication"` -> open `Dialog` -> `"Arcadia StationCurrently viewing fabrication.Close"` -> click `Close` -> `dialogVisibleAfterClose: false`) alongside Three.js `640x360` `<canvas>` `requestAnimationFrame` loop:
    - `pageErrors: []`
    - `failedRequests: []`
    - `viteStderr: ""`
    - Console errors: `0` (only SwiftShader WebGL driver `GPU stall due to ReadPixels` performance warnings).

---

## 2. Do a component test in Chromium, `checkPattern`, and `@solidjs/diagnostics` work together?

**Answer: Yes, with three specific caveats around async popup focus (`settle()`), `@ui-sdk/solid` internal memo perf diagnostics (`WASTED_RECOMPUTE`, `toHaveNoWaste()`, and contention-sensitive `HOT_SCOPE_TIME`), and `TMPDIR` space for Playwright Chromium.**

### Commands & Observed Output

Command (`spikes/solid-uisdk/`, ensuring `TMPDIR` has adequate free space):
```sh
./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run
```

Observed output (standalone / serial execution):
```text
 ✓ |chromium| src/App.test.tsx (2 tests) 1760ms
   ✓ U0b stack spike: Solid 2 + UI SDK + Three.js in Chromium (2)
     ✓ runs Solid diagnostics gates cleanly across Listbox and Dialog interactions beside Three.js rAF 959ms
     ✓ passes checkPattern on Listbox and open Dialog alongside Three.js rAF 797ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  01:59:32
   Duration  5.23s (tests 39%, worker 37%, import 23%)
```

### Key Findings

1. **Vitest 5 browser provider & Solid 2 DEV conditions work out of the box:**
   - `@solidjs/vite-plugin@3.0.1` automatically injects `"solid"`, `"development"`, and `"browser"` resolve conditions in `vitest` mode, so `OBSERVE` and `@solidjs/diagnostics` (`captureArtifact`, `expectNoDiagnostics`, `expectNoSilentHolds`, `@solidjs/diagnostics/vitest`) operate inside headless Chromium with zero Node/fs bridging errors.
   - `three@0.181.2` `WebGLRenderer` + `requestAnimationFrame` loop ran concurrently in Chromium (`stage.frames() > 0` verified after two animation frames).
2. **`checkPattern` on `Dialog` requires `userEvent.click` + `flush()` + `await settle()`:**
   - `@ui-sdk/core` `Dialog` moves focus into the dialog asynchronously (microtasks + timer + 2 frames). Using `@testing-library/dom`'s `fireEvent.click` + `flush()` alone failed `checkPattern(view.container, 'dialog')`:
     ```text
     Error: checkPattern found 1 problem with the dialog pattern:
     - div#ui-sdk-cl-6-content[role=dialog]: is open, but focus is on div#ui-sdk-cl-0-option-lounge[role=option]; opening a dialog moves focus into it (APG dialog (modal)).
     ```
   - Using `userEvent.click(...)` from `vitest/browser`, then `flush()` (`solid-js`), then `await settle()` (`@ui-sdk/core/testing`) passed both `checkPattern(listbox, 'listbox')` and `checkPattern(view.container, 'dialog')` with `globalThis.__UI_SDK_STRICT__ = true`.
3. **Diagnostics gates vs `@ui-sdk/solid@0.1.0-beta.16` internal memos & wall-clock contention:**
   - In standalone/serial Vitest Chromium runs (`1` test file / `--no-file-parallelism`), `expectNoDiagnostics(artifact)` (`allow: []`), `expect(artifact).toHaveNoDiagnostics()`, and `expectNoSilentHolds(artifact)` passed with `0` diagnostics on normal render + user interaction (selecting a Listbox item, opening and closing the Dialog).
   - **However, `expectNoDiagnostics(artifact)` with `allow: []` is not unconditionally deterministic under CPU/WebGL contention.** When running two Vitest Chromium test files concurrently alongside SwiftShader WebGL `requestAnimationFrame`, `expectNoDiagnostics(artifact)` (`allow: []`) in `src/App.test.tsx:66` failed with Solid 2.0's wall-clock `HOT_SCOPE_TIME` perf diagnostic inside `@ui-sdk/solid` `Dialog` internals:
     ```text
     [HOT_SCOPE_TIME] memo "trigger state" spent 13.3ms of compute inside one 1000ms window (budget 8ms). Latest cause: "trigger tick" (write), "store.#keys" (write), "store.open" (write)
     loc: @ui-sdk/solid/dist/solid/dialog-parts.jsx:64:9
     ```
     Under the same concurrent load, a second spec also tripped `HOT_SCOPE_TIME` on `memo "trigger attrs"` (`8.3ms` at `dialog-parts.jsx:64:9`) and `<Show>` `memo "value"` (`8.8ms` at `popup.jsx:23:10`).
   - `expect(artifact).toHaveNoWaste()` also **fails** when driving `@ui-sdk/solid` components (`108` unchanged memo recomputes / `3.000ms` across `root state`, `root attrs`, `item state`, `item attrs`, `item-indicator state` inside `@ui-sdk/solid/dist/solid/use-primitive.jsx`).
   - Additionally, `checkPattern` drives 12+ rapid keyboard steps inside `< 1000ms`, which can push `@ui-sdk/solid`'s internal `root state` / `root attrs` / `item state` memos past Solid 2.0's `WASTED_RECOMPUTE` perf diagnostic threshold (`10–12` wasted runs & `>= 2.0ms` in `1000ms` at `use-primitive.jsx:595:5`).
   - **Recommendation for `F2` / `I5` / `U1`–`U8`:** Keep **correctness** diagnostics strictly disallowed and `expectNoSilentHolds(artifact)` strict. For `@solidjs/diagnostics`-gated component tests, either run diagnostics-gated specs serially without concurrent WebGL contention (e.g., `--no-file-parallelism` / `fileParallelism: false` and avoiding live SwiftShader `rAF` loops inside component specs), **or** explicitly allow `@ui-sdk/solid` perf diagnostics (`HOT_SCOPE_TIME` for `@ui-sdk/solid` dialog/popup internals, alongside `WASTED_RECOMPUTE` on rapid `checkPattern` keyboard sweeps) rather than asserting `allow: []` under parallel CI load; scope `toStayWithinRerunBudget` / `toHaveNoWaste` to app-owned signals/components rather than `@ui-sdk/solid` internals.
4. **`TMPDIR` requirement for Playwright Chromium when `/tmp` is tight (`F2` / `I5`):**
   - When `/tmp` tmpfs is nearly full (reproduced at `75–76 MB` free on a `7.7 GB` `/tmp` tmpfs), `vitest run` fails to launch/connect Playwright Chromium (`Error: Failed to connect to the browser session ... [chromium] within the timeout`). Pointing `TMPDIR` to a scratch directory on a filesystem with sufficient free space resolves this cleanly.

---

## 3. What do Solid plus `Listbox` and `Dialog` weigh in gzip?

**Answer:** Together without `three`, Solid `2.0.3` + `@ui-sdk/solid` (`Listbox` + `Dialog`) + `@ui-sdk/core` weigh **`86,817 B` (`86.82 kB`) gzip total** (**`72,956 B` (`72.96 kB`) eager** + **`13,861 B` (`13.86 kB`) lazy**) in-tree (`86,819 B` `zlib` level 9; `243,076 B` raw / `87,138 B` `zlib` level 9 when imported from an out-of-tree entry due to `+656 B` raw wrapper overhead).

All builds used Vite `8.3.8` (`target: 'esnext'`, `@solidjs/vite-plugin@3.0.1`). Gzip sizes below compare raw-stream `gzip -c < <file>` (no filename header) against Node `zlib.gzipSync(..., { level: 9 })` and Vite's decimal (`1 kB = 1000 B`, default zlib) reporter:

| Isolated Build | Raw JS (bytes) | Gzip JS `gzip -c` (bytes) | Gzip JS (`level: 9`) (bytes) | Chunk Breakdown (`gzip -c < file` / `level: 9`) |
|---|---|---|---|---|
| `solid-only` (`solid-js` + `@solidjs/web`) | `28,317` | **`11,527`** (`11.53 kB`) | `11,533` | Single entry chunk: `11,527 B` |
| `solid-listbox` (`Solid` + `Listbox`) | `145,188` | **`52,293`** (`52.29 kB`) | `52,330` | Single entry chunk: `52,293 B` |
| `solid-dialog` (`Solid` + `Dialog`) | `198,209` | **`71,275`** (`71.28 kB`) | `71,309` | Main: `57,415 B` · lazy `sheet-presentation`: `13,405 B` · lazy `announce`: `455 B` |
| **`solid-listbox-dialog`** (`Solid` + `Listbox` + `Dialog`, no `three`) | `242,420` | **`86,817`** (`86.82 kB`) | `86,819` | Main: **`72,956 B`** · lazy `sheet-presentation`: `13,406 B` · lazy `announce`: `455 B` |
| `full-spike-dist` (`Solid` + `Listbox` + `Dialog` + `three@0.181.2`) | `735,235` | **`211,707`** (`211.71 kB`) | `211,733` | Raw-stream `gzip -c`: `197,859 + 13,393 + 455 B` (`211,777 B` with filename header); `level: 9`: `197,898 + 13,382 + 453 B`; Vite decimal reporter: **`214.24 kB`** (`200.28 + 13.51 + 0.45 kB`; `index.html`: `0.39 kB` / `0.27 kB` gzip) |

- Marginal weight added on top of Solid 2 (`11,527 B` gzip) by `@ui-sdk/solid` + `@ui-sdk/core` (`Listbox` + `Dialog`): **`+75,290 B` (`+75.29 kB`) gzip total** (`+61,429 B` eager).
- Dev-only guards (`__UI_SDK_STRICT__`, `#dev`, `#name-check`) were confirmed absent from the production `dist/` JS output.

---

## 4. Which exact versions to pin?

Exact pinned versions installed via `npx --yes pnpm@12.23.0 install` (zero `^` or `~` ranges, matching `pnpm-lock.yaml` `lockfileVersion: '9.0'`):

| Package | Role | Pinned Version | Notes |
|---|---|---|---|
| `solid-js` | Runtime dependency | `2.0.3` | §2.5 |
| `@solidjs/web` | Runtime dependency | `2.0.3` | §2.5 |
| `@ui-sdk/core` | Runtime dependency | `0.1.0-beta.16` | §2.5; exclude in `optimizeDeps` |
| `@ui-sdk/solid` | Runtime dependency | `0.1.0-beta.16` | §2.5 |
| `three` | Runtime dependency | `0.181.2` | §2.5 |
| `vite` | Dev dependency | `8.3.8` | §2.5 |
| `@solidjs/vite-plugin` | Dev dependency | `3.0.1` | §2.5 |
| `vitest` | Dev dependency | `5.1.1` | §2.5 |
| `@vitest/browser` | Dev dependency | `5.1.1` | Required peer for Vitest 5 browser mode |
| `@vitest/browser-playwright` | Dev dependency | `5.1.1` | Required browser provider for Vitest 5 (`playwright()` factory) |
| `playwright` | Dev dependency | `1.65.1` | Matches `@playwright/test@1.65.1` in §2.5 & local `chromium-1255` cache (see §5 for CI Docker `1.64.1` note) |
| `@solidjs/testing-library` | Dev dependency | `1.0.0-rc.2` | §2.5 |
| `@solidjs/diagnostics` | Dev dependency | `2.0.3` | §2.5 |
| `typescript` | Dev dependency | `7.0.2` | §2.5 |
| `@types/three` | Dev dependency | `0.181.0` | Matches `three@0.181.2` |

*(Not needed for U0b, to add in `U1`/`U8`/`F2`: `@solidjs/router: "2.0.1"`, `@solidjs/meta: "2.0.0"`, `@playwright/test: "1.65.1"`.)*

---

## 5. What surprised you?

1. **`pnpm@12.23.0` automatically creates `pnpm-workspace.yaml` with `minimumReleaseAgeExclude`:**
   - Installing exact `@ui-sdk/core@0.1.0-beta.16` and `@ui-sdk/solid@0.1.0-beta.16` printed:
     ```text
     Added 2 entries to minimumReleaseAgeExclude in pnpm-workspace.yaml (set minimumReleaseAgeStrict to true to gate these updates with a prompt):
       @ui-sdk/core@0.1.0-beta.16
       @ui-sdk/solid@0.1.0-beta.16
     ```
   - It also printed `Packages awaiting approval: @solidjs/diagnostics skills, @solidjs/web skills, @ui-sdk/core skills, solid-js skills`. Nothing blocked the install, and no release-age policy was loosened manually, but `F1` must account for `pnpm-workspace.yaml` when committing the root lockfile.
2. **`@ui-sdk/solid` triggers `WASTED_RECOMPUTE`, `toHaveNoWaste()`, and contention-sensitive `HOT_SCOPE_TIME`:**
   - Solid 2.0's `WASTED_RECOMPUTE` perf diagnostic (`>= 10–12` wasted runs & `>= 2ms` within `1000ms`) fires inside `@ui-sdk/solid/dist/solid/use-primitive.jsx:595:5` when `checkPattern` drives 12+ rapid keyboard steps, and `toHaveNoWaste()` fails on `@ui-sdk/solid`'s internal per-item state memos.
   - In addition, `HOT_SCOPE_TIME` (`8ms` wall-clock budget per `1000ms` window) is sensitive to CPU/WebGL contention: running two Vitest Chromium test files concurrently alongside SwiftShader WebGL `requestAnimationFrame` tripped `HOT_SCOPE_TIME` inside `@ui-sdk/solid` `Dialog` memos (`trigger state` `13.3ms` and `trigger attrs` `8.3ms` at `@ui-sdk/solid/dist/solid/dialog-parts.jsx:64:9`; `<Show> value` `8.8ms` at `popup.jsx:23:10`). In `F2`/`I5`/`U1`–`U8`, run diagnostics-gated specs serially without live SwiftShader `rAF` load or allow `HOT_SCOPE_TIME` (and `WASTED_RECOMPUTE` on `checkPattern` sweeps) for `@ui-sdk/solid` internals while keeping correctness diagnostics disallowed.
3. **UI SDK weight relative to Solid 2:**
   - Solid 2 alone is `11.53 kB` gzip, whereas `Listbox` + `Dialog` together bring the JS bundle to `86.82 kB` gzip total (`72.96 kB` eager + `13.86 kB` lazy `sheet-presentation` + `announce`). Worth keeping in mind for `F1`/`O8` JS budgets, and checking whether `@ui-sdk/solid` exports tree-shake unused behaviors in larger combinations (`Toolbar`, `Menu`, `Drawer`).
4. **TypeScript `7.0.2` requires `"skipLibCheck": true`:**
   - Running `tsc --noEmit` without `skipLibCheck` fails with 344 errors inside `node_modules/`, notably:
     - `@solidjs/diagnostics@2.0.3` `dist/vitest.d.ts:16`: `error TS2428: All declarations of 'Matchers' must have identical type parameters` against Vitest `5.1.1` (compiled against Vitest 4 types).
     - `@types/three@0.181.0` pulls `@webgpu/types@0.1.74`, which collides with TypeScript `7.0.2`'s built-in `lib.dom.d.ts` WebGPU declarations (`GPUCommandBufferDescriptor`, `GPUSupportedFeatures`, etc.).
   - With `"skipLibCheck": true`, `tsc --noEmit` passes with `0` errors.
5. **Async popup focus requires `settle()` + real `userEvent.click`:**
   - `flush()` from `solid-js` is synchronous and insufficient for `@ui-sdk/solid/dialog` focus transfer (`initialFocus` lands after timer/animation frames), and `fireEvent.click` does not trigger browser focus/pointer behavior reliably; `userEvent.click` + `flush()` + `await settle()` works cleanly. Also `@ui-sdk/core/testing` does not export `click` (`vitest/browser`'s `userEvent.click` fills that role).
6. **Playwright browser revision alignment (`1.65.1` vs CI Docker `1.64.1`):**
   - `playwright@1.65.1` expects `chromium-1255` (present locally in `~/.cache/ms-playwright/`), whereas the CI Docker image `mcr.microsoft.com/playwright:v1.64.1-noble` ships `chromium-1248` (`playwright@1.64.1`). For `F2`/`I5` inside that container, either match `playwright@1.64.1` or pass `launchOptions: { executablePath }` in `vitest.config.ts`.
7. **`@solidjs/vite-plugin@3.0.1` auto-injects `/__solid/diagnostics` in dev mode:**
   - `vite` dev automatically enables `POST /__solid/diagnostics` (`diagnostics: false` opts out), which is useful for live attribution debugging in `U1`–`U8`.
8. **`/tmp` tmpfs exhaustion causes Vitest Playwright Chromium session timeouts:**
   - Playwright browser profiles write into `TMPDIR` (default `/tmp`). When `/tmp` tmpfs is nearly full (`~75 MB` free), Vitest Chromium fails with `Failed to connect to the browser session ... [chromium] within the timeout`. For `F2`/`I5`, ensure `/tmp` has ample space or redirect `TMPDIR` to a scratch directory on a larger filesystem.
