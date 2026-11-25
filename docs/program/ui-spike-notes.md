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


---

# U0c Picks Primitive Spike Notes: `scene-picks`, D5 Keyboard Model, and `Station` Contract

**Status:** Verified empirically in `spikes/solid-uisdk/` (`@ui-sdk/core@0.1.0-beta.16` `mount()` in Chromium, Solid `2.0.3` + `@ui-sdk/solid@0.1.0-beta.16` + `@ui-sdk/solid/agent` + `three@0.181.2` `rAF` projections, and `@solidjs/diagnostics@2.0.3`).

---

## 1. Does `scene-picks` work as a UI SDK primitive?

**Answer: Yes.** A custom `scene-picks` primitive built with `definePrimitive` (`@ui-sdk/core@0.1.0-beta.16`) composes `createRovingFocus`, `spatialMove({ rect })`, `createChange`, `prepareAnnouncements`/`announce`, `pointer-events: none` DOM proxy `<button>` elements positioned in `onFrame` via element refs, and an `agent` key (`inspect`, `read`) cleanly under both `@ui-sdk/core/testing` `mount()` and `@ui-sdk/solid` + `createAgent()`.

### Verified Behavior & Implementation Details

1. **Roles, slots, and roving focus (`definePrimitive`):**
   - `root`: `role: "group"`, `aria-label` (default `"Room things"`), `bind` calls `prepareAnnouncements(el.ownerDocument)`.
   - `item`: `role: "button"`, `focus: "roving"`, `props: { value: "string", name: "string", verb: "string" }`, `selects: selects({ focused: ({ key }) => [key, null], value: ({ key }) => [key, null] })`, `controlled: ["value"]`.
   - **Important `live` vs `tabindex` finding:** Do **not** place `focused` in `live: ["focused"]` when `attrs` computes `tabindex: roving.tabIndex(state, part)`. In `@ui-sdk/solid`'s `use-primitive.jsx`, `live`-only updates skip `attrsTick`, freezing `tabindex` on `"0"`/`"-1"` in Solid components even while `rovingFocus` moves DOM focus. Omitting `live` while keeping `selects` ensures only the two affected proxy items update `tabindex` cleanly.
   - Each proxy `<button type="button">` carries `tabindex` from `roving.tabIndex(state, part)` (`"0"` on one active focusable item, `"-1"` on the rest and when `state.focused === null && !isRectVisible(key)`), `aria-label={`${name}: ${verb}`}`, and `aria-pressed` reflecting whether that pick is currently inspected (`state.value === key`).
   - Why `role: "group"` + `<button>` over `listbox`/`toolbar`: room things are interactive triggers (inspect / travel / read), not form selection options, and `@ui-sdk/core` `checkPattern` assumes linear DOM-order movement for `listbox`/`toolbar` rather than 2D spatial navigation.

2. **`spatialMove({ rect })` with moving rectangles & `mount()` bypass:**
   - `spatialMove({ rect: (el, key) => ... })` calls `rect(el, key)` on demand on every `keydown`, not once at mount. When Three.js camera sway or mesh motion (e.g., the Navigation route map or Atrium orrery) moves projections across frames, arrow navigation immediately follows the updated live CSS rectangles rather than stale DOM order.
   - `@ui-sdk/core/testing`'s `mount()` overrides `el.getBoundingClientRect()` with synthetic row/column coordinates (`[100, 40]` / `[200, 40]`). Passing `rectOf` via primitive options bypasses that override identically in both `mount()` unit tests and the Three.js `Station` overlay.

