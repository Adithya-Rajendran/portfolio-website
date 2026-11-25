# Arcadia Station Page Layer Specification (`U0`)

**Status:** Draft for Gate `G3` (`U0`) against `origin/prog/ws-ui` (`f4bc684d`, including `U0c` and `U6a`).  
**Owner:** Workstream `ws-ui` (`U0`–`U10`).  
**Canonical sources:** `docs/program-plan.md` (§3, §4.1–§4.3, §5.6, §8, §9), `docs/v1-contracts.md` (§1, §3–§5, §7–§8), `docs/program/decisions.md`, `docs/program/ui-spike-notes.md`, `public/index.html`, `public/style.css`, `public/post.css`, `public/main.js`, `public/js/{hud,reader,comms,site}.js`, `public/content.json`, `tools/site.py`, and the browser verification suite (`tools/docker/*.mjs`).

---

## 1. Purpose and Scope

This document defines the complete normative specification for migrating the Arcadia Station page layer (`src/app/**`, `src/styles/**`) to Solid `2.0.3`, `@solidjs/router` `2.0.1`, and `@ui-sdk/solid` / `@ui-sdk/core` `0.1.0-beta.16` across tasks `U1`–`U10`, while preserving:

- The imperative Three.js `0.181.2` engine (`src/engine/`) behind the typed `Station` boundary (`F3`).
- Static pre-rendered readable pages written by `tools/site.py` (`D3`) and plain-CSS styling with the site's existing custom properties (`D6`).
- All visual, accessibility, stillness, keyboard (`D5`), Contact (`D4`, `U6a`), and E2E test contracts verified by `docs/v1-contracts.md` and `tools/docker/*.mjs` / `tests/e2e/`.

### In Scope (`src/app/**`, `src/styles/**`)
- All eight page-layer regions of `docs/program-plan.md` §4.3 (`hud`, `bar`, `picks`, `reader`, `contact`, `cover`/`offer`/failures, `addresses`) plus the gated agent bridge (`U9`).
- `Station` boundary additions and Solid 2 / UI SDK integration constraints (`F3`, `U0b`, `U0c`).
- WCAG 2.2 Level AA requirements, measured contrast thresholds, phone layouts, and preserved test hooks.