3. **`null` / offscreen rect handling (`claims`, `focusable`, `move`, and `reconcileFocus`):**
   - `@ui-sdk/core`'s `spatialMove` does **not** check for `null` rects and will throw if `rect()` returns `null` (when a pick is behind `camera.near`, `< 2px`, or `> 60%` of the viewport per `hud.js:42` `frameOf`).
   - **Mount-time `claims` guard:** `createRovingFocus`'s `claims` runs before `afterBind` `check()`, so `claims` must explicitly verify `isRectVisible(item.key)` (`rectOf(item.key) !== null && (state.value === null || item.key === state.value)`). Otherwise, if `items[0]` starts offscreen (`null`), it grabs initial `tabindex="0"`. Verified empirically in Chromium at `414×896` portrait viewport: `catalogue` (`items[0]`) and `ring-door` fall outside the narrow frustum (`rectOf === null`), and `Tab` lands directly on `THE ORRERY` (`items[1]`).
   - **Dynamic mid-session `null` reconciliation (`reconcileFocus`):** Because `rectOf` is an external per-frame projection rather than a slot prop, `createRovingFocus` does not automatically re-run `roving.check()` when a previously visible focused pick moves behind the camera or shrinks offscreen (`roving.keydown` returns `undefined` when `from` is missing from `focusables()`). Exposing `reconcileFocus()` and calling it in `onFrame` (only when `focused` becomes invalid, `focused === null` while a pick becomes visible, or the active DOM element becomes offscreen) plus on `keydown`/`focus`/`blur` runs `roving.check()`, moves `tabindex="0"` to the next visible pick, and moves DOM focus (`roving.focus(nextKey)`, or `el.blur()` when zero picks are visible) so neither `Arrow*`, `End`, nor `Tab` re-entry gets trapped.

4. **Spatial edge `preventDefault()` (critical for D5):**
   - `@ui-sdk/core`'s `createRovingFocus.keydown` returns `undefined` **without** calling `event.preventDefault()` when `spatialMove` finds no target ahead in that direction (at a spatial edge).
   - Therefore, `scene-picks`'s `item` `on.keydown` handler explicitly calls `event.preventDefault()` **after** `roving.keydown(event, el)` (calling `preventDefault()` beforehand would cause `roving.keydown` to abort!) for all navigation keys (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, `End`, excluding `Alt`/`Ctrl`/`Meta`) **even when at a spatial edge**, ensuring `ArrowLeft`/`ArrowRight` never leak out to `D5`'s global tour stepper while a proxy has focus.

5. **DOM proxies (`pointer-events: none`), `onFrame` refs, and `checkVisibility()`:**
   - Proxy `<button>`s use `position: fixed; left: 0; top: 0; opacity: 0; pointer-events: none;`.
   - Verified in Chromium via `document.elementFromPoint(cx, cy)` at a moving proxy's center: hit testing passes straight through to `<canvas id="scene">`, preserving Three.js raycasting, route-map dragging, and `hud.mjs` assertions (`elementFromPoint?.id === 'scene'`).
   - `ScenePicks` mirrors non-reactive plain JS fields (`currentPicks`, `inspectedPickId`, `pointedPickId`, `activeProxyId`) via `station.subscribe(...)` and positions proxy buttons and `#lock` directly through element refs inside `station.onFrame(...)`, with **zero Solid signal reads inside `onFrame`**.
   - Offscreen (`rectOf(id) === null`) proxies are parked off-viewport (`transform: translate(-9999px, -9999px); width: 1px; height: 1px;`) rather than `display: none` or `aria-hidden="true"`, because `@ui-sdk/core/agent`'s `scan()` uses `el.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true })` and drops components whose parts are hidden.

6. **Selection, second-`Enter` reading, dynamic `canRead`, announcements, and `agent` key (`inspect`, `read`):**
   - `press` (click or `Enter`/`Space`) checks `state.value === key && canReadForPress(item)`: the **first `Enter`** calls `api.inspect(key, event)` -> `createChange("value", key, { reason: "item-press", event })` -> `station.focus(key)` and `announce("${name}: ${verb}")` (`details.source === "keyboard"`); a **second `Enter`** while focus remains on the already-inspected readable proxy invokes `api.read(key)` -> `station.read(key)` and `announce("Reading ${name}")`.
   - `onRead` accepts `boolean | void` alongside a dynamic `canRead?: (pickId) => boolean` option: if `canRead(id)` is `false` or `onRead(id)` returns `false` (even when `item.canRead` is omitted per §4.2 `StationPick`, e.g., Library `CATALOGUE` before choosing a volume), `api.read()` throws `Error(\`"\${item.name}" has nothing to read.\`)` instead of silently announcing `"Reading ..."`.
   - Spatial arrow movement announces `"${name}, ${verb}"` via `announce(..., { priority: "polite" })`.
   - `agent: { actions: ['inspect', 'read'], closed: true, items: (api) => api.items(), shown: (state) => state.items.length > 0 }`:
     - **Important `@ui-sdk/core/agent` alignment finding:** `agent.snapshot()` builds `items[].label` from the rendered button's accessible name (`renderedItems(parts)` -> `"${name}: ${verb}"`), while `agent.act()` resolves string `args[0]` against `agent.items()` when `closed: true`. Returning `{ value: item.id, label: item.verb ? `${item.name}: ${item.verb}` : item.name }` from `api.items()` keeps `snapshot()` labels and `act()` label resolution identical, and works seamlessly with `createAgent({ allow })` gating (`details.source === "agent"`).

7. **Solid 2 & Diagnostics compatibility (`HOT_SCOPE_TIME` avoidance):**
   - Solid 2.0.3 removes `onMount` in favor of `onSettled(() => { ... return cleanup; })`, and `slot<Props, Public>`'s second type parameter is the slot's public state (not root primitive state).
   - **Critical perf finding:** Calling synchronous layout-reading `syncFrame()` inside `onSettled()` (or reading `canvas.clientWidth` inside `rectOf()` every call) can trip `HOT_SCOPE_TIME` (`8ms` budget) in `onSettled` under SwiftShader WebGL load. Deferring initial `syncFrame()` via `requestAnimationFrame` and caching viewport width/height on `resize` keeps `onSettled` lightweight so `expectNoDiagnostics(artifact, { allow: [] })` and `expectNoSilentHolds(artifact)` pass cleanly with `0` diagnostics across `rAF`/frame updates and focus transitions.
   - With `optimizeDeps: { exclude: ['@ui-sdk/core'], include: ['@solidjs/diagnostics'] }` and `"skipLibCheck": true`, `deps/_metadata.json` contained **zero** `@ui-sdk/core*` entries.

---

## 2. Proposed `D5` Keyboard Model

`D5`: *"Escape, Enter and the left and right arrows keep their meaning. Tab reaches the room's things; arrows move among them by position while one has focus; Enter acts."*

| Context | Key | Behavior | Notes |
|---|---|---|---|
| **Reader open or typing** (`station.reader.get().state !== 'closed'` or `focused.get()?.typing` or input/editable) | Any key except `Escape` | Suppressed by `scene-picks` & global `D5` listener (arrows, `Enter`, etc. do not step tour or trigger picks) | Matches `main.js:426` (`if (focus.pick?.typing?.() && e.key !== 'Escape') return`) and `room.js:612` (`reader.state() !== 'closed'`). |
| **Outside `scene-picks`** (body, `#hud`, `#inspectbar`; reader closed and not typing) | `ArrowLeft` / `ArrowRight` | `e.preventDefault(); station.step(-1 | 1)` | Preserves global left-to-right tour (`tourOrder()`) and `rooms.read.mjs` / `tour.mjs`. |
| **Outside `scene-picks`** (reader closed and not typing) | `Enter` | If target is a DOM button/link, native activation runs; else if `focused?.canRead`, calls `station.read()` | Preserves `main.js:428` and `library.mjs:305` (second `Enter` reads selected volume). |
| **Outside `scene-picks`** | `Escape` | Capture `wasReading = station.reader.get().state !== 'closed'` before calling `station.back()`; if `wasReading`, restore DOM focus to inspect bar / CTA / `#back` | Replaces non-existent `was.reads` with `station.reader.get().state !== 'closed'` (`main.js:299-302`). |
| **Page -> `scene-picks`** | `Tab` / `Shift+Tab` | Enters `scene-picks` at its single roving stop (`tabindex="0"`: last focused visible pick, else inspected visible pick, else first focusable pick). Next `Tab` exits to next page region | One tab stop for the entire room (`rovingFocus`); skips `rectOf === null` items at mount and mid-session. |
| **Inside `scene-picks`** (proxy `<button>` has focus; reader closed and not typing) | `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` | `spatialMove({ rect })` moves focus to nearest focusable (`rectOf(id) !== null`) pick in that screen direction and announces `"${name}, ${verb}"`. Calls `e.preventDefault()` **even at spatial edges** | Global `D5` `ArrowLeft`/`ArrowRight` tour stepper ignores events inside `[data-slot="scene-picks"]` or `defaultPrevented`. |
| **Inside `scene-picks`** | `Home` / `End` | Moves focus to first / last focusable pick proxy (`e.preventDefault()`) | Standard roving focus endpoints. |
| **Inside `scene-picks`** | `Enter` / `Space` | Fires `press` -> `station.focus(pick.id)` on first `Enter`, or `station.read(pick.id)` on second `Enter` while focus remains on the proxy when `focused.pick === pick.id && focused.canRead`; single-stop doors schedule `1500ms` travel | Matches pointer click behavior (`U4`: *"Enter does what a click does"*). |
| **Inside `scene-picks`** | `Escape` | If `station.focused.get()` is non-null or `station.reader.get().state !== 'closed'`, calls `station.back()` (exiting reading/inspection to wide view); if already in wide view (`!focused`), blurs the proxy (`activeEl.blur()`, clearing `activeProxyId` and hiding `#lock`) | Preserves `Escape` meaning everywhere in the station without trapping `#lock` in wide view. |