### Out of Scope (Stays in Engine `src/engine/` or Static Generator `tools/`)
- Wall screens (`screens.ts`), the Atrium hologram (`hologram.ts`), Navigation route-map sheets (`routemap.ts`), the Contact 3D field canvas/drone/halo (`comms3d.ts`), and the 3D `ReadGlyph`, `ReadFrame`, `ReadBeam`, `ScanSheet`, `ScanFan`, `ScanBody`, `ReadFlow`, and `ReadPrint` meshes (`reader3d.ts`, `opening/*`).
- `tools/site.py` HTML generation, except updating `RUNTIME_IDS` in `U10` (and `U6a`'s already-landed `/contact/` update).

---

## 2. Page Modes and Document Shell (`U7`, `U8`)

The class on `<html>` (`document.documentElement.className`) selects one of three mutually exclusive page modes from first paint.

### 2.1 Pre-Paint Mode Script (`index.html` `<head>`)

An inline synchronous `<script>` in `<head>` (before stylesheets/body paint) sets the initial mode:

```html
<script>document.documentElement.className = /^\/(blog|portfolio)\/[^/]+\/?$/.test(location.pathname) ? 'reading' : 'station';</script>
```

- Must stay synchronous in `<head>` in the Vite `index.html` shell so `tools/site.py --shell` embeds it into every generated page (`D2`, `D3`, `U7`).
- Article deep-links (`/blog/<slug>/` and `/portfolio/<slug>/`) start in `'reading'`.
- All room URLs (`/`, `/about/`, `/portfolio/`, `/experience/`, `/blog/`, `/contact/`, `/?room=<id>`) start in `'station'`.

### 2.2 Mode Matrix

| Mode | `<html>` class | When Active | Visible Elements | Hidden / Inert Elements |
|---|---|---|---|---|
| **Mode 1: Station** | `station` | Room URLs from first paint; article URLs after `stepIn()` | `<canvas id="scene">`, `#loader` (until `.done`), `#hud` (once loaded), `#lock`, `#cue`, `#inspectbar` (when focused), `#reader` (when reading), `#comms` (over 3D field) | `#page` (`display: none`), `#pagenav` (`display: none`), `#stepin` (`display: none`) |
| **Mode 2: Reading (Deep-Link)** | `reading` | `/blog/<slug>/` and `/portfolio/<slug>/` on initial load while room loads or waiting on offer | `<nav id="pagenav">`, `<main id="page">`, compact bottom-right `#loader` pill (`z-index: 6`), or `#stepin` offer (`z-index: 6`) | `#scene`, `#hud`, `#inspectbar` (`visibility: hidden; pointer-events: none`), `#loader .mark` & `#loader .bar` (`display: none`), `<noscript>` |
| **Mode 3: Plain / Fallback** | `""` (none) | JavaScript disabled, WebGL2 startup failure, fatal room load error when `#page` exists, or `!station.reads(url)` | `<nav id="pagenav">`, `<main id="page">` (scrollable document), `<noscript>` (ONLY when `#page` is absent, i.e., `/` with JS off) | `#loader` (`display: none`), `#scene`, `#hud`, `#inspectbar` (`visibility: hidden; pointer-events: none`), `#stepin` |

### 2.3 `<noscript>` and `#pagenav` Rules

- **`<noscript>` visibility:** Hidden whenever `<main id="page">` is a direct child of `<body>` (`body:has(> #page) > noscript { display: none; }`). Shown fixed at bottom (`position: fixed; left: 0; right: 0; bottom: 0; color: #a9c0cd; background: #04060a`) on bare `/` shell when JS is disabled, offering direct links to `/about/`, `/portfolio/`, `/experience/`, `/blog/`, `/contact/`.
- **`#pagenav`:** `<nav id="pagenav" aria-label="Site">` containing links in order: `ARK AURORA` (`/`), `ABOUT` (`/about/`), `PROJECTS` (`/portfolio/`), `EXPERIENCE` (`/experience/`), `WRITING` (`/blog/`), `CONTACT` (`/contact/`). Visible in Modes 2 and 3; `display: none` in Mode 1 (`html.station`).
- **`#page`:** `<main id="page">` (`max-width: 760px`, centered, scrollable via `html:not(.station) { height: auto; overflow: auto; }`, `body { height: auto; overflow: visible; }`). Must never have `overflow-y: hidden` or be occluded by `#pagenav`, `#loader`, or `#stepin` (`plaincheck.mjs`).

### 2.4 `Save-Data`, Scrolled Offer, and `stepIn()` (`U7`)

When starting in Mode 2 (`html.reading`):

1. **Interaction tracking:** Register `{ once: true, passive: true }` listeners on `scroll`, `keydown`, `pointerdown`, and `wheel` to mark `touched = true`.
2. **Data-saver gate (`navigator.connection?.saveData === true`):**
   - Pause **before** calling `station.enter(roomId)` so room geometry/textures are not fetched until the visitor explicitly accepts.
   - Render `#stepin` (`<button id="stepin" type="button">`) with `<small>{offerText}</small>{enterText}` where `{place}` in `content.reader.offer` (`"THIS CAN BE READ IN {place}"`) is replaced with `content.rooms[id].place` (e.g., `"THE LIBRARY"`, `"THE FABRICATION BAY"`), and `{enterText}` is `content.reader.enter` (`"READ IT THERE  →"`).
3. **Standard load (`!saveData`):**
   - Fetch and enter the target room via `station.enter(roomId)`.
   - After ready:
     - If `!station.reads(url)` (e.g., a post not shelved in the Library): switch `html.className = ''` (Mode 3 plain page) and do not show `#stepin`.
     - Else if `!touched && window.scrollY < 80`: automatically invoke `stepIn()`.
     - Else: render `#stepin` with `<small>{readyText}</small>{enterText}` (`content.reader.ready`, `"{place} IS READY"`).
4. **`stepIn()` transition:**
   - Capture the last `#page .post-body h2[id]` whose `getBoundingClientRect().top < innerHeight * 0.4`.
   - Switch `document.documentElement.className = 'station'`, `window.scrollTo(0, 0)`, reset view to wide (`station.setView('wide')` / hero), and invoke `station.readAt(url, { fly: false })` (scrolling `#reader` to the captured heading `id` when present).
   - Remove/hide `#stepin`.

---

## 3. Styling Architecture (`D6` + `R1`, `U1`–`U10`)

Per owner/program decision `D6` and requirement `R1`:

- **Plain CSS only:** No Tailwind CSS, no CSS-in-JS runtime, and **no** `@ui-sdk/solid` `web.css`.
- **UI SDK isolation (`src/app/ui/`):** `@ui-sdk/solid` is imported **exclusively** inside `src/app/ui/` (one wrapper file per UI SDK primitive/component: `SegmentedControl`, `Button`, `Toolbar`, `Menu`, `Listbox`, `Drawer`, `ScrollArea`, `Progress`, `Toast`). Each wrapper passes unstyled UI SDK primitives and attaches our plain CSS classes.
- **Stylesheet layout:**
  - `src/styles/tokens.css`: All custom properties, reset, base `html`/`body`/`#scene` rules, and `prefers-reduced-motion` helpers.
  - `src/styles/post.css`: Preserved `.post`, `.post-list`, `.post-facts`, `.post-links`, `.entry`, `#page`, `#pagenav`, `#stepin`, and `#reader` layout styles (shared identically across Mode 2/3 plain pages and Mode 1 `#reader`).
  - Per-component / per-region stylesheets (finalized in `U10`): `hud.css`, `inspectbar.css`, `picks.css`, `reader.css`, `cover.css`, `bright.css`.

### 3.1 `src/styles/tokens.css` Custom Properties

| Token | Value | Origin | Usage |
|---|---|---|---|
| `--cy` | `#7fe3ff` | `style.css:1` | Primary cyan accent, borders, active links, progress fill, lock/cue corners |
| `--am` | `#ff9a4a` | `style.css:1` | Warm amber accent, kickers, CTAs, action verbs, `#ways` doors, active rail border |
| `--fg` | `#e9f4fa` | `style.css:1` | Primary HUD foreground text |
| `--soft` | `#a9c0cd` | `style.css:1` | Secondary HUD text, metadata, descriptions, footer values |
| `--edge` | `clamp(16px, 3vw, 40px)` | `style.css:1` | Viewport outer safe padding for `#hud` and `#inspectbar` |
| `--ink` | `#dcecf5` | `post.css:4` | Article body text color |
| `--rule` | `rgba(127,227,255,.22)` | `post.css:4` | Hairline borders in `.post`, `#reader`, `#loader` pill |
| `--text` | `"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif` | `post.css:4` | Prose, lists, volume titles, UI copy |
| `--mono` | `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace` | `post.css:5` | Inline code and `<pre><code>` blocks |
| `--bg` | `#04060a` | `style.css:3,10` | Page & cover background |
| `--display` | `"Eurostile", "Michroma", "Orbitron", "Segoe UI", "Helvetica Neue", Arial, sans-serif` | `style.css:4` | Station HUD display typeface |

### 3.2 Z-Index Scale

All fixed/overlay layers must preserve this exact stacking order (`style.css`, `post.css`, `comms.js`):

| `z-index` | Element(s) | Purpose |
|---|---|---|
| `0` (auto) | `<canvas id="scene">` | Full-viewport 3D WebGL scene (`position: fixed; inset: 0`) |
| `1` | `section#comms` | Contact 3D field link overlays (`pointer-events: none` container; `<a>` children `pointer-events: auto` when open) |
| `2` | `#hud`, `#lock`, `#cue` | Room HUD, targeting lock brackets/tag, room cue brackets/tag |
| `3` | `#inspectbar` | Inspection toolbar, `#named`, door buttons/menu, volume list, `#enter` |
| `4` | `#reader` | Holographic article reader frame (plus `.copy` inside `.post pre` has local `z-index: 1`) |
| `5` | `#loader` | Full-screen room loading cover in `html.station` |
| `6` | `html.reading #loader`, `#stepin`, `Toast` | Compact loading pill and step-in offer button above `#page` in `html.reading`; non-blocking `Toast` above `#reader` (`z-index: 4`) |

---

## 4. `Station` Engine Boundary and Frame-Loop Contract (`F3`, `U0c`, `U4`–`U6`)

### 4.1 Hard Boundary Invariants (`docs/program-plan.md` §4.2)

1. **Engine isolation:** `src/engine/**` never reads or writes the DOM (except `<canvas>` and temporary legacy lines tracked in `src/engine/DOM.md` until `U5`/`U6`/`U8` empty it) and never imports `src/app/**`.
2. **`onFrame` signal rule:** `src/app/**` **never** reads a Solid signal inside `station.onFrame(...)`. Per-frame moving DOM (`#lock`, `#cue`, `#reader`, `#comms` links, and `scene-picks` proxy `<button>` positions) updates via direct element refs and plain-JS mirrors populated by `station.subscribe(...)`.
3. **Solid 2 microtask timing:** Solid 2 applies signal writes in a microtask (`onSettled` replaces `onMount`). No logic may read layout/DOM synchronously on the line after setting a signal; component/integration tests must call `flush()` (and `await settle()` for async UI SDK focus/popups) before asserting DOM state.
4. **No per-frame `getBoundingClientRect`:** `clearance()` DOM polling in `onFrame` is eliminated. `#inspectbar` reports its covered rectangle via `station.setCovered('bar', rect)` only on show/hide/resize/option changes.

### 4.2 `Rect` and `Station` Additions Required from `F3` / `U0c`

Every spatial method (`rectOf`, `contactLinkRect`, `setCovered`) shares the 8-field `SpatialRect`-compatible `Rect`:

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

In addition to `docs/program-plan.md` §4.2 (`start`, `dispose`, `enter`, `room`, `focus`, `back`, `step`, `focused`, `choose`, `travel`, `read`, `picks`, `pointed`, `rectOf`, `reader`, `readAt`, `closeReader`, `frameOf`, `contact`, `contactLinkRect`, `setCovered`, `view`, `setView`, `turn`, `onFrame`, `debug`), `F3` must implement these `U0c` and page-layer boundary additions:

1. **`picks: Readable<StationPick[]>`:** Excludes the synthetic unnamed `reads` pick (`aside: true, name: ''`) and emits only live picks (`!p.live || p.live()`), re-emitting whenever liveness changes. Each `StationPick` has `{ id: PickId; name: string; verb: string; kind: PickKind; cta?: boolean; canRead?: boolean; cue?: { pointer: string; touch: string } }` (where `PickKind = 'door' | 'terminal' | 'exhibit' | 'station' | 'contact' | 'thing'`) with non-empty uppercase `name` and `verb`.
2. **`rectOf(pick: PickId): Rect | null`:** Uses cached viewport dimensions (updated on `resize`, never reading `canvas.clientWidth` inside `rectOf`), `PAD = 6`, `EDGE = 8`, `MOST = 0.6`. Returns `null` if any outline corner has `_v.z > -camera.near`, clamped `width < 2 || height < 2`, or clamped `width * height > 0.6 * W * H`. Safe inside `onFrame` after `camera.updateMatrixWorld()`.
3. **`gliding: Readable<boolean>`:** `focus.f < 1` (needed by `U4` for `display.state().gliding` without polling).
4. **`wideAtRest: Readable<boolean>`:** `!busy && !focus.pick && focus.f >= 1 && view === 0 && since > 0.8` (gates `#cue` alongside `#lock` inactivity).
5. **Turn-by-hand completion:** Expose `hintTurnDone: Readable<boolean>` (or `turn.byHand()` triggering a reactive notification) so `U2` clears Navigation's `"until": "turn"` hint without reading signals inside `onFrame`.
6. **`focused.typing?: boolean`, `reader` state, and `frameOf('reader')` (`ReaderFrame`):**
   - `focused` includes `typing?: boolean`; `reader: Readable<{ state: 'closed' | 'scanning' | 'open'; url: string | null; title: string | null; phone: boolean }>` replaces `was.reads` (`station.reader.get().state !== 'closed'`), with `phone` unified to `W <= 720` (matching CSS `@media (max-width: 720px)`).
   - `reveal: number` lives on `ReaderFrame = { width: number; height: number; transform: string; reveal: number }` returned by `frameOf('reader'): ReaderFrame | null` — **not** on `Readable` `reader` — so zero Solid signals update per frame during reveal (`reader.state` stays `'scanning'` until `reveal >= 1`, then transitions to `'open'`).
   - `frameOf('reader')` returns `null` whenever `reader.state === 'closed' || !ready || T < REVEAL[0]` (where `T` is scan/unfold elapsed time and `ready` is set via `setReaderContentReady`).
7. **Reader ready & `headHeight` handshake (`U5`):** `setReaderContentReady(ready: boolean, headHeight?: number): void` lets `src/app/` notify `reader3d.ts` when article fetch/adoption (or error fallback) completes and pass `.reader-head` `offsetHeight` into `uHead` (and on resize), releasing `w.waits` scan-hold and revealing `frameOf('reader')` once `T >= REVEAL[0] && ready` without DOM fetches or `offsetHeight` reads inside `src/engine/`. Closing resets `ready` to `false`.
8. **Synchronous `reads(url: string): boolean` and `volumesCount: number`:**
   - `reads(url: string): boolean` synchronously reports whether `url` can be read in the active room (mirroring `room.reads(url)`, returning `false` when no room is loaded or a Library post is not shelved).
   - `volumesCount: number` exposes the active room's shelved volume count (`room?.volumes?.length ?? 0`) for `writing`'s `"{count} VOLUMES"` fact.
9. **Contact link hover & `:focus-visible` notification (`U6`):** `setContactLinkState(index: number | null, state: { hover: boolean; focusVisible: boolean }): void` notifies `comms3d.ts` on `pointerenter`/`pointerleave`/`focus`/`blur` of the 3 `<a>` elements so the 3D field canvas redraws `INK.lit` hover states and `INK.warm` `:focus-visible` rings with zero DOM access in `src/engine/`.
10. **Single-stop door `1500ms` delayed `travel`:** `station.focus(doorPick)` for a single-stop door (`!door.stops && door.to`) internally schedules `travel(door.to, 1500)` and cancels that timer on `back()`, `focus(other)`, or `dispose()`.
11. **`read(pick?: PickId): boolean`:** Calling `station.read()` reads the currently focused pick; calling `station.read(pickId)` checks readability (`canRead`) **before** focusing `pickId` (returning `false` immediately with zero side effects — no `focus(pickId)` and no single-stop door `travel()` — when unreadable), and only when readable focuses `pickId` (if not already focused) and opens its reading, returning `true` when reading started.
12. **`debug.display.state`:** Delegates to `U4`'s plain-JS frame mirror (`() => DisplayState`).

### 4.3 Vite / Vitest / Solid 2 Configuration Constraints (`U0b`, `U0c`)

- **Mandatory Vite & Vitest setting:** `optimizeDeps: { exclude: ['@ui-sdk/core'] }` in both `vite.config.ts` and `vitest.config.ts`, preventing `@ui-sdk/core` from splitting across bundled and unbundled module graphs.
- **`tsconfig.json`:** `"skipLibCheck": true` (required by TypeScript `7.0.2` against `@solidjs/diagnostics@2.0.3` and `@types/three@0.181.0`/`@webgpu/types`).
- **Diagnostics hygiene:** Defer initial `syncFrame()` via `requestAnimationFrame` and cache viewport dimensions on `resize` to stay under Solid 2's `8ms` `HOT_SCOPE_TIME` budget in `onSettled`. Component tests asserting `expectNoDiagnostics(artifact, { allow: [] })` and `expectNoSilentHolds(artifact)` must run serially without live SwiftShader `WebGLRenderer` `rAF` contention (or explicitly scope `toHaveNoWaste()` to app-owned signals rather than `@ui-sdk/solid` internals).

---

## 5. Region-by-Region Specifications (§4.3)

### 5.1 Region `hud` (`U2` — Nav, View Toggle, Hero, Facts, Hint)

#### Elements, Roles, Accessible Names, and States
- **Root:** `<div id="hud" class={...}>`
  - States: `.hidden` (initially, during room loads, and while `busy`); `.inspecting` (when `focused !== null`, hiding `.hero` and `footer` via `opacity: 0` and setting `.cta` `pointer-events: none`; in `body.bright`, `.inspecting` retains the top dark gradient scrim so nav stays legible).
  - Pointer behavior: `#hud` has `pointer-events: none`; interactive descendants (`header nav a`, `header [role="radiogroup"]`, `.hero .cta`, `#cue .lock-tag`) have `pointer-events: auto`.
  - Pollable opacity: `getComputedStyle('#hud').opacity === '1'` indicates HUD fade-in completion (`contact.mjs:32`).
- **Header (`<header>`):**
  - `<div class="brand"><span class="ring" aria-hidden="true"></span><span id="brand">{content.brand}</span></div>` (`"ARK AURORA"`).
  - `<nav aria-label="Rooms">` (or `<nav>` inside `#hud > header`):
    - Room links: `<a href={urlFor(k)} data-room={k} class={k === roomId ? 'here' : undefined} aria-current={k === roomId ? 'page' : undefined}>{v.nav}</a>`. Clicking without modifier keys calls `e.preventDefault(); enter(k)` (or router navigation in `U8`).
    - Separator: `<span class="sep" aria-hidden="true"></span>`.
    - View toggle: Wrapped `@ui-sdk/solid` `SegmentedControl` inside `src/app/ui/SegmentedControl.tsx` (`aria-label="Camera view"`), pinned to render `<a data-view="0">` (`WIDE`) and `<a data-view="1">` (`r.close`, e.g., `"THE OCULUS"`, `"THE WINDOW"`, `"THE CRANE"`, `"THE MAP"`) inside `#hud nav`. Clicking sets `navTouched = true` and `station.setView(v === 0 ? 'wide' : 'close')`. Pinning `<a data-view="0"|"1">` preserves `turn.mjs:174` (`#hud nav a[data-view="0"]`) unchanged while passing `checkPattern` on the segmented control / radiogroup. *(Note: if live `@ui-sdk/solid@0.1.0-beta.16` `SegmentedControl` verification in `U1`/`U2` shows it cannot render `<a>` items and requires `<button>`/`[role="radio"]`, `U2` must explicitly update `turn.mjs:174` to `#hud nav [data-view="0"]` alongside keeping `data-view="0"|"1"`.)*
- **Hero (`<section class="hero">`):**
  - States: `.yield` (when `#lock` overlaps `.hero` or `footer`, `opacity: .16`).
  - `<p class="kicker">{r.kicker}</p>`
  - `<p class="headline" role="heading" aria-level="1">{lines joined by <br>}</p>` (or `<h1>` styled identically; keeping `role="heading" aria-level="1"` or `<h1>` ensures one level-1 heading in Station mode).
  - `<p class="sub" hidden={!r.sub.length}>`:
    - When `r.sub` is empty (`projects`, `experience`, `writing`, `comms`, or missing profile in `lobby`/`about`), `hidden` MUST be `true`, `textContent` MUST be `""`, and computed bounding height MUST be `0` (`rooms.text.mjs`).
    - When `r.sub` is non-empty (`lobby`: `["{name}  ·  {headline}"]`; `about`: `["{headline}  ·  {location}"]`), render plain text spans via JSX text interpolation — **never `innerHTML`**. Any `{tminus}`, `{aboard}`, `{received}` live tokens render `<span data-live={key}>{value}</span>` updated on a `500ms` interval (`screens.ts` `live()`/`fill()`). Zero HTML markup in JSON strings may ever create DOM nodes (`hostile.mjs`).
  - Optional `<Button class="cta">` (wrapped in `src/app/ui/Button.tsx`): Rendered **only** when `r.cta` is non-empty. Click/Enter invokes `station.readAt(r.ctaReads, { fly: false })` if `r.ctaReads` exists, else `station.focus(ctaPick.id)` where `ctaPick = station.picks.get().find((p) => p.cta)`.
- **Footer (`<footer>`):**
  - States: `.yield` on `#lock` overlap.
  - Facts: `<div><b>{label}</b> {value}</div>` (with `{count} VOLUMES` pluralized `1 VOLUME` / `N VOLUMES` in `writing` from `station.volumesCount`). All text rendered via JSX text nodes (never `innerHTML`).
  - Hint: `<div class="hint" classList={{ gone: !hintText }}><span class="how">{hintText}</span>{r.credit && <small>{content.credit}</small>}</div>`.
    - Hint selection rule: room's own `r.hint[kind]` while `!hintTurnDone()` (when `r.hint.until === 'turn'`), else `content.display.hint[kind]` until first inspection (`!inspected`), else `""`. `kind` is `'touch'` when `hover: none` or last `pointerType === 'touch'`, else `'pointer'`.

#### Phone Layout (`<= 720px`)
- `#hud nav` (room links + view toggle) is hidden (`display: none`); room navigation on phone uses doors or `#pagenav` in plain/reading mode.
- `#hud > footer` becomes `position: relative`, moving `.hint` above the footer (`position: absolute; left: 0; right: 0; bottom: calc(100% + 16px); text-align: left`), hiding `.hint small` and `.hint.gone`.
- In `body.bright` (Comms) at `<= 720px`: `.hero::before` uses asymmetric gradient (`rgba(2,5,9,.8)` across top and `42% -> 74%` fade), `.kicker` and `.cta` switch to `#ffb884`, `.cta` background becomes `rgba(2,5,9,.7)`.

---

### 5.2 Region `bar` (`U3` — Inspect Bar)

#### Elements, Roles, Accessible Names, and States
- **Root:** `<div id="inspectbar" hidden={focused === null} classList={{ aside: !!focused?.aside }}>` (`z-index: 3`).
  - `.aside` hides `#prev`, `#next`, and `#count` (used during active reading or aside picks).
- **Caption (`#named`):**
  - `<span id="named" aria-live="polite" title={focused?.name ?? ''}>{focused?.name ?? ''}</span>`
  - Positioned above `#back` (`bottom: calc(100% + 12px)`); CSS `:empty { display: none; }`.
- **Navigation Toolbar (`src/app/ui/Toolbar.tsx`):**
  - Wraps `@ui-sdk/solid` `Toolbar` (`role="toolbar"`, `aria-label="Inspect controls"`), where `[role="toolbar"]` roving owns `ArrowLeft`/`ArrowRight` (`e.preventDefault()`) across `#back`, `#prev`, `#next` (passing `checkPattern(..., 'toolbar')` in `U3`), containing:
    - `Button#back` (`type="button"`): text `{focused.backLabel ?? '←  BACK'}`, invokes `station.back()`.
    - `Button#prev` (`type="button"`, `aria-label="Previous"`): text `"‹"`, invokes `station.step(-1)` on activation.
    - `<span id="count">{`${tour.index + 1} / ${tour.count}`}</span>` (note: in `body.bright`, `#count` gets `color: var(--fg); background: rgba(2,5,9,.6); backdrop-filter: blur(6px)`).
    - `Button#next` (`type="button"`, `aria-label="Next"`): text `"›"`, invokes `station.step(1)` on activation.
- **Actions & Choices (`#ways`):**
  - **Single-stop door (`ways.length === 1`):** `Button` with `data-to={way.to}`, `disabled={!way.to}`, text `{way.label}{way.to ? '  →' : '  ·  NOT YET OPEN'}`. Click calls `station.travel(way.to)`.
  - **Multi-stop door (`ways.length > 1`, e.g., Ring Line):** `@ui-sdk/solid` `Menu` (wrapped in `src/app/ui/Menu.tsx`) triggered by a `Button` (e.g., `"STATIONS  ▾"` or door label), listing each stop as `[role="menuitem"][data-to={way.to}]`, `disabled={!way.to}`. `checkPattern(..., 'menu')` must pass. The `Menu` wrapper must render non-portaled inside `#ways` (or if `@ui-sdk/solid@0.1.0-beta.16` `Menu` portals to `<body>`/top-layer by default when verified live in `U1`/`U3`, `U3` must either disable portaling on the wrapper or explicitly update the ported `ringline` E2E spec to click the `Menu` trigger before targeting `[role="menuitem"][data-to]` and include the open menu rect in `setCovered('bar', rect)` / `hud.mjs` bar-clear checks).
  - **Pick with `options` (Library terminal volumes):** `#ways` carries `.list` (and `.chosen` when `current >= 0`), wrapping `@ui-sdk/solid` `Listbox` (`src/app/ui/Listbox.tsx`, `aria-label="Catalogue volumes"`) and `<Button id="enter">` as **siblings** inside `#ways` (never nesting `#enter` inside `[role="listbox"]`, so `checkPattern(..., 'listbox')` passes). Each option inside `[role="listbox"]` exposes `data-option={i}`, `aria-current={current === i ? 'true' : undefined}` (plus UI SDK `aria-selected` mapped cleanly so `checkPattern(..., 'listbox')` passes), primary title text, and optional `<small>{sub}</small>`. Selecting option `i` calls `station.choose(i)`. Activating/`Enter`-pressing the **already-current** option (`current === i && focused.canRead`, except on `<= 720px` when expanding a folded `.chosen` list) calls `station.read()` (preserving `library.mjs:305`, where focus remains on `[data-option="1"]` when the second `Enter` starts reading).
  - **Read button (`#enter`):** `Button#enter` (sibling to `[role="listbox"]` inside `#ways`, `hidden={!focused.canRead}`, `aria-label={content.reader.readThis}`, text `{focused.readLabel}`, e.g. `"READ"`), invokes `station.read()`.
- **`setCovered('bar', rect)` (Zero `getBoundingClientRect` in `onFrame`):**
  - A `ResizeObserver` + effect (never inside `onFrame`) measures the bounding union of visible `#inspectbar` controls (`button, #named, #ways.list`, plus any open non-portaled/portaled menu or phone drawer panel) whenever `focused`, `ways`, `options`, `chosen`, or viewport size changes, and calls `station.setCovered('bar', rect)` (or `null` when `hidden`).
  - Engine `reader3d.ts` uses that cached rect to keep `ReadGlyph` clear above the bar with zero per-frame forced layout.

#### Phone Layout (`<= 720px`) & Touch Targets
- `#inspectbar` wraps (`flex-wrap: wrap; max-width: calc(100vw - 2 * var(--edge))`).
- `#ways:not(.list) button[data-to]` moves to its own full-width row above `#back`/`#prev`/`#next` (`order: -1; flex: 1 0 100%`).
- **Phone volume list (`U3`):** On `<= 720px`, once a volume is chosen (`.chosen`), the list folds down to the currently selected volume (`[aria-current="true"]` with `"▾"` indicator); tapping/activating it opens the full volume list inside `#ways.list` (or via a non-portaled / inline `Drawer` inside `#ways`, see §9 Open Questions — or if `@ui-sdk/solid` `Drawer` portals to `<body>`/top-layer by default, `U3` must explicitly align `library.mjs` / `hud.mjs` selectors and `setCovered('bar', rect)`). Unfolded `#ways.list` on `<= 720px` caps height with `max-height: calc(100vh - 180px); overflow-y: auto` so expanded lists with `>= 44 CSS px` rows cannot collide with the top of a `390×844` viewport. All `[data-option]` buttons on phone must be **>= 44 CSS px** tall (currently `>= 40px` in `library.mjs:112`; bump mobile padding/min-height to `44px` where it does not collide with `#inspectbar`).
- `#inspectbar button` and `#prev`/`#next` on `<= 720px`: `min-height: 44px; min-width: 44px`.

#### Focus & Keyboard (`bar`)
- `[role="toolbar"]` roving owns `ArrowLeft`/`ArrowRight` (`e.preventDefault()`) when focus is inside `#back`, `#prev`, `#next`, while `ArrowLeft`/`ArrowRight` outside `[role="toolbar"]` and `[data-slot="scene-picks"]` (or activating `#prev`/`#next`) invokes `station.step(-1 | 1)`. Global `D5` `Escape` (`station.back()`) and `Enter` (`station.read()` when focus is on an already-current `[data-option]` with `focused.canRead` except folded phone expand, or on `body`/non-control with `focused.canRead`; normal buttons `#back`, `#prev`, `#next`, `#ways [data-to]`, `.cta`, `#enter` use native activation) stay preserved.
- After reading closes (`Escape` or `.reader-close`), focus returns to `#ways [aria-current], #enter:not([hidden]), #ways [data-option], .hero .cta, #back` in that priority order (`main.js:301`).

---

### 5.3 Region `picks` (`U4` — `scene-picks` Primitive, `#lock`, `#cue`)

#### `scene-picks` Primitive Specification (`U0c`)
Built with `@ui-sdk/core@0.1.0-beta.16` `definePrimitive` in `src/app/ui/ScenePicks.tsx` (or `src/app/primitives/scenePicks.ts` + wrapper in `src/app/ui/`):

- **Parts & Roles:**
  - `root`: `role="group"`, `aria-label={content.picksLabel ?? "Room things"}`, `bind` calls `prepareAnnouncements(el.ownerDocument)`.
  - `item`: `<button type="button">` (`role="button"`), `focus: "roving"`, `props: { value: "string", name: "string", verb: "string" }`, `selects: selects({ focused: ({ key }) => [key, null], value: ({ key }) => [key, null] })`, `controlled: ["value"]`.
  - **Omit `live` for `"focused"`:** Do **not** include `"focused"` in `live: [...]` because `@ui-sdk/solid` `use-primitive.jsx` skips `attrsTick` on `live`-only changes and would freeze `tabindex`.
  - Item attributes: `tabindex={roving.tabIndex(state, part)}`, `aria-label={verb ? `${name}: ${verb}` : name}`, `aria-pressed={state.value === key}`, `data-pick={key}`.
- **Spatial Navigation & Offscreen Handling:**
  - `spatialMove({ rect: (_el, key) => rectOf(key) })` reads live per-frame screen projections on each `keydown`.
  - `claims` in `createRovingFocus` checks `isRectVisible(item.key)` (`rectOf(item.key) !== null && (state.value === null || item.key === state.value)`), preventing offscreen `items[0]` (e.g., at `414×896` or `390×844` portrait) from stealing initial `tabindex="0"`.
  - Expose `reconcileFocus()` and invoke it inside `onFrame` **only** when the focused proxy's `rectOf` becomes `null`, `focused === null` while a pick becomes visible, or `document.activeElement` becomes offscreen — plus on `keydown`/`focus`/`blur`. When zero picks are visible, `el.blur()`.
  - **Proxy CSS:**
    - Visible proxy (`rect !== null`): `position: fixed; left: 0; top: 0; opacity: 0; pointer-events: none; transform: translate(${r.left}px, ${r.top}px); width: ${r.width}px; height: ${r.height}px;`. `document.elementFromPoint(cx, cy)` MUST hit `<canvas id="scene">`.
    - Offscreen proxy (`rect === null`): parked at `transform: translate(-9999px, -9999px); width: 1px; height: 1px; opacity: 0; pointer-events: none;` — **never** `display: none` or `aria-hidden="true"`, so `@ui-sdk/core/agent` `scan()` (`el.checkVisibility(...)`) still sees all items.
- **Spatial Edge `preventDefault()`:**
  - Inside `item` `on.keydown`, run `roving.keydown(e, el)` **first**, then unconditionally call `e.preventDefault()` for `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Home`, `End` (without `Alt`/`Ctrl`/`Meta`) **even when at a spatial edge** so arrows never leak to `D5`'s global tour stepper.
- **Inspect, Read, Announcements, and `agent` Key:**
  - `press` (first `Enter`/`Space`/click): calls `api.inspect(key, event)` -> `onInspect(key)` + `announce("${name}: ${verb}")`. `onInspect` MUST be idempotent (`if (station.focused.get()?.pick !== id) station.focus(id)`).
  - Second `Enter` while focus remains on an already-inspected readable pick (`state.value === key && canReadForPress(item)`): calls `api.read(key)` -> `station.read(key)` + `announce("Reading ${name}")`.
  - `api.read(id)` invokes `onRead(id)` (`station.read(id): boolean`) **before** mutating `value` or calling `onInspect(id)`; if `canRead(id) === false` or `onRead(id) === false`, throws `Error(\`"\${item.name}" has nothing to read.\`)` with zero side effects (no `focus()`, no single-stop door `travel()`).
  - `canRead(id)`: returns `focused?.canRead` when `focused?.pick === id`, else `picks.find(p => p.id === id)?.canRead` (`undefined` when omitted so unfocused `api.read(id)` delegates dynamically to `station.read(id)`).
  - Spatial arrow move announces `"${name}, ${verb}"` via `announce(..., { priority: "polite" })`.
  - `agent` key: `{ actions: ['inspect', 'read'], closed: true, items: (api) => api.items(), shown: (state) => state.items.length > 0 }` where `api.items()` returns `{ value: item.id, label: item.verb ? `${item.name}: ${item.verb}` : item.name }` matching rendered button accessible names.

#### `#lock` and `#cue` Marks & Stillness Contract
- **`#lock` (`z-index: 2`, `aria-hidden="true"`, `pointer-events: none` on root and all children):**
  - Structure: `.lock-box` (4 `.c` corners `.tl`, `.tr`, `.bl`, `.br`) + `.lock-tag` (`span.lock-name`, `span.lock-verb`).
  - Driven in `onFrame` from `targetId = activeProxyId ?? pointedPickId`, shown **only** when `targetId !== null && targetId !== focused?.pick && !busy && reader.state === 'closed' && rectOf(targetId) !== null` (`busy` corresponds to `room.status !== 'ready'`, matching `main.js:527`).
  - States: `.on` (visible/settled), `.cut` (applied briefly during initial show/swap to restart transition cleanly, or permanently under `prefers-reduced-motion: reduce`), `hidden` when dropped (`150ms` delay on motion, immediate `0ms` on reduced motion).
  - Thresholded DOM updates: skip style writes if all 4 `[x, y, w, h]` values changed by `< 0.05` px.
  - Overlap yielding: measures `#hud .hero` and `#hud > footer` rects on show/resize (not per-frame), toggling `.yield` (`opacity: .16`) when `#lock` box or `.lock-tag` intersects them.
- **`#cue` (`z-index: 2`, `aria-hidden="true"`):**
  - Same inner structure as `#lock`, plus `.first` on first appearance per pick in the current room visit; `#cue.on .lock-tag` has `pointer-events: auto; cursor: pointer;` and clicking it calls `e.stopPropagation(); station.focus(cuedPick.id)`.
  - Shown **only** when `wideAtRest && !lockActive` for the first live pick with `.cue` not yet in `spent` (cleared when that pick enters focus; reset on room re-entry).
  - Tag placement (`under`, `right`, `left`, `over` in order): `GAP = 6px`, `EDGE = 8px`, clears HUD `wordZones` by `CLEAR = 20px` (fallback `0px`), and retains `cSide` until occluded so the tag never hops during camera sway.
- **Stillness invariant (`v1-contracts.md` §4, `hud.mjs`):**
  - Zero infinite CSS animations (`document.getAnimations()` with `iterations === Infinity` inside `#hud, #inspectbar, #lock` MUST be `0`).
  - Once settled, `display.state()` (`{ lock, named, hint, gliding, cue }` with `0.1`-rounded `[l, t, w, h]`) MUST remain unchanged over `1.5s`.
  - Under `prefers-reduced-motion: reduce`, `:is(#lock, #cue), :is(#lock, #cue) * { transition: none !important; }` and `hidden` toggles immediately (`0ms`).

---

### 5.4 Region `reader` (`U5` — The Reader's Frame)

#### Elements, Roles, Accessible Names, and States
- **Root:** `<div id="reader" role="region" aria-label={content.reader.label} hidden={reader.state === 'closed'} classList={{ open: reader.state === 'open', plain: !heads.length, phone: reader.phone }}>` (`z-index: 4`, `transform-origin: 0 0`; `reader.phone` follows `W <= 720`, matching CSS `@media (max-width: 720px)`).
- **Header (`.reader-head`):**
  - `<span class="reader-mark">{roomMark}</span>` (where `{roomMark} = content.rooms[roomId].nav`, matching `public/js/room.js:553`; hidden on `#reader.phone`).
  - `<span class="reader-title">{title !== mark ? title : ''}</span>`.
  - `<Button class="reader-close" type="button">{content.reader.back}</Button>` (`"CLOSE"`, `>= 44×44 CSS px` on phone `<= 720px`). Clicking invokes `station.closeReader()` / `station.back()`.
- **Contents Rail (`<nav class="reader-rail" aria-label={content.reader.contents}>`):**
  - Hidden when `#reader.plain`, `#reader.phone` (`<= 720px`), or `@media (max-width: 1000px)`.
  - `<p>{content.reader.contents}</p>` (`"CONTENTS"`) + `<ol>` of `<li><a href={`#${h.id}`} aria-current={activeIdx === i ? 'location' : undefined}>{h.text}</a></li>`.
- **Article Scroll Container (UI SDK `ScrollArea` in `src/app/ui/ScrollArea.tsx`):**
  - Class `.reader-scroll`, `tabindex="0"`, `overscroll-behavior: contain`.
  - **Verbatim Element Adoption & Ready Handshake:** Adopts the existing `#page article.post, #page section.post-list` (when `path === initialPath`) or fetched HTML parsed via `DOMParser` + `document.adoptNode(el)` (cached per `path`) directly into `.reader-scroll` — **never** re-renders article prose through Solid JSX. On fetch/parse error, renders `<p class="reader-error">{content.reader.failed}</p>`. Once settled (and on resize), calls `station.setReaderContentReady(true, headEl.offsetHeight)` so `reader3d.ts` releases `w.waits` and populates `uHead`.
- **Progress Bar (UI SDK `Progress` in `src/app/ui/Progress.tsx`):**
  - `.reader-progress > i`, `transform: scaleX(scrollFraction)` updated on scroll (`max > 0 ? scrollTop / max : 1`).
- **Code Copy (`button.copy` + UI SDK `Toast`):**
  - Each `<pre>` inside adopted article gets a `<button class="copy" type="button" aria-label={content.reader.copyCode}>{content.reader.copy}</button>` (`"COPY"`, omitting `aria-live="polite"` from `button.copy` itself so `Toast` does not double-announce).
  - On click: `navigator.clipboard.writeText(pre.textContent)`, updates button text to `content.reader.copied` (`"COPIED"`) for `1600ms`, and triggers a polite non-blocking UI SDK `Toast` (`role="status"` / `aria-live="polite"`, `z-index: 6` above `#reader`) saying `"Copied"` / `content.reader.copied`.

#### Per-Frame Placement, Links, and Focus
- **`onFrame` placement:** Reads `frame = station.frameOf('reader')` via direct `#reader` element ref (zero Solid signal reads or writes):
  - When `frame === null` (`reader.state === 'closed' || !ready || T < REVEAL[0]`), keeps `#reader.hidden = true` (matches `reader.js:297`).
  - Once `frame !== null`, unhides `#reader` (resetting scroll to top or deep-linked `#fragment` and updating progress on first show), applies `width`, `height`, and `transform` (`translate(${x}px, ${y}px)` once settled at rest; `matrix3d(...)` during camera glide — required by `rooms.kit.mjs` `frameChecks` and `deeplink.mjs:23`), and applies `clip-path: inset(0 0 ${((1 - frame.reveal) * 100).toFixed(2)}% 0)` while `frame.reveal < 1` (instant `''` on reduced motion), clearing `clipPath = ''` once `'open'`. `reader.state` remains `'scanning'` until `frame.reveal >= 1`.
- **Link interception inside `#reader`:**
  - `/blog/files/*` and `/resume/*`: set `target="_blank" rel="noopener"` and let browser handle.
  - `#fragment`: prevent default and `scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' })` inside `.reader-scroll`.
  - Same-origin room/article `/` links: prevent default and dispatch via `@solidjs/router` / `station.readAt` / `station.enter` (`U8`); if `!station.reads(url)`, allow normal browser navigation.
- **Focus lifecycle:**
  - Transition to `'open'`: scroll to top or deep-linked `#fragment`, then `.reader-scroll.focus({ preventScroll: true })`.
  - Transition to `'closed'`: blur active element inside `#reader` if any, then return focus to `#ways [aria-current], #enter:not([hidden]), #ways [data-option], .hero .cta, #back`.
- **Engine DOM removal (`U5`):** Delete all DOM elements, `DOMParser`, `adoptNode`, `.copy` buttons, and `#reader` CSS writes from `src/engine/reader3d.ts` (clearing its `src/engine/DOM.md` lines).

---

### 5.5 Region `contact` (`D4`, `U6a`, `U6`, `R1`)

Per owner decision `D4`, `U6a` (`f4bc684d`), and `R1`:

- **Three Ordered Links Only:**
  1. **LinkedIn** (`i === 0`): marked as the way to write to the owner (`aria-label="${label}, ${content.rooms.comms.comms.opens}"`, `aria-description={content.rooms.comms.comms.writeNote}` -> `"Write to me"`).
  2. **GitHub** (`i === 1`): `aria-label="${label}, ${opens}"`.
  3. **Résumé** (`i === 2`): `aria-label="${label}, ${opens}"` (pointing to `/resume/<file>.pdf`).
- **Deleted modes:** No `<form>`, `<textarea>`, `<input>`, `mailto:`, `SEND`, `COPY`, `endpoint`, `address`, or `contact.email` anywhere in DOM, data, or engine.
- **DOM Overlay (`section#comms`):**
  - `<section id="comms" data-mode="links" aria-label={comms.title} inert={!contact.open}>` (`z-index: 1`, `position: fixed; left: 0; top: 0; width: 0; height: 0; pointer-events: none`).
  - Contains **exactly 3** `<a href={link.url} target="_blank" rel="noopener">` children styled visually transparent over the 3D field drawings (`opacity: 0; background: none; color: transparent; border: 0; cursor: pointer`).
  - `pointer-events` on `#comms` is `'none'` until `contact.open` is true (and field unfolded `> 0.9`), at which point links receive clicks, taps, middle-clicks, context menus, and `Tab` focus.
  - **Per-frame placement:** `onFrame` reads `station.contactLinkRect(i)` (0, 1, 2) and updates each `<a>` ref's `transform: translate(x, y)`, `width`, and `height` (thresholded to rounded px changes).
- **Phone (`390×844` / `414×896`) & Touch Targets:**
  - In portrait (`innerWidth < innerHeight * 0.9`), `comms3d.ts` `LAYOUT.port` draws `links[0]` full-width above `links[1]` and `links[2]` side-by-side.
  - Every `<a>` bounding box MUST measure **>= 44 × 44 CSS px** (`contact.mjs:121`), lie fully inside viewport, not overlap any sibling link or `#inspectbar`/`#named`, and be the top `document.elementFromPoint` hit at its center.
- **Keyboard & Focus Ring:**
  - Opening via keyboard (e.g., `Enter` on `.hero .cta` or `scene-picks` proxy) captures `opener = document.activeElement`, waits for field settle (`900ms`, skipped/instant if already open), and focuses `links[0]` (`.focus({ preventScroll: true })`) when keyboard-driven (`keys || pointer: fine`).
  - Visual `:focus-visible` ring (`INK.warm` `#ffdcae`, 5px outer rounded rect) and hover state (`INK.lit`) are drawn in the 3D field canvas (`comms3d.ts`), driven by `station.setContactLinkState(index, { hover, focusVisible })` on `pointerenter`/`pointerleave`/`focus`/`blur` of the 3 `<a>` elements (zero DOM reads in `src/engine/`).
  - `Tab` walks `LinkedIn` -> `GitHub` -> `Résumé`. `Enter` opens the focused link in a new tab (`target="_blank" rel="noopener"`) without navigating the station.
  - Closing (`Escape` or `#back`) re-sets `inert = true` and restores focus to `opener` (`.hero .cta`).
- **`/contact/` Static Alignment (`U6a`, `R1`):**
  - `/contact/` renders `<article class="post page" data-slug="contact">` with `h1` `"Contact"`, `p.post-lede` (`contact_intro`), `<p>` (`contact_invitation`), `h2#elsewhere` + `ul.post-links` (3 `target="_blank" rel="noopener"` links with `<span class="post-note">Write to me</span>` on LinkedIn), and `h2#availability` (`seeking` list, no `#hiring` link).
  - **"What to write about" (`h2#what-to-write-about`, `.route` sections, and `#hiring` links) is permanently removed from `/contact/`** (`U6a` + `U0-contact`).
- **Engine DOM removal (`U6`):** Delete `section#comms` and `<a>` element creation from `src/engine/comms3d.ts` (emptying its `src/engine/DOM.md` lines).

---

### 5.6 Region `cover`, `offer`, and Failure States (`U7`)

- **Cover (`#loader`, `z-index: 5` in `station`, `z-index: 6` in `reading`):**
  - Elements: `<div id="loader" classList={{ done: room.status === 'ready' && !failed }} data-failed={failed ? 'true' : undefined}>` containing `.mark` (`"◯"`), `.bar` wrapping UI SDK `Progress` (`#progress` width `${progress * 100}%`), `.label` with `<span id="what">{label}</span>` and `<span class="percentage"><span id="pct">{Math.round(progress * 100)}</span>%</span>`.
  - Transition: `.done` fades out over `1.2s` (`pointer-events: none`); hidden in Mode 3 (`html:not(.station):not(.reading) #loader { display: none; }`).
  - Reduced motion: `@media (prefers-reduced-motion: reduce)` stops `.mark` pulse animation (`animation: none`).
  - In `html.reading`: docks to bottom-right (`inset: auto 18px 18px auto`, `.mark` and `.bar` hidden).
- **Offer (`#stepin`, `z-index: 6`):**
  - Wrapped UI SDK `Button` (`id="stepin"`, `type="button"`) rendered only when `html.reading` is waiting on `Save-Data` or a scrolled/touched visitor. Hidden in `html.station` and plain Mode 3.
- **Failure States (`fail(msg)`):**
  - **When `#page` exists** (any generated static page): set `loader.dataset.failed = 'true'`, set `document.documentElement.className = ''` (Mode 3 plain page), log error, and leave `#page` unobstructed (`plainpage.mjs:53`).
  - **When `#page` does not exist** (bare `/` shell, e.g., WebGL2 unavailable): set `loader.dataset.failed = 'true'`, remove `.done`, render error message text in `#what`, hide `.percentage` and `.bar`, and stop `.mark` animation (`animation: none`).

---

### 5.7 Region `addresses` and Routing (`U8`)

- **`@solidjs/router` (`2.0.1`)** owns browser history and URL synchronization (`src/app/routes/`). Zero `history.pushState` / `history.replaceState` calls may exist outside the router adapter.
- **Canonical routes:**
  - `/` (`lobby`), `/about/` (`about`), `/portfolio/` (`projects`), `/portfolio/<slug>/` (`projects` + read), `/experience/` (`experience`), `/experience/#<id>` (`experience` + read), `/blog/` (`writing`), `/blog/<slug>/` (`writing` + read), `/contact/` (`comms`), `/contact/#availability` (`comms`), plus `/?room=<id>` compatibility (including guarding `Object.hasOwn(content.rooms, id)` against `'constructor'`).
- **Query parameter preservation:** `?shot=`, `?tier=`, `?msaa=`, `?scale=`, `?rollat=`, `?debug=`, `?lightcheck=`, etc. are preserved across room and article navigations (stripping only `?room=`).
- **History & `popstate` semantics (`history.mjs`):**
  - Entering a room pushes a URL only when path+search changes.
  - Opening an article pushes exactly `1` history entry; changing `#fragment` within the same open article uses `replace` (`replaceState` equivalent).
  - Browser Back/Forward (`popstate`) between rooms enters the target room; Back/Forward into/out of an article opens/jumps/closes `#reader` immediately with `{ fly: false }` (no drone flight).

---

### 5.8 Agent Bridge (`U9`, `D11`)

- Gated by `content.agent?.enabled === true` (default `false` in `public/content.json`, per `D11`).
- Dynamically imported (`import('@ui-sdk/solid/agent')` + `createAgent(...)`) **only** when `agent.enabled === true` so `0` bytes are fetched/executed when disabled.
- `allow` policy callback:
  - **Permits:** room navigation, `scene-picks` `inspect` and `read`, closing `#reader`/`#inspectbar`, and selecting a Library volume.
  - **Refuses / requires confirmation:** following external links leaving the site (`#comms` external `<a>`, external article links).
- WebMCP integration enabled where browser API exists when `agent.enabled === true`.

---

## 6. Global Keyboard Model (`D5`)

Per owner decision `D5` and `U0c` verification (`ui-spike-notes.md` §2):

| Context | Key | Behavior | Notes |
|---|---|---|---|
| **Reader open or typing** (`station.reader.get().state !== 'closed'` or `focused.get()?.typing` or editable control) | Any key except `Escape` | Suppressed by `scene-picks` and global `D5` listener | Preserves scroll keys inside `#reader .reader-scroll` and avoids hijacking arrows/Enter |
| **Global (anywhere)** | `Escape` | Capture `wasReading = station.reader.get().state !== 'closed'` before calling `station.back()`. If `wasReading`, restore focus to `#ways [aria-current], #enter:not([hidden]), #ways [data-option], .hero .cta, #back`. If in Contact (`#comms`), restores focus to `opener` | Evaluated before typing suppression; never trapped (scoped `#ways` prefix prevents matching `#hud nav a.here[aria-current="page"]`) |
| **Inside `[role="toolbar"]`** (`#inspectbar` `#back`, `#prev`, `#next`; reader closed & not typing) | `ArrowLeft` / `ArrowRight` | Roving focus across toolbar buttons (`e.preventDefault()`); activating `#prev` / `#next` (`Enter`/`Space`/click) calls `station.step(-1 \| 1)` | Satisfies APG `toolbar` pattern (`checkPattern('toolbar')` in `U3`) without leaking to global tour stepper |
| **Outside `scene-picks` & `[role="toolbar"]`** (`body`, `#hud`, non-toolbar `#inspectbar` controls; reader closed & not typing) | `ArrowLeft` / `ArrowRight` | `e.preventDefault(); station.step(-1 \| 1)` | Steps tour left-to-right (`tourOrder()`); applies only outside `[role="toolbar"]` and `[data-slot="scene-picks"]` (ignored if `e.defaultPrevented`) |
| **Outside `scene-picks`** (reader closed & not typing) | `Enter` | Normal buttons/links (`#back`, `#prev`, `#next`, `#ways [data-to]`, `.cta`, `#enter`, `#hud nav a`) use native activation; in `#ways.list` (`Listbox`), activating/`Enter`-pressing the already-current option (`current === i && focused.canRead`, except on `<= 720px` when expanding folded `.chosen` list) calls `station.read()`; otherwise if `focused?.canRead`, call `station.read()` | Preserves `main.js:428` and `library.mjs:305` (second `Enter` while focus stays on `[data-option="1"]` starts reading held volume) |
| **Page -> `scene-picks`** | `Tab` / `Shift+Tab` | Single roving stop enters `scene-picks` on `tabindex="0"` (last focused visible pick, else inspected visible pick, else first pick with `rectOf !== null`) | Offscreen `rectOf === null` picks are skipped at mount and mid-session |
| **Inside `scene-picks`** (proxy `<button>` focused; reader closed) | `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` | `spatialMove({ rect })` moves focus to nearest visible pick in screen direction; announces `"${name}, ${verb}"`. Calls `e.preventDefault()` **even at spatial edges** | Prevents leaking `ArrowLeft`/`ArrowRight` to global tour stepper |
| **Inside `scene-picks`** | `Home` / `End` | Moves focus to first / last visible pick (`e.preventDefault()`) | Standard roving endpoints |
| **Inside `scene-picks`** | `Enter` / `Space` | First press: `station.focus(pick.id)` (single-stop door schedules `1500ms` travel). Second press while `focused.pick === pick.id && canRead`: `station.read(pick.id)` | Matches pointer click (`U4`) |
| **Inside `scene-picks`** | `Escape` | If `focused !== null` or `reader !== 'closed'`, calls `station.back()`; if already in wide view (`!focused`), blurs active proxy so `#lock` clears | Prevents stuck `#lock` in wide view |

---

## 7. Accessibility (WCAG 2.2 AA) and Measured Contrast Thresholds

All page-layer UI (`#hud`, `#inspectbar`, `#reader`, `#comms`, `#loader`, `#stepin`, `#page`, `#pagenav`, `scene-picks`) targets **WCAG 2.2 Level AA** and preserves every measured threshold in `contact.mjs` and `plaincheck.mjs`:

### 7.1 Measured Contrast Thresholds

| Surface / Context | Minimum Contrast | Measured / Enforced Value | Reference |
|---|---|---|---|
| **Plain & Reader text (`#page`, `#pagenav`, `#reader`)** | `>= 4.5:1` normal text; `>= 3.0:1` large text (`>= 24px` or `>= 18.66px` bold `>= 700`) | Enforced across composited ancestor backgrounds & gradient stops | `plaincheck.mjs:80` |
| **Loader label (`#loader .label` `#7d94a3` on `#04060a`)** | `>= 4.5:1` | `6.41:1` | `style.css:15` |
| **`body.bright` (Comms) HUD DOM text** | `>= 4.5:1` at sky angles `[0, 120, 240]` | Measured `>= 6.0:1` across all HUD text runs (desktop & mobile) | `style.css:63-78`, `contact.mjs:6,161-169` |
| **`body.bright` (Comms) 3D field text** | `>= 4.5:1` at sky angles `[0, 120, 240]` (standby & open) | Measured `>= 8.75:1` | `contact.mjs:6,170-184` |
| **UI components & `:focus-visible` indicators** | `>= 3.0:1` | Visible cyan/amber/warm outlines (`#7fe3ff`, `#ff9a4a`, `#ffdcae`, `#ffffff`) | WCAG 2.2 SC 1.4.11, 2.4.7 |

### 7.2 Preserved `body.bright` Overrides (Comms)

When `content.rooms[id].bright === true` (`comms`), `body.bright` applies these measured overrides (`style.css:63-78`):

- **HUD scrims:** Top gradient `rgba(2,5,9,.76)` -> `rgba(2,5,9,.7)` (`72px`) -> `0` (`150px`); bottom gradient `rgba(2,5,9,.78)` -> `rgba(2,5,9,.72)` (`92px`) -> `0` (`180px`). Top scrim stays visible during `#hud.inspecting`.
- **Hero backdrop (`.hero::before`):** `rgba(2,5,9,.58)` with `filter: blur(26px)` on desktop; on `<= 720px`, `filter: blur(22px)` with top `rgba(2,5,9,.8)` (`104px`) and horizontal `rgba(2,5,9,.8)` (`0%–42%`) -> `rgba(2,5,9,.26)` (`74%`).
- **Text & pill overrides:** `.sub` `#d3e3ed`; `footer b` `#b4c8d4`; `footer .hint small` `opacity: .95`; mobile (`<= 720px`) `.kicker` and `.cta` `#ffb884` (with `.cta` `background: rgba(2,5,9,.7)`); `#named` `background: rgba(2,5,9,.66); backdrop-filter: blur(6px)`; `#count` `color: var(--fg); background: rgba(2,5,9,.6); backdrop-filter: blur(6px)`.

### 7.3 Additional WCAG 2.2 AA Rules

- **Keyboard & Focus (`2.1.1`, `2.1.2`, `2.4.3`, `2.4.7`, `2.4.11`):**
  - Every interactive control and 3D room thing is reachable and operable by keyboard alone (`D5`).
  - Zero keyboard traps (`Escape` exits `#reader`, `#comms`, `#inspectbar`, and wide-view proxy focus).
  - `:focus-visible` rings must never be suppressed without a visible replacement (in `#comms`, 3D canvas `INK.warm` focus ring; on `.cta`, `.reader-close`, `.reader-rail a`, `.reader-scroll`, `#inspectbar button`, `#pagenav a`, `#stepin`, visible border/shadow/outline).
- **Target Size (`2.5.8` + stricter mobile rule):**
  - Desktop (`> 720px`): interactive controls `>= 24 × 24 CSS px` (`library.mjs:112`, WCAG 2.5.8).
  - Phone (`<= 720px`, `#reader.phone`): Contact links (`contact.mjs:121`), `#inspectbar button`, `#ways.list [data-option]`, `.reader-close`, and `#stepin` MUST be `>= 44 × 44 CSS px` (with sufficient spacing so `#ways` and `#named` do not overlap `#inspectbar`).
- **Reduced Motion (`2.3.3`) & Stillness:**
  - `prefers-reduced-motion: reduce` turns camera glides, `#lock`/`#cue` fades, `#reader` reveals, and route-map turns into instant cuts.
  - Zero autonomous infinite display animations (`hud.mjs:211`).
- **Screen-Reader Names & Live Regions (`4.1.2`, `4.1.3`):**
  - Every `scene-picks` proxy has `aria-label="${name}: ${verb}"` and `aria-pressed`.
  - `#named` has `aria-live="polite"`.
  - `scene-picks` calls `prepareAnnouncements` / `announce(..., { priority: "polite" })` on spatial navigation, inspection, and reading start.
  - `Toast` announces `"COPIED"` via a single polite live region (`role="status"` / `aria-live="polite"`, `z-index: 6`); `aria-live` is omitted from `button.copy` to prevent duplicate announcements.
  - `#comms` links expose `aria-label="${label}, ${opens}"` and `aria-description="${writeNote}"` on LinkedIn (`index 0`).
  - Current room link in `#hud nav` uses `aria-current="page"`; current heading in `.reader-rail` uses `aria-current="location"`.

---

## 8. Preserved Test Hooks and DOM Contract

### 8.1 `window.__lobby` and `window.__station`

`F3` keeps `window.__lobby` identically for existing E2E specs while adding `window.__station` as its typed alias (`Station.debug`):

| Hook | Type / Return Shape | Notes |
|---|---|---|
| `renderer`, `camera`, `post`, `gov`, `series` | Engine internals | Kept for `perf`, `errs`, `opening`, and `?debug` flicker checks |
| `setFocus(pick)`, `step(d)`, `enter(id)`, `ready()` | Imperative controls / readiness (`0..1`) | `ready()` returns `intro` progress (`>= 1` once hero settled) |
| `display.state()` | `{ lock, named, hint, gliding, cue }` | Owned by `U4`'s plain-JS frame mirror; `lock` is `null` or `{ name, verb, rect: [l, t, w, h] }`; `cue` is `null` or `{ name, words, rect: [l, t, w, h] }` with `rect` rounded to `0.1` CSS px |
| `turn` | `null` or `{ angle(), front(), settled(), moving(), byHand(), heading(), to(i, now), nudge(r), step(d), grip() }` | Route map API in Navigation |
| `scene`, `picks`, `volumes()`, `held()`, `mode()` | Scene & room state | `mode()` returns `{ room, hdr, tier, msaa, scale, size, mirror }` |
| `reader` | `{ state(), url(), slug(), read(what), close() }` | `state()` returns `'closed' | 'scanning' | 'open'` |
| `lightFrame(eye, at, t)` | Conditional debug helper | Exposed only when `?lightcheck` is present |

### 8.2 `RUNTIME_IDS` in `tools/site.py`

Currently `tools/site.py:37` defines:

```python
RUNTIME_IDS = ('reader', 'stepin', 'enter', 'comms', 'cue')
```

Any new DOM `id` added at runtime by Solid components or `@ui-sdk/solid` wrappers (such as a root mount `#app`, `#toast`, `#drawer`, or menu/listbox portal IDs) **must** either live in `index.html` or be added to `RUNTIME_IDS` (with `tools/site.py` unit tests updated) in `U10` so `tools/site.py` prevents heading ID collisions.

### 8.3 Contractual DOM Selectors, Classes, and Attributes

| Region | Required Selectors / Attributes | Relied Upon By |
|---|---|---|
| **Shell / Modes** | `html.station`, `html.reading`, `html:not(.station)`, `<canvas id="scene">` (with `.turns` class when `turn !== null`, i.e., `canvas#scene.turns`), `main#page`, `nav#pagenav`, `#loader` (`.done`, `[data-failed]`, `#progress`, `#what`, `#pct`, `.percentage`, `.bar`, `.mark`), `button#stepin` | `plainpage`, `plaincheck`, `deeplink`, `hud`, `rooms.*`, `turn` |
| **`hud` (`U2`)** | `#hud` (`.hidden`, `.inspecting`), `#brand`, `#hud nav a[data-room]`, `#hud nav a.here`, `#hud nav a[data-view="0"\|"1"]` (or `[data-view="0"\|"1"]` if `U2` explicitly updates `turn.mjs:174`), `.hero`, `.kicker`, `.headline[role="heading"][aria-level="1"]`, `.sub`, `button.cta`, `footer`, `.hint`, `.how`, `.gone`, `.yield`, `[data-live]`, `body.bright` | `hud`, `rooms.text`, `contact`, `hostile`, `cue`, `turn` |
| **`bar` (`U3`)** | `#inspectbar` (`.aside`), `#named[aria-live="polite"]`, `[role="toolbar"]` (`#back`, `#prev[aria-label="Previous"]`, `#count`, `#next[aria-label="Next"]`), `#ways` (`.list`, `.chosen`; wrapping `[role="listbox"]` and sibling `#enter[aria-label="Read what this shows"]`), `[data-to]`, `[data-option]`, `[aria-current="true"]` | `library`, `hud`, `cue`, `rooms.read`, `contact`, `ringline` |
| **`picks` (`U4`)** | `[data-slot="scene-picks"]` (or `role="group"`), proxy `<button>`s, `#lock` (`.on`, `.cut`, `.lock-box`, `.c.tl/.tr/.bl/.br`, `.lock-tag`, `.lock-name`, `.lock-verb`), `#cue` (`.on`, `.first`, same inner structure) | `hud`, `cue`, `U4` keyboard walk |
| **`reader` (`U5`)** | `#reader[role="region"][aria-label="What is being read"]` (`.open`, `.plain`, `.phone`), `.reader-head`, `.reader-mark`, `.reader-title`, `button.reader-close`, `nav.reader-rail[aria-label="Contents"]` (`a[aria-current="location"]`), `.reader-scroll[tabindex="0"]`, `.reader-progress i`, `article.post[data-slug]`, `section.post-list`, `.post-next a`, `pre[data-lang] > code`, `button.copy`, `.reader-error` | `library`, `deeplink`, `rooms.read`, `rooms.cross`, `rooms.deeplink`, `history`, `page` |
| **`contact` (`U6`)** | `section#comms[data-mode="links"][aria-label="CONTACT"][inert]`, 3 `a[target="_blank"][rel="noopener"]` (`aria-label="<label>, opens in a new tab"`, `aria-description="Write to me"` on index `0`) | `contact` |

---

## 9. Open Questions and Recommendations (Gate `G3` / Run Defaults)

| # | Question | Options | Recommendation & Status |
|---|---|---|---|
| **Q1 (`D6`)** | **Page-layer styling system** | Plain CSS with existing custom properties (`tokens.css` + component CSS) vs Tailwind | **Recommend Plain CSS** (`D6` + `R1` default; already locked in `decisions.md`). Zero Tailwind, zero `@ui-sdk/solid` `web.css`. |
| **Q2 (`U0-contact`)** | **Do "what to write about" sections stay on `/contact/`?** | Keep `h2#what-to-write-about` & `.route` sections vs remove them now that visitors write via LinkedIn (`D4`) | **Recommend Remove** (`R1` + `U0-contact`; already implemented by `U6a` `f4bc684d` in `tools/site.py`, while retaining `contact_routes` in `profile.json`). |
| **Q3 (`D11`, `U9`)** | **Agent bridge default state in `public/content.json`** | `agent.enabled: false` (lazy-loaded only when enabled) vs `true` | **Recommend `agent.enabled: false`** (`D11` + `R1`). Zero bundle/runtime cost for normal visitors; tests and opt-in sessions enable it explicitly. |
| **Q4 (`U3`)** | **Phone volume list presentation (`<= 720px`)** | Folded inline `.chosen` `Listbox` (capped at `max-height: calc(100vh - 180px); overflow-y: auto`) vs non-portaled/inline `@ui-sdk/solid` `Drawer` sheet triggered by `[aria-current="true"]` | **Recommend non-portaled/inline UI SDK `Drawer` (or inline `#ways.list` with `max-height: calc(100vh - 180px); overflow-y: auto`) on `<= 720px`** per §4.3, keeping `[data-option]` and `[aria-current="true"]` inside `#ways` with `>= 44×44 CSS px` rows; if `@ui-sdk/solid` `Drawer` forces `<body>` portaling, `U3` explicitly aligns `library.mjs` / `hud.mjs` selectors and `setCovered('bar', rect)`. |
| **Q5 (`U5`)** | **Code block copy confirmation feedback** | `.copy` button text change (`COPY` -> `COPIED`) alone vs button text + polite UI SDK `Toast` | **Recommend Both**: update button label `COPY` -> `COPIED` (`1600ms`) AND trigger non-blocking UI SDK `Toast` (`role="status"` / `aria-live="polite"`, `z-index: 6` above `#reader`; `aria-live` omitted from `button.copy` to prevent double announcement). |
| **Q6 (`G4` vs `U0b`)** | **First-frame gzip JS budget alignment** | `U0b` measured Solid + `Listbox` + `Dialog` at `86.82 kB` gzip (`72.96 kB` eager), above Gate `G4`'s `<= 60 KB` gzip delta target over `G2` | **Recommend Lazy-Loading Non-Eager UI SDK Parts**: code-split `Drawer`, `Menu`, `Toast`, `ScrollArea` (with `#reader`), `Listbox` (until inspect), and `@ui-sdk/solid/agent` (`U9`), leaving only `hud` + `cover` + `picks` on the critical first-frame chunk; verify chunk sizes at `U1` and Gate `G4`. |

### Live `@ui-sdk/solid@0.1.0-beta.16` Verification Note (`U1`–`U3`)

Because `@ui-sdk/solid@0.1.0-beta.16` is not installed in the repository prior to `F1`/`U1`, `U1`–`U3` must verify the live `node_modules/@ui-sdk/solid/docs/` and rendered DOM in Chromium before locking wrapper internals:

1. **`SegmentedControl` tag support (`U1`/`U2`):** Verify whether `SegmentedControl` supports rendering `<a data-view="0"|"1">` items inside `#hud nav`; if it enforces `<button>` / `[role="radio"]`, explicitly update `turn.mjs:174` (`#hud nav [data-view="0"]`) in `U2`.
2. **`Menu` & `Drawer` Popover / portaling (`U1`/`U3`):** Verify whether `Menu` and `Drawer` render inline inside `#ways` or portal to `<body>` / top-layer by default; keep wrappers non-portaled inside `#ways` where possible, or explicitly align `U3` E2E specs (`ringline.mjs`, `library.mjs`, `hud.mjs` bar-clear bounding rect) and `setCovered('bar', rect)` in `U3`.
3. **`Toast` stacking (`U1`/`U5`):** Verify `Toast` container mounts at `z-index: 6` (or top-layer) above `#reader` (`z-index: 4`) and registers any runtime `id` in `tools/site.py` `RUNTIME_IDS` (`U10`).