### `#lock`, `#cue`, and `hud.mjs` Compatibility

- **Lock (`#lock`) visibility:** Driven in `onFrame` from `targetId = activeProxyId ?? pointedPickId`. Shows at `rectOf(targetId)` **only when `targetId !== focused?.pick`** (once `Enter` or click inspects a pick, `#lock` drops for that pick, preserving `hud.mjs:344` while showing `#lock` on the keyboard-focused proxy prior to `Enter`).
- **Cue (`#cue`) exclusion:** `#cue` renders only when `wideAtRest` is true **and** `#lock` is inactive (`!(activeProxyId ?? pointedPickId)`), dropping immediately whenever `#lock` is active (`hud.js:154`).
- **Pointer passthrough & `mousedown`:** Proxies and `#lock` keep `pointer-events: none` (`document.elementFromPoint(x, y)` returns `canvas#scene`, preserving `hud.mjs:112,319`); `pointerdown` clears `pointed` (`hud.mjs:334`). Only `#cue .lock-tag` keeps `pointer-events: auto` (`cue.mjs:61-67`).
- **`display.state()`:** `window.__lobby.display.state()` continues returning `{ lock, named, hint, gliding, cue }` with `rect` rounded to `0.1` CSS px (`[left, top, width, height]`).

---

## 3. Exact `Station` Boundary Specification (`F3`, `U4`, `U9`)

In addition to the §4.2 sketch (`start`, `dispose`, `enter`, `room`, `focus`, `back`, `step`, `focused`, `choose`, `travel`, `read`, `picks`, `pointed`, `rectOf`, `reader`, `readAt`, `closeReader`, `frameOf('reader')`, `contact`, `contactLinkRect`, `setCovered`, `view`, `setView`, `turn`, `onFrame`, `debug`), `U0c` pins down the following concrete contract requirements and additions:

1. **Live non-`reads` `picks` filtering:**
   - `picks: Readable<StationPick[]>` (`{ id: PickId; name: string; verb: string; kind: PickKind; canRead?: boolean; cue?: { pointer: string; touch: string } }[]`) **excludes** the synthetic unnamed `reads` pick (`aside: true, name: ''`) and emits only currently live picks (updating reactively whenever a pick's `live()` changes, e.g., terminal/books/Contact). Every item in `picks` has a non-empty uppercase `name` and `verb` (`hud.mjs:375-381`).
2. **Pinned `Rect` shape & `rectOf(pick)` semantics:**
   - Pin `Rect` explicitly across `F3`, `U4`, and `U6` to the 8-field `SpatialRect`-compatible interface:
     ```ts
     export interface Rect {
       left: number;
       top: number;
       right: number;
       bottom: number;
       x: number;
       y: number;
       width: number;
       height: number;
     }
     ```
     Shared directly by `rectOf(pick)`, `contactLinkRect(index)`, and `setCovered('bar', rect)` (converting to `[x, y, width, height]` only at the `display.state()` boundary).
   - `rectOf(pick)` computes CSS viewport pixels with `PAD = 6`, `EDGE = 8`, `MOST = 0.6` (matching `hud.js:42` `frameOf`) using cached viewport dimensions (updated on resize, never reading `canvas.clientWidth` per call), returning `null` when any outline corner is behind `camera.near` (`_v.z > -camera.near`), clamped width/height `< 2px`, or area `> 60%` of viewport (`MOST * W * H`). Safe to call inside `onFrame` after `camera.updateMatrixWorld()`.
3. **`gliding`, `wideAtRest`, `turn` hint readiness, and `typing` / `reader` state:**
   - Add `gliding: Readable<boolean>` (`focus.f < 1`, needed for `display.state().gliding` in `hud.mjs:89` without polling).
   - Add `wideAtRest: Readable<boolean>` (`!busy && !focus.pick && focus.f >= 1 && view === 0 && since > LIFT`, gating `#cue` visibility for `U4` alongside `#lock` inactivity per `hud.js:154`).
   - Expose turn-by-hand completion (either via `turn.byHand()` or `hintTurnDone: Readable<boolean>`) so `U2`/`U4` clear Navigation's `"until": "turn"` hint without reading Solid signals in `onFrame`.
   - Expose `focused.typing?: boolean` (for Contact/writer input gating) and `reader: Readable<{ state: ReaderState }>` (`station.reader.get().state !== 'closed'` replaces `was.reads` for both `D5` `typing()` suppression and post-`Escape` focus restoration).
4. **Single-stop door `1500ms` delayed `travel`:**
   - Calling `station.focus(doorPick)` for a single-stop door (`!door.stops && door.to`) internally schedules `travel(door.to, 1500)` and cancels that pending timer on `back()`, `focus(other)`, or `dispose()` (matching `main.js:202,218,422`), so pointer clicks, keyboard `Enter`, and `U9` `agent.act` `inspect` behave identically.
5. **`read(pick?)` return & dynamic `canRead` semantics:**
   - Extend `read(pick?: PickId): boolean` so calling `station.read()` reads the currently focused pick (`focused.get()?.canRead`), while `station.read(pickId)` focuses `pickId` first (if not already focused) and opens its reading if readable—returning `true` when reading started and `false` when nothing is readable (so `scene-picks` `api.read()` throws a descriptive `Error` instead of falsely announcing).
6. **`StationDebug` / `display.state()` ownership:**
   - `Station.debug` delegates `display.state()` to `U4`'s plain-JS frame mirror (`{ lock, named, hint, gliding, cue }` with `0.1`-rounded `[l, t, w, h]` rects) so existing e2e assertions work without reading Solid signals in `onFrame`.

---

## 4. Verification Commands & Verbatim Output

Run in `spikes/solid-uisdk/` with `TMPDIR` on a non-`/tmp` filesystem:

```sh
./node_modules/.bin/tsc --noEmit && CI=1 ./node_modules/.bin/vitest run --reporter=verbose
```

Observed output:

```text
TSC_EXIT=0

 RUN  v5.1.1 /home/ubuntu/.gemini/antigravity-cli/scratch/wt-U0c-picks-spike/spikes/solid-uisdk

 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > tracks moving Three.js rAF projections via onFrame refs, preserves pointer-events: none hit-test, and implements D5 keyboard model 689ms
 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > calls station.read() on second Enter inside scene-picks and suppresses Arrow/Enter while reader is open 314ms
 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > reconciles focus and #lock in onFrame when the active proxy moves behind the camera mid-session 232ms
 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > skips offscreen items[0] at 414x896 portrait viewport so initial Tab lands on THE ORRERY 184ms
 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > exposes scene-picks to @ui-sdk/solid/agent (snapshot, act inspect/read, and allow refusal) 216ms
 ✓  chromium  src/ScenePicks.test.tsx > ScenePicks Solid 2 + Three.js + @ui-sdk/solid/agent in Chromium > passes @solidjs/diagnostics expectNoDiagnostics and expectNoSilentHolds across frame updates and focus transitions 268ms
 ✓  chromium  src/scene-picks.test.ts > scene-picks primitive via @ui-sdk/core/testing mount() > supports Tab roving focus, spatialMove with moving rects across frames, null skipping, edge preventDefault, selection, announcements, and agent actions 430ms
 ✓  chromium  src/scene-picks.test.ts > scene-picks primitive via @ui-sdk/core/testing mount() > skips an initially-offscreen items[0] (rectOf === null) at mount so Tab lands on items[1] 27ms
 ✓  chromium  src/scene-picks.test.ts > scene-picks primitive via @ui-sdk/core/testing mount() > recovers rovingFocus, Arrow*, End, and Tab re-entry when the active focused pick becomes null mid-session 167ms
 ✓  chromium  src/scene-picks.test.ts > scene-picks primitive via @ui-sdk/core/testing mount() > rejects api.read() when onRead returns false or dynamic canRead returns false (even if item.canRead is omitted) 6ms

 Test Files  2 passed (2)
      Tests  10 passed (10)
   Start at  16:15:27
   Duration  5.24s (tests 54%, worker 29%, import 16%)
```

Verified `spikes/solid-uisdk/node_modules/.vite/.../deps/_metadata.json` contains zero `@ui-sdk/core*` entries (`grep -n '@ui-sdk/core'` exited `1`).
