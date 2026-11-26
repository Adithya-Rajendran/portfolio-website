# Program plan: the page layer on Solid 2.0 and UI SDK, and optimization pass 2

Written 2026-11-24 against `explore/rolling-earth` at `6390b52`. Nothing in this plan has been carried out except the
environment described in section 6. The plan is meant to be executed by an orchestrator agent that hands the task cards
of section 8 to subagents.

## 0. How to use this plan

- **Orchestrator:** read sections 1 to 7 once, then run the loop in 5.2 over the order in section 7. Section 9 says when
  to stop and ask the owner. Keep `docs/program/status.md` current; nobody else edits it.
- **Subagent:** you receive one task card from section 8 inside the brief of section 10. Sections 4 and 5 bind you. If the
  card and the code disagree, the code is right about what exists and the card is right about what is wanted: say so in
  the pull request.
- File and line references are to `6390b52`. After task F1 the same code lives under `src/` (F1's script records the
  mapping in `tools/migrate/f1-map.txt`).

## 1. What this program delivers

1. **Optimization pass 2.** Shorter time to the first frame, adaptation that works on a slow GPU, less CPU work per frame,
   fewer lamp evaluations where the picture does not change, fewer bytes before the first frame, and a report with the
   measurements.
2. **A build step, TypeScript and an engine boundary.** The three.js code stays imperative. It becomes typed and sits
   behind one interface.
3. **The page layer on Solid 2.0 and UI SDK**, with the browser tests rewritten for it: nav, hero, facts, the inspect
   bar, the room's selectable things, the reader's frame, Contact's links, the cover and the offers.

Not in this program: a framework inside the frame loop; server rendering at request time (build-time rendering replaces `tools/site.py`, D20); a three.js upgrade;
re-baking rooms, unless a decision in section 3 says so; a production deploy (the owner's).

## 2. Ground truth

### 2.1 The code

| | |
|---|---|
| Own JavaScript | 19 modules, 4,061 lines, 343 KB (121 KB gzip), no build step |
| Lines that touch the DOM | 195 (6% of code lines): `main.js` 63, `reader.js` 42, `comms.js` 33, `hud.js` 30, `blueprint.js` 16 |
| Shader materials | 42, about 400 lines of GLSL in template strings |
| Largest functions | `loadRoom` 605 lines, `createComms` 293, `createReader` 259 |
| `main.js` | 506 lines, 23 module-level `let`s: renderer, camera, picking, frame loop, governor, routing, focus, input, DOM |
| Picks | plain objects with about 30 optional members (list in F3), built in `loadRoom`, read in `main.js` and `hud.js` |
| Browser tests | 52 scripts, 3,871 lines, addressed by id, class and `window.__lobby`; `tools/check.sh` runs 20 of them |
| Content pipeline | `tools/site.py` (1,406 lines) writes every readable page from the shell `public/index.html`; 3,277 lines of Python tests |
| Type check as is | `tsc --checkJs` (TypeScript 7.0.2): 98 findings in 3.2 s, none a live bug |
| Packing | `tools/pack.py` output is byte-identical on the laptop and the CI host (223 files); 222 s for all rooms on the CI host |

### 2.2 Speed today (hero view, 1920x1080, resolution pinned at 1, median of 3 runs)

Frame ms / GPU ms. Tier 1 is no MSAA with FXAA; tier 0 is 4x MSAA.

| Room | HD 630 tier 1 | HD 630 tier 0 | Draw calls | First visit download |
|---|---|---|---|---|
| Atrium (`lobby`) | 40.5 / 31.6 | 55.7 / 42.5 | 240 | 33.5 MB |
| Lounge (`about`) | 30.6 / 25.4 | 36.8 / 30.8 | 94 | 39.2 MB |
| Fabrication (`projects`) | 57.8 / 50.8 | 68.1 / 60.7 | 111 | 24.2 MB |
| Navigation (`experience`) | 42.7 / 33.6 | 48.0 / 39.7 | 166 | 12.2 MB |
| Library (`writing`) | 67.6 / 51.4 | 81.6 / 64.4 | 273 | 34.7 MB |
| Comms (`comms`) | 27.4 / 20.6 | 28.4 / 22.1 | 92 | 19.6 MB |

The same on the CI host (Intel Iris Xe), measured 2026-11-24:

| Room | CI host tier 1 | CI host tier 0 | First frame, no network limit |
|---|---|---|---|
| Atrium | 28.1 / 16.9 | 29.0 / 16.8 | 1.3 s |
| Lounge | 18.4 / 11.4 | 21.2 / 15.0 | 1.4 s |
| Fabrication | 22.2 / 15.4 | 23.0 / 16.5 | 0.9 s |
| Navigation | 26.2 / 16.7 | 25.4 / 16.2 | 0.9 s |
| Library | 29.2 / 16.0 | 29.8 / 16.3 | 1.2 s |
| Comms | 20.4 / 13.1 | 20.7 / 13.7 | 1.0 s |

On the CI host the GPU figure sits near 16 ms in five rooms whatever they draw, and a third to a half of the frame is
CPU work. So the CI host shows CPU changes and regressions; it cannot rank GPU work. GPU decisions are made on the
HD 630 numbers.

Time to the first frame: with no network limit 2.9 to 6.1 s on the laptop (1.3 to 1.4 s on the CI host); at 50 Mbit/s
and 20 ms: Atrium 11.1 s, Lounge 10.2 s, Library 10.1 s, Comms 7.5 s, Fabrication 6.4 s, Navigation 4.8 s; at
10 Mbit/s and 40 ms: Atrium 32.7 s, Navigation 12.7 s.

### 2.3 Where the time goes (HD 630, tier 1)

GPU ms per pass:

| Room | scene | mirror | final | shadow | bloom | other |
|---|---|---|---|---|---|---|
| Atrium | 16.4 | 8.2 | 5.0 | 2.8 | 1.5 | cube 1.3 |
| Lounge | 13.1 | 4.5 | 4.7 | 2.0 | 1.4 | |
| Fabrication | 32.9 | 11.9 | 5.0 | | 1.3 | |
| Navigation | 22.0 | 6.6 | 4.8 | | 1.4 | chart 0.3 |
| Library | 35.3 | 7.9 | 4.9 | 2.0 | 1.3 | |
| Comms | 10.0 | 3.9 | 4.7 | 1.2 | 1.4 | |

- **Lamp highlights** (`lampLobe`, `reflections.js:125`): with `?skip=lamps` GPU time falls 62% in Fabrication
  (50.8 to 19.3 ms, 15 lamps), 47% in the Library (8 lamps), 42% in Navigation (9 lamps). About 2 ms a lamp.
- **Environment lobes:** `?env=0` saves 4.1 ms (Atrium), 9.6 ms (Library), 10.2 ms (Fabrication). An upper bound, not removable.
- **Mirror at tier 1** is drawn at 1647x927 (0.858 of the view a side) against 1267x713 at tier 0.
- **Final pass at tier 1** costs 4.7 to 5.0 ms in every room (2.8 ms at tier 0).
- **JavaScript per frame:** Atrium 12.3 ms, Library 9.0, Navigation 6.7, Fabrication 4.4, Comms 4.7. The site's own
  code is under 0.5 ms; the rest is three.js submitting draws. The Atrium makes nine `render()` calls a frame (six for
  the orrery's cube: 3.2 ms for 24 draw calls); world-matrix updates and traversal are 2.5 ms. The Library's drone is
  about 100 meshes: about 100 of the scene pass's 143 draw calls and about 75 of the shadow pass's 86.
- **Loading:** the transcoder wasm is requested after the first texture and arrives last (asked at 1.2 s, there at 6.0 s
  at 50 Mbit/s), so 2.2 s of transcoding starts after the download. Then one main-thread task of about 4 s: 2.5 s
  waiting on shader compiles (`getProgramInfoLog`, 35 programs) and 1.4 s uploading textures.
- **Adaptation:** with nothing pinned, Fabrication stayed at full resolution with MSAA at 16 fps for 24 s. The governor
  reads frame intervals clamped to 50 ms (`main.js:411`) and frames arrived in bursts. Seen in headless Chromium only.

### 2.4 Already tried in the planning session: do not repeat

| Tried | Result |
|---|---|
| Frustum culling for baked meshes | 0 ms; the meshes are large merged groups. It also changed the Library's picture |
| No depth pre-pass in the mirror | worse by 1.4 ms (Atrium) and 6.5 ms (Library) |
| 1024 px shadow map | 1.3 ms at most, 0 in the Library |
| 64 px orrery cube | 0 ms |
| Orrery cube every other frame | 0 ms GPU; about 1.6 ms less JavaScript (estimate). See O6a |
| Skip lamps where baked visibility is 0; skip a lamp below a 1e-4 bound | 0 ms, pictures identical: the tests still walk every lamp, and a lamp is rarely that weak |
| No lamps and no clear coat in the mirror | Fabrication 7.7 ms less, but 10% of its pixels change by more than 2/255 |
| UASTC RDO at lambda 0.5 to 2 | 8 to 19% fewer bytes for about twice the texel error |
| The depth pre-pass itself | still earns 10.6 ms (Atrium) and 41 ms (Fabrication). Keep it |
| A grid of lamp lists (O4a) | pixel-identical; GPU 50.8 to 26.8 ms in Fabrication, 33.4 to 19.5 ms in Navigation. Do this |
| Load-path change (O1) | pixel-identical; first frame 16 to 23% sooner at 50 Mbit/s |

Patches and raw results of these are on the CI host under `/srv/arcadia/seed/` (section 6).

### 2.5 Versions (checked 2026-11-24; pin exactly, no `^`)

| Package | Version | State |
|---|---|---|
| `solid-js`, `@solidjs/web` | 2.0.3 | released 2026-11-17; Solid 1 lives on as `v1-latest` |
| `@solidjs/vite-plugin` | 3.0.1 | Vite 8 or 9, Node 22.12 or newer |
| `@solidjs/router` / `@solidjs/meta` | 2.0.1 / 2.0.0 | released |
| `@solidjs/testing-library` | 1.0.0-rc.2 | release candidate; 0.8.x is Solid 1 only |
| `@solidjs/diagnostics` | 2.0.3 | test gates for reactive mistakes |
| `@ui-sdk/core`, `@ui-sdk/solid` | 0.1.0-beta.16 | beta since 2026-11-12, a release every day or two; Solid 2 only |
| `vite` / `typescript` / `vitest` / `@playwright/test` | 8.3.8 / 7.0.2 / 5.1.1 / 1.65.1 | |
| `three` | 0.181.2 | stays; the vendored copy is byte-identical to npm |
| SolidStart | not used | retired by the Solid team; on Solid 1.9 only |
| `solid-three`, `solid-mdx` | not used | no Solid 2 release |

Solid ships a primer for agents in the package: `node_modules/solid-js/skills/solid-2.0/SKILL.md` and
`node_modules/solid-js/CHEATSHEET.md`. UI SDK ships its docs in `node_modules/@ui-sdk/solid/docs/` (`llms.txt`,
`core.md`, `rendering.md`). Read them before writing code for either; code written from memory of Solid 1 or React
is the main source of mistakes.

### 2.6 Reflections: what they cost, and what was measured about making them cheaper

HD 630, tier 1, 1920x1080, GPU ms. Per-pixel lamps are the `lights` of `scene.json`.

| Room | Whole frame | Floor mirror pass | Per-pixel lamps |
|---|---|---|---|
| Atrium | 31.6 | 8.2 (26%) | 0 |
| Lounge | 25.4 | 4.5 (18%) | 2 |
| Fabrication | 50.8 | 11.9 (23%) | 15 |
| Navigation | 33.6 | 6.6 (20%) | 9 |
| Library | 51.4 | 7.9 (15%) | 8 |
| Comms | 20.6 | 3.9 (19%) | 0 |

| Tried on the mirror | GPU time | Picture |
|---|---|---|
| 43% fewer pixels (`?refl=0.5`) | 2 to 4 ms less | thin light strips alias in the reflection, which is why it has this size |
| Multisampled at the smaller size, as tier 0 draws it | no less: 9.6 against 8.2 ms in the Atrium, 8.0 against 7.9 in the Library | same |
| No lamp highlights and no clear coat in the reflection | 7.8 ms less in Fabrication, 2.2 in the Library, 2.5 in Navigation | 10%, 6% and 0.2% of pixels change by more than 2/255 |
| No depth pre-pass | 1.4 ms more (Atrium), 6.5 ms more (Library) | same |

Nothing here saves time without taking something from the reflection, and the owner likes the reflections as they are
(D10). So in this program the mirror, the lamp highlights in it, the probes, the sky and the orrery's cube keep their
quality; on a slow GPU the governor trades resolution, never a reflection (O3). The mirror follows the governor's
scale, so it stays as sharp as the view. What makes reflections cheaper without losing them is in the lamps: the
lamp grid of O4a, which the mirror pass gets too (measured: 47% less GPU time in Fabrication and 42% in Navigation,
pictures identical), and for the Library's point lamps the later lamp pass (section 12).

## 3. Decisions

D4, D5, D9 and D10 are the owner's decisions of 2026-11-24. The rest are defaults the orchestrator follows unless the
owner says otherwise. "Owner" is the repository's owner.

| # | Question | Answer | Decided, or needed by |
|---|---|---|---|
| D1 | What is migrated | The page layer only. The engine is ported to TypeScript and wrapped, not rewritten | start |
| D2 | How Solid is mounted | The plugin's plain mode with our own `index.html` and `render()`, not start mode, because `tools/site.py` builds every page from that shell | F1 |
| D3 | Pages that read without JavaScript | `tools/site.py` keeps writing them, from the built shell | F1 |
| D4 | Contact | No form. Contact shows three links: LinkedIn, which is how people write to the owner; GitHub; the résumé. The mail and send modes are deleted (U6a). The field keeps its look, drawn in the scene, and the links are real links over it (U6) | **the owner, 2026-11-24** |
| D5 | Keys | Escape, Enter and the left and right arrows keep their meaning. Tab reaches the room's things; arrows move among them by position while one has focus; Enter acts | **the owner, 2026-11-24** |
| D6 | Styling | Plain CSS with today's custom properties. UI SDK parts are unstyled and get our classes. No Tailwind, no `web.css` | U0 |
| D7 | three.js | Stays at 0.181.2 for the whole program | start |
| D8 | Tooling | pnpm, Node 24, TypeScript 7, oxlint with `eslint-plugin-solid`, Vitest 5, Playwright's test runner | F1, F2 |
| D9 | Lamp highlights | This program makes one attempt that leaves the picture alone and keeps it only if the gain is significant ("significant" is read here as 10% of a room's GPU time; the owner may set another bar). That attempt is the lamp grid of O4a, whose prototype measured 42 to 47% in the two rooms it applies to. What is left, the Library's point lamps above all, is a later pass (section 12) | **the owner, 2026-11-24** |
| D10 | Mirror at tier 1 | Stays as it is: the owner likes its realism, and nothing measured saves time without taking from it (2.6). O5 prepares pictures and numbers, and the owner talks them through with the orchestrator while the run goes on. Nothing waits for it | **the owner, 2026-11-24** |
| D11 | Agent bridge | Built behind a switch in `content.json`, off by default | G4 |
| D12 | Where the result goes | A pull request from `prog/int` to `explore/rolling-earth`. Only the owner merges it. Never `main` or `v2-rewrite` | G5 |
| D13 | Reference machines | CI host for regression gates; the laptop's HD 630 for the numbers in the optimization report | I2 |

Record every change of a default, and every new decision, in `docs/program/decisions.md` with date, who decided and why.

## 4. Target architecture

### 4.1 Layout

```
index.html            the shell; Vite's entry. tools/site.py builds every page from the built copy
src/
  main.ts             creates the station (engine) and mounts the page layer
  engine/             three.js. No DOM except the canvas
    station.ts        the boundary: createStation(canvas, content, site) -> Station (4.2)
    types.ts          Pick, Source, Way, RoomInfo, Content, SiteData
    loop.ts camera.ts picking.ts governor.ts mirror.ts          (from main.js)
    room/             loader, materials, scene graph, picks      (from room.js, task F5)
    reflections.ts sunlight.ts post.ts screens.ts hologram.ts routemap.ts drone.ts
    reader3d.ts opening/ comms3d.ts display3d.ts kit/
  app/                Solid 2
    main.tsx  state/  routes/  components/
    ui/               our wrappers of UI SDK components, one file each; the only place that imports @ui-sdk/solid
  content/site.ts     furnish(): content.json and the generated JSON -> what the rooms say (from js/site.js)
  styles/             tokens.css and one stylesheet per component
  pages/              blueprint and asset, the two other pages
public/               copied as it is: content.json, robots.txt, _headers, 404.html, vendor/basis/, assets/<room>/ (generated)
tests/e2e/            Playwright specs, fixtures, page objects. Unit and component tests sit beside their sources
tools/ci/             run.sh (the check tiers), preview.sh, serve.sh, budgets.json
dist/                 build output (ignored): Vite's files under /app/, then the pages tools/site.py writes
```

### 4.2 The engine boundary

A sketch for task F3 to finish. The engine exposes values that anything can read and subscribe to, with no framework in
them; `src/app/state/station.ts` turns them into signals.

```ts
type Readable<T> = { get(): T; subscribe(fn: (value: T) => void): () => void }

interface Station {
  start(): void
  dispose(): void

  // rooms
  enter(id: RoomId): Promise<void>
  room: Readable<{ id: RoomId | null; status: 'loading' | 'ready' | 'failed'; progress: number; label: string; error?: string }>

  // what the visitor is looking at
  focus(pick: PickId | null): void
  back(): void
  step(direction: 1 | -1): void                 // the tour
  focused: Readable<null | {
    pick: PickId; name: string; verb: string; aside: boolean; steady: boolean; backLabel: string
    tour: { index: number; count: number }
    ways: { label: string; to: RoomId | '' }[]  // a door's stops; '' is not built yet
    options: { label: string; sub?: string }[] | null; current: number
    canRead: boolean; readLabel: string
  }>
  choose(option: number): void
  travel(to: RoomId): void
  read(): void

  // the room's things, for the display, the keyboard, a screen reader and an agent
  picks: Readable<{ id: PickId; name: string; verb: string; kind: PickKind; cue?: { pointer: string; touch: string } }[]>
  pointed: Readable<PickId | null>              // under the pointer
  rectOf(pick: PickId): Rect | null             // CSS px in this frame; null when it is not to be marked

  // reading: DOM that sits in a frame the engine draws
  reader: Readable<{ state: 'closed' | 'scanning' | 'open'; url: string | null; title: string | null; phone: boolean; reveal: number }>
  readAt(url: string, options?: { fly?: boolean }): Promise<boolean>
  closeReader(): void
  frameOf(what: 'reader'): null | { width: number; height: number; transform: string }

  // Contact: the field is drawn in the scene; its links are real links laid over their drawings
  contact: Readable<{ open: boolean; links: { label: string; note: string; url: string }[] }>
  contactLinkRect(index: number): Rect | null   // CSS px in this frame

  // the page tells the engine what it covers, instead of being measured
  setCovered(region: 'bar', rect: Rect | null): void

  view: Readable<'wide' | 'close'>
  setView(view: 'wide' | 'close'): void
  turn: TurnApi | null                          // the route map, in the room that has one
  onFrame(callback: (seconds: number) => void): () => void   // after the camera is placed, before the draw
  debug: StationDebug                           // what window.__lobby gives the tests today
}
```

Rules that keep the two halves apart:

- The engine never reads or writes the DOM, and never imports from `src/app`.
- The page layer never reads a signal inside `onFrame`. What follows the camera (the lock, the cue, the reader's frame,
  Contact's links) is written through element refs in an `onFrame` callback.
- Solid 2 applies writes in a microtask: after `setX(v)`, `x()` and the DOM still show the old value until the
  microtask or `flush()`. Nothing may depend on reading the DOM on the line after a state change. In tests, call
  `flush()` before asserting.

### 4.3 The page layer

| Region | Today | Becomes (UI SDK part) | Task |
|---|---|---|---|
| Nav, view toggle | `fillHud` `innerHTML` | links; Segmented Control | U2 |
| Hero, facts, hint | `fillHud`, `tick`, `paintHint` | components; Button for the call to action | U2 |
| Inspect bar | bar half of `setFocus`, click handler | Toolbar, Button, Menu (a door with several stops), Listbox (volumes), Drawer on a phone | U3 |
| The room's things | pointer and arrow keys only; lock and cue are `aria-hidden` | our own primitive from roving focus, `spatialMove` with rectangles from `rectOf`, selection, announcements | U4 |
| Reader's frame | `reader.js` `innerHTML`, per-frame matrix | region with title and CLOSE, contents list, Scroll Area, Progress, Toast for "copied" | U5 |
| Contact | three modes chosen by data; words and controls drawn into a canvas, real elements made by `comms.js` over them | links only (U6a); the field stays drawn in the scene, and its three links are the page layer's, laid over their drawings | U6a, U6 |
| Cover, offer, failures | `#loader`, `#stepin`, `fail()` | Progress, Button | U7 |
| Addresses | `route`, `syncUrl`, `popstate` in `main.js` | `@solidjs/router` | U8 |

Wall screens, the hologram, the route map's sheets and the READ glyph are drawn in the scene and stay there.

### 4.4 Build, pages and deploy

`pnpm build` runs `vite build` and then `python3 tools/site.py --shell dist/index.html --out dist`. Vite's files go
under `/app/` (`build.assetsDir`), because `/assets/<room>/` belongs to the baked rooms. `wrangler` publishes
`dist`. In development `tools/site.py --shell index.html --out public` writes pages that load `/src/main.ts` from
the dev server.

### 4.5 Checks

| Tier | What | When | Budget on the CI host |
|---|---|---|---|
| `static` | type check, lint, Python content checks and unit tests, `site.py` | every push | 1 min |
| `unit` | Vitest in Node: pure logic (governor, routes, `furnish`, turn physics) | every push | 30 s |
| `component` | Vitest in Chromium: `src/app`, UI SDK `checkPattern`, diagnostics gates | page-layer changes | 2 min |
| `e2e` | Playwright against `dist`: desktop, phone, reduced motion; plain pages with JavaScript and WebGL off | before merge | 15 min |
| `pictures` | deterministic pictures against the base commit's | engine changes; every gate | 5 min |
| `perf` | frame and GPU ms, per-pass, CPU profile, throttled load, unpinned visit, against `tools/ci/budgets.json` | O tasks; every gate | 15 min, alone |

Until F1 and I5 land, the tiers are the ones in section 6.

## 5. Ways of working

### 5.1 Branches and pull requests

```
explore/rolling-earth      the owner's line. No agent merges into it
  prog/int                 integration. Only the orchestrator merges into it
    prog/ws-infra          checks and test tooling          (tasks I*)
    prog/ws-opt            optimization pass                (tasks O*)
    prog/ws-found          build, TypeScript, boundary      (tasks F*, D*)
    prog/ws-ui             page layer and its tests         (tasks U*, T*)
      prog/<ID>-<slug>     one task: cut from its workstream branch, one pull request back into it
```

- A task pull request targets its workstream branch and is squash-merged. Always pass `--base` to `gh pr create`: the
  repository's default branch (`v2-rewrite`) is a different site and must never be a target.
- A workstream branch goes into `prog/int` by pull request with a merge commit, at a gate or as soon as another
  workstream needs its work. Right after, `prog/int` is merged into every other workstream branch. Shared branches are
  never rebased or force-pushed.
- Every branch is pushed to two remotes: `origin` (GitHub, for pull requests) and `ci` (the CI host, for checks).
- The repository is public and has no hosted CI on this line. Do not add a self-hosted runner. Checks are run by agents
  on the CI host and reported in the pull request.
- `explore/rolling-earth` may move while the program runs (the owner and other sessions work on it). At every gate the
  orchestrator merges it into `prog/int` and tells the owner if that conflicts. Other branches and worktrees of this
  repository (`review/*`, `feat/*`, `opt/*`) belong to someone else: leave them alone.

### 5.2 The orchestrator's loop

1. From section 7, pick tasks whose dependencies are merged and whose files are free (5.6), up to five at a time.
2. For each, start a subagent in its own git worktree with the brief of section 10.
3. When its pull request is open: re-run one of its tiers on the pull request's head to check the evidence, and start a
   second agent as reviewer (5.8).
4. Merge when the card's completion criteria are met; sync branches as in 5.1; update `docs/program/status.md`.
5. At a gate (section 9) run everything the gate lists, open the gate's pull request and ask the owner where it says so.

If a subagent ends without a mergeable pull request, read its report: brief a fresh agent once with what went wrong, or
split the card. If the second attempt fails too, stop that card and tell the owner what blocks it. Do not let a blocked
card hold the others: only its dependants wait.

### 5.3 A task from start to finish

1. `git fetch origin`; create a worktree on `prog/<ID>-<slug>` from the workstream branch.
2. Read the card, the files it names and the documents it points to. Measure the "before" if the card asks for numbers.
3. Work in small commits. Run the cheap tiers often: `git push ci HEAD:prog/<ID>-<slug> && ssh arcadia-ci ci prog/<ID>-<slug> static`.
4. Before opening the pull request, merge the workstream branch into yours and run every tier the card lists.
5. `git push origin`, then `gh pr create --base prog/ws-... --title ... --body-file ...` using the template in section 10.
6. Answer the review. The task is done when the pull request is merged, not when it is opened.

### 5.4 Commits, pull requests, and what must not be written down

- Commit subjects follow this repository's own style: a plain sentence saying what the site or the tool now does
  (read `git log`). No type prefixes. The body says why, and what was measured. Keep the attribution trailer.
- The repository is public. Never write an address, a host name, a token, an e-mail address or anything about the
  network into a commit, a pull request, a comment or a file. Say "the CI host" and use the SSH alias. `.env` holds a
  token that no task needs: do not read it, print it or commit it.

### 5.5 Evidence

- A number is the median of at least three runs, with the runs listed. Before and after are measured in the same
  session on the same machine.
- For a change to GPU work, GPU ms from the timer query is the figure that counts. Frame ms is reported beside it.
- "Pixel-identical" means a maximum difference of 0 on every state in the pictures list (task I2), not "looks the same".
- A gain inside the run-to-run spread is no gain: close the pull request with the numbers in the report (O8), do not merge it.
- Anything that changes a picture on purpose needs before and after pictures and the owner's yes (section 9).

### 5.6 Who may edit what

| Paths | Owner |
|---|---|
| `tools/ci/**`, `tools/d*.sh`, `tools/docker/detsnap.mjs`, `tests/e2e/**` harness files | ws-infra, T1 |
| `public/js/**`, `public/main.js`, `tools/pack.py` (until F1); `src/engine/**` (after) | ws-opt for the functions its cards name; U6a for `comms.js`; ws-found for everything else |
| `src/app/**`, `src/styles/**`, `tests/e2e/**` specs | ws-ui, one region per task |
| `tools/site.py` and its tests | U6a (the contact page and `profile.json`), F1 (the `--shell` option), U10 (run-time ids); nobody else |
| `docs/program/status.md`, `docs/program/decisions.md` | the orchestrator |
| `docs/v1-contracts.md`, `README.md` | each task updates the lines about what it changed; D1 does the final pass |

- Two open tasks never edit the same function. Where two cards name the same function, the card says which goes first.
- **Layout freeze (F1):** no pull request with changes under `public/main.js`, `public/js/`, `public/index.html` or
  `public/*.css` may be open while F1 is produced and merged.
- **Boundary freeze (F3):** while F3 is open, nobody else edits `src/main.*` or the files F3 splits.
- After F3, a change to `src/engine/types.ts` or the `Station` interface needs a line in `decisions.md` and a note to
  every open ws-ui task.

### 5.7 Stop and ask the orchestrator (who asks the owner where needed)

- A picture changes and the card did not say it would.
- The baseline is red before you start, or a test fails that your change cannot explain.
- The card needs a dependency, a file or an interface change it does not list.
- A test would have to be deleted or weakened rather than rewritten.
- The work is turning out more than twice the size the card suggests.
- A package's release-age or audit policy blocks an install. Do not loosen the policy.

### 5.8 Review

A second agent reviews each pull request against the card: are the completion criteria met, is the evidence real (it
re-runs one check), did anything outside the card's paths change, is there private information, do the docs say what
the code now does. Style is the linter's business.

### 5.9 Done, for every task

- The card's completion criteria are met and shown in the pull request.
- `static` is green; the tiers the card names are green on the pull request's head merged with its base.
- Tests exist for the behaviour that was added or changed. No test was removed without a replacement.
- The type-check baseline did not grow (after F2).
- Docs that describe the changed thing are updated in the same pull request.
- "Found but not fixed" in the pull request lists what was noticed outside the card.

## 6. Environment

**The CI host.** A machine set aside for this program (Ubuntu 26.04, 20 threads, 62 GB, Intel Iris Xe graphics),
reached from the laptop as `ssh arcadia-ci`. How it is held and released is in the operator's notes, not in this
repository. Installed: Docker with `mcr.microsoft.com/playwright:v1.64.1-noble`, Node 24.22.3, pnpm 12.23, Python 3.14,
and the packing tools (`tools/get-pack-tools.sh`).

| On the host | What it is |
|---|---|
| `/srv/arcadia/repo.git` | bare repository; the remote `ci` in the laptop's clone |
| `ci <ref> <tier> [args]` | runs one tier on a pushed commit, in a clean copy. Prints `ci <tier> <sha> PASS or FAIL <seconds>s <job folder>` |
| `/srv/arcadia/jobs/<job>/` | `log.txt`, `result.json`, `out/` (pictures) for each run |
| `/srv/arcadia/cache/assets/` | packed rooms, keyed by the commit's `assets-src` tree and `tools/pack.py`; made once (about 4 minutes), then reused |
| `preview <ref> [port]` | serves a commit on a port of the host (8080 by default), for looking at it in a normal browser |
| `/srv/arcadia/seed/` | from the planning session: `perf-tools/` (measuring scripts), `patches/` (the prototypes of section 2.4), `baseline-hd630/` (raw results), `baseline-ci-host/` |

Tiers the host script knows today (task I1 moves them into `tools/ci/run.sh`, which the host script calls when a
commit has it):

| Tier | Runs | Measured on the base commit |
|---|---|---|
| `static` | `tools/content.py`, the Python unit tests, `tools/site.py` | pass, 14 s |
| `smoke` | `errs.mjs` for the six rooms | pass, 29 s |
| `script <name.mjs> [args]` | one script of `tools/docker/` as `tools/dtest.sh` runs it | |
| `suite` | `tools/check.sh` | pass, all 50 steps, 51 min one after another |
| `bench "<query>" [runs] [seconds]` | `bench.mjs`: frame and GPU ms, draw calls, memory, bytes | section 2.2 |
| `snap <name> <state=query>...` and `pdiff <a> <b>` | deterministic pictures and their difference | |

Browser tiers hold one lock, so jobs from different branches never share the GPU. `bench` waits until nothing else is
running on the host and keeps it to itself.

**The laptop** is where agents edit, commit and open pull requests, and where the HD 630 lives. Measurements there run
one at a time through `tools/ci/hd630.sh` (task O0; until it exists, only the orchestrator measures there, with
`tools/dtest.sh` and the scripts of the seed folder). The laptop also runs services the CI host depends on: keep
builds and suites off it.

**Preview.** Port 8080 on the CI host always shows `prog/int` (the orchestrator runs `preview prog/int` after each
merge). Ports 8081 to 8089 are for a task branch the owner is asked to look at. The host's address for the owner's
browser comes from the laptop's SSH configuration (`ssh -G arcadia-ci`); it is told to the owner in the session and
never written into a pull request or a file. A person with a real browser is the only
check for what headless Chromium cannot show: frame pacing, touch, the feel of a transition.

## 7. Order of work

"->" means "must be merged first". A column lists tasks that can be open at the same time; the orchestrator runs at most
five implementing agents at once and starts the next task as one finishes.

**Wave 0, the orchestrator alone.** P0: create `prog/int` from `explore/rolling-earth` and the four workstream
branches; commit this plan with an empty `docs/program/status.md` and a `decisions.md` that starts with the owner's decisions of
section 3; push to both remotes; run
`static`, `smoke` and `suite` on `prog/int` and note the result; `preview prog/int`.

**Wave A, on today's layout.** The optimization pass and the tooling, while the page layer is specified.

| First | Then | Then |
|---|---|---|
| I1, O1, O3, O6b, U0 | I2, O0, O2, O4a, O6a, U0b, U6a | I3, I4, O5, O6c, O6d, U0c, T1 |

- I1 -> I2, I3, O0, T1. I2 -> O6c, O6d. O0 -> O5. O1 -> O2. O6b -> O6a (both edit `draw()`) and U6a. U0b -> U0c. O2 -> O7 (before F1, D18).
- O3, O6a, O6b all edit `public/main.js` in different functions: merge the workstream branch into yours before the pull request.
- Until I2 has landed, "pictures 0" is shown with the host's `snap` and `pdiff` tiers on the states of `tools/detsnap.sh`
  (the Atrium, the Lounge, Fabrication, Navigation), base commit against yours.

**Gate G1**, then **the layout freeze**: F1 is produced on the tip of `prog/int` with nothing else open and merged
(**gate G2**), and `prog/int` is merged into every workstream.

**Wave B, on the new layout.**

| First | Then |
|---|---|
| F2, O7 | I5, F3 (after F2, O3, O6a, O6b) |

**Gate G3** (the boundary is frozen and the owner has signed the page-layer spec), then:

**Wave C.** U1 and F4a, F4b, F4c, F4d at the same time (U1 edits no engine file). Then one region each: U2, U3 and U7
as soon as U1 is merged; U4 and U5 also wait for F4c, and U6 for F4d, because they take the last DOM lines out of the
files those batches convert.

**Wave D.** U8 (after U2 to U7), F6 (after the F4 batches), F5 (after F6 and O1 to O7), U9, U10, D1, D2, D3, O8.

**Gates G4 and G5.**

The longest chain: P0 -> I1 -> G1 -> F1 -> F2 -> F3 -> U1 and F4c -> U5 or U6 -> U8 -> G4 -> G5. Protect it: when F1, F3 or U1 is
ready to start, it takes the next free agent.

### 7.1 Every card, with what it waits for

"After" is what must be merged before the card starts; P0 is the orchestrator's own first step. A card of one
workstream that waits for a card of another needs that workstream merged into `prog/int` and `prog/int` merged into
its own (5.1).

| ID | Card | Workstream | Wave | After | Size |
|---|---|---|---|---|---|
| I1 | The checks live in the repository | infra | A | P0 | M |
| I2 | Golden pictures and the recorded baseline | infra | A | I1 | M |
| I3 | The browser suite runs in parallel | infra | A | I1 | M |
| I4 | The team's working files | infra | A | P0 | S |
| I2b | Pictures that never flake | infra | B | I2 | S |
| I5 | Checks for the built site | infra | B | F2 | S |
| O0 | The measuring tools are in the repository | opt | A | I1 | S |
| O1 | The load path wastes no time | opt | A | P0 | S |
| O2 | Textures are requested as soon as scene.json is read | opt | A | O1 | M |
| O3 | The governor measures the GPU | opt | A | P0 | M |
| O3b | Loading hitches do not lower the quality | opt | A2 | O3, O7 | M |
| O4a | A pixel walks only the lamps that can reach it | opt | A | P0 | M |
| O5 | The mirror at tier 1: pictures and numbers for a talk with the owner | opt | A | O0 | S |
| O6a | The orrery's reflection costs less CPU | opt | A | O6b | S |
| O6b | World matrices are updated once a frame | opt | A | P0 | S |
| O6c | The Library's drone is a few meshes | opt | A | I2 | M |
| O6d | One primitive for each baked group | opt | A | I2 | S |
| O7 | Stream textures: small levels first, one file per layer | opt | A2 | O2 (before F1) | L |
| O8 | The report and the budgets | opt | D | every other O task | S |
| F1 | A build step, and nothing else changes | found | freeze | gate G1, during the layout freeze | L |
| F2 | Type check, lint and unit tests, as a ratchet | found | B | F1 | M |
| F3 | The engine behind one boundary | found | B | F2, O3, O6a, O6b | L |
| F4a to F4d | Engine modules to TypeScript | found | C | F3 | M each |
| F5 | loadRoom in parts | found | D | F6 and O1 to O7 | L |
| F6 | One home for the repeated helpers | found | D | F4a to F4d | M |
| F7 | Without WebGL the page still reads | found | B | F1 | S |
| D1 | The contract and the README describe the new page | found | D | U8 | M |
| D2 | Deploy | found | D | F1 | S |
| D3 | Dependencies and how they are raised | found | D | U1 | S |
| U0 | What the new page layer is | ui | A | P0 (finished once U0c has reported) | M |
| U0b | Does the stack hold together (a spike, thrown away) | ui | A | P0 | S |
| U0c | The room's things as a primitive (a spike) | ui | A | U0b | M |
| T1 | End-to-end tests on Playwright's runner | ui | A | I1 | M |
| U1 | The page layer's skeleton | ui | C | F3 and gate G3 | M |
| U2 | Brand, nav, hero, facts, hint | ui | C | U1 | M |
| U3 | The inspect bar | ui | C | U1 | M |
| U4 | The room's things: keyboard, screen reader, lock and cue | ui | C | U1, U0c, F4c | L |
| U5 | The reader's frame | ui | C | U1, F4c | L |
| U6a | Contact offers three links and nothing else | ui | A | O6b | M |
| U6 | Contact's links belong to the page layer | ui | C | U1, F4d | M |
| U7 | The cover, the offer, failures and the page's three modes | ui | C | U1 | M |
| U8 | Addresses on the router, and the old shell goes | ui | D | U2 to U7 | L |
| U9 | An agent can use the rooms (behind a switch) | ui | D | U4 | M |
| C1 | Comments out | found | B | O7, flicker fix | M |
| U10 | Styles and leftovers | ui | D | U8 | S |
| U11 | The plain pages come from Solid at build time | ui | D | F1, U5 | L |

## 8. Task cards

Sizes: S is one area and under about 150 changed lines; M up to about 600; L is larger or cuts across areas and starts
with a short design note in the pull request. Every card also carries the rules of 5.9. There are 44 cards: 13 small,
24 medium, 7 large; with a reviewer for each, about 90 agent runs. The owner is asked at four gates (section 9).

### Workstream ws-infra

#### I1 · The checks live in the repository
Branch `prog/I1-ci-in-repo` · after P0 · size M

- **Context.** The host's `ci` script has the tiers for today's layout built in and hands over to `tools/ci/run.sh`
  when a commit has one. `tools/dtest.sh` copies its scripts into a Docker volume shared by all runs, so two jobs at
  once can run each other's scripts. Five helpers (`tools/dbench.sh`, `derr.sh`, `detsnap.sh`, `dperf.sh`, `dshot.sh`)
  and three scripts (`tools/docker/snap.mjs`, `ringline.mjs`, `rooms.mjs`) default to an origin on a private address
  instead of serving the checkout themselves, `docs/rolling-earth-plan.md` quotes that address, and `tools/dtest.sh`
  takes the packed rooms from an absolute path on the laptop.
- **Goal.** The repository owns its checks, and no script depends on a host address, one machine's paths or a shared
  writable volume.
- **Notes.** `tools/ci/run.sh <tier> [args]` with the tiers of section 6 (the host passes `CI_JOB` and `CI_HOME`);
  `tools/ci/preview.sh` and `serve.sh`; every Docker helper serves the checkout inside the container and copies its
  scripts to a folder of its own; `tools/ci/README.md` lists the tiers. The host script's source is in
  `/srv/arcadia/bin/ci`.
- **Done when.** `static`, `smoke`, `bench`, `snap` and `pdiff` pass through the in-repo script; two `script` jobs
  started together both pass; `git grep -nE "\b10\.[0-9]+\.[0-9]+\.[0-9]+\b" -- tools docs README.md` finds nothing
  (the address stays in the history; whether to rewrite that is the owner's question, and this card does not).

#### I2 · Golden pictures and the recorded baseline
Branch `prog/I2-pictures` · after I1 · size M

- **Context.** `tools/docker/detsnap.mjs` takes deterministic 1920x1080 pictures (fake clock, seeded random). Two runs
  of one commit differ by 0 in the Atrium, Fabrication and Navigation. The Library does not: in the planning session
  its hero picture differed between runs of the same code by up to 217 on 0.5% of pixels.
- **Goal.** A `pictures` tier that every engine change can be held to, in all six rooms.
- **Notes.** A fixed list: each room's hero at tier 0 and tier 1, the close shot, one inspect pose, a reading open, the
  Contact field open, the Library with a book open, the sky at two angles in the rooms with a window. Find what makes
  the Library differ (the drone, its environment map, a time source) and fix or pin it. `ci <ref> pictures
  [--against <base>]` renders what is missing, compares and fails above a maximum of 0. Goldens are kept on the host
  by commit and list hash. Record the baseline of both machines in `docs/program/baseline.md`.
- **Done when.** The same commit run three times gives 0 on every state; the baseline file has section 2.2 for both
  machines with the commands to reproduce it.

#### I3 · The browser suite runs in parallel
Branch `prog/I3-parallel-suite` · after I1 · size M

- **Context.** `tools/check.sh` runs 50 steps one after another, each in its own container: 51 minutes on the CI host,
  all passing on the base commit. The long ones: `rooms.read.mjs all` 11 min, `rooms.others.mjs` 10 min, `hud.mjs all`
  5 min, `opening.mjs all` and `contact.mjs all` 3 min each; the 27 steps before the first room is opened take 3 min
  together. Most steps are functional and do not care about frame times; the CI host has 20 threads. Scripts that take
  a profile (`desktop`, `phone`, `reduced`, `all`) can be split by profile.
- **Goal.** The whole functional suite in 15 minutes or less on the CI host, without flakiness.
- **Notes.** Run independent steps four at a time inside one job that holds the GPU lock once; keep the steps that
  measure motion or stillness (parts of `hud.mjs`, `turn.mjs`, `cue.mjs`) alone; print each step's time.
- **Done when.** Five full runs in a row are green; wall time is 15 minutes or less; the pull request lists the steps
  that stayed serial and why.

#### I4 · The team's working files
Branch `prog/I4-working-files` · after P0 · size S

- **Context.** A subagent starts knowing nothing of this plan, and agent tools read a file at the root of the
  repository before anything else. This line has no `AGENTS.md`, no `CLAUDE.md` and no `.github/`.
- **Goal.** `AGENTS.md` at the root (section 5 in short, the layout of 4.1, the commands of section 6), and a one-line
  `CLAUDE.md` that points to it;
  `docs/program/pr-template.md` (section 10; GitHub reads its own template only from the default branch, so agents
  pass this file to `gh pr create --body-file`); `docs/program/status.md` and `decisions.md` with their headings.
- **Done when.** An agent given only `AGENTS.md` and a card can push a branch, run a tier and open a correct pull request.

#### I2b · Pictures that never flake
Branch `prog/I2b-steady-pictures` · after I2 · size S

- **Context.** Three times on 2026-11-25 one of the 34 states differed by a few pixels once and matched on every rerun
  (`comms-contact`/`comms-hero-t1` earlier, `lobby-inspect` max 66 on 2 px, `lobby-sky-180` max 4). A flaky gate
  teaches people to rerun instead of read.
- **Goal.** Find what is not settled when a state is captured (texture transcodes or layer uploads still in flight, a timer
  read, a frame counted from an animation) and wait for it or pin it.
- **Done when.** `pictures` on one commit, 20 runs across both CI hosts, every state max 0 every time; the cause named.

#### I5 · Checks for the built site
Branch `prog/I5-built-tiers` · after F2 · size S

- **Context.** After F1 the site is built before it is served, and after F2 there are a type check, a linter and unit
  tests; the tiers of I1 know none of that yet.
- **Goal.** The tiers of 4.5 in `tools/ci/run.sh`: `static` grows a type check and lint, and `build`, `unit`,
  `component` and `e2e` are added (`e2e` runs the specs of `tests/e2e/` against `dist`); `preview.sh` builds and
  serves `dist`.
- **Done when.** Every tier runs on `prog/int` within the budget of 4.5.

### Workstream ws-opt

Every card here reports before and after as in 5.5, on the CI host and on the HD 630 (`tools/ci/hd630.sh`; through
the orchestrator until O0 has landed).

#### O0 · The measuring tools are in the repository
Branch `prog/O0-measuring-tools` · after I1 · size S

- **Context.** `/srv/arcadia/seed/perf-tools/` holds the planning session's scripts: `passes.mjs` (GPU ms, JavaScript
  ms and draw calls of each render pass), `cpuprof.mjs` (JavaScript self time per function per frame), `unpinned.mjs`
  (what an unpinned visit settles at), `load.mjs` (first frame over a throttled link), `loadprof.mjs` (where load time
  goes: long tasks, GL calls, transcodes), `blurdiff.mjs`.
- **Goal.** They become `tools/docker/` scripts behind a `perf` tier, and `docs/opt-pass-2-report.md` starts with the
  method and the baseline of section 2. `tools/ci/hd630.sh <ref> <perf arguments>` runs the same tier on the laptop's
  HD 630 under a lock, so that any task can get the numbers that count for GPU work, one run at a time.
- **Notes.** `hd630.sh` waits for its lock, serves the commit from a clean copy as the host's `ci` does, and writes
  the load average before and after into its result; a run taken while the laptop was busy is marked unusable.
- **Done when.** `ci <ref> perf passes|cpuprof|unpinned|load|loadprof ...` run; on the base commit the Atrium's numbers
  are within 5% of `baseline.md` on the CI host, and of section 2.2 through `hd630.sh`; two `hd630.sh` runs started
  together run one after the other.

#### O1 · The load path wastes no time
Branch `prog/O1-load-path` · after P0 · size S · owns the loading code of `public/js/room.js` (lines 32 to 50 and 565 to 570)

- **Context.** Section 2.3, "Loading". The prototype is `/srv/arcadia/seed/patches/fastload3.diff`, five changed lines:
  `ktx2.init()` as soon as the loader exists; a worker count from the core count; `renderer.initTexture(t)` when a
  texture arrives; `renderer.compile(scene, camera)` with a render target bound, before the textures are awaited.
  Measured with it at 50 Mbit/s: Atrium 11.1 to 8.5 s, Lounge 10.2 to 8.6 s, Library 10.1 to 8.2 s; pictures identical.
  Do not use `compileAsync`: it polls with timers, which stalls `detsnap`'s fake clock. In the prototype 8 of 43
  programs were still compiled at first use: find which and why.
- **Goal.** Land it for all six rooms.
- **Done when.** Pictures 0; first frame at 50 Mbit/s and 20 ms improves by 15% or more in the Atrium, the Lounge and
  the Library; with no network limit it is not slower; the longest main-thread task before the first frame on the
  HD 630 is 1.5 s or less (it was 4.0 s).

#### O2 · Textures are requested as soon as scene.json is read
Branch `prog/O2-early-textures` · after O1 · size M · owns the same code as O1

- **Context.** `loadRoom` awaits `scene.json`, then `room.glb`, and only while building materials asks for the first
  texture (at 1.05 s on a 50 Mbit/s link; at 3.3 s on 10 Mbit/s, after a 1.5 s download of the geometry). Every name is
  already in `scene.json`: `groups`; `_c` for `chand.layered`; `_a` and `_s` for `spin.layered`; `_f` for
  `finish.groups`; `backdrop` with a `portal`; `probe_c` with a probe.
- **Goal.** Geometry and textures download together.
- **Notes.** Make `bakeTex` return one uniform per name; request the predicted names right after `scene.json`; when the
  room is built, fail loudly in development if a name was predicted and not used, or used and not predicted.
- **Done when.** Pictures 0; the same URLs are requested, each once; the Atrium's first frame improves by 1.0 s or more
  at 10 Mbit/s and by 0.3 s or more at 50 Mbit/s against O1.

#### O3 · The governor measures the GPU
Branch `prog/O3-governor` · after P0 · size M · owns `Governor` in `public/js/post.js` and the governor lines of `frame()`, `setTier` and `applyScale` in `public/main.js`

- **Context.** Section 2.3, "Adaptation". `Governor` (`post.js:155`) averages the `dt` that `frame()` clamps to 50 ms
  (`main.js:411`), so its "ignore anything over 250 ms" branch can never fire and a stalled frame counts as 50 ms.
  `EXT_disjoint_timer_query_webgl2` is available in Chromium (the bench uses it). Nothing is remembered between rooms
  or visits. What a windowed browser does could not be checked from the planning session.
- **Goal.** The resolution and tier settle within seconds whatever way the browser paces frames.
- **Notes.** A pure controller (in: GPU ms per frame where the timer query exists, otherwise unclamped frame intervals;
  out: tier and scale) with unit tests on recorded traces (steady, bursty, a hitch, a tab switch); the wiring around
  the frame; the last good tier and scale per room in `localStorage` as the starting point. `?scale=` and `?tier=`
  stay exact. The governor changes the tier and the scale only: it never turns a reflection off and never makes the
  mirror smaller against the view (D10).
- **Done when.** Controller tests pass; pictures 0 with the pins; an unpinned visit on the HD 630, in every room: within
  6 s of the cover lifting the mode stops changing for 20 s, and the rate is 50 fps or more or the scale is at its
  floor; a second visit starts at the remembered mode; with the extension hidden there is no error. The pull request
  asks the owner to look at `preview` in a real browser.

#### O3b · Loading hitches do not lower the quality
Branch `prog/O3b-governor-load` · after O3 and O7 · size M · owns `public/js/governor.js`, `tools/test_governor.mjs`, and the governor's wiring in `public/main.js` and the room loader's upload count

- **Context.** O3's governor lowers resolution and tier when a few slow frames during loading (texture transcodes and uploads) lift the frame-interval average, even when the GPU timer shows headroom; lower resolution makes thin bright edges shimmer, which the owner saw.
- **Goal.** With a GPU timer, loading hitches and texture-upload frames do not lower the quality; a room that fits the budget climbs back within seconds; a room just over budget settles without oscillating; without a timer the fallback behaves as before; a drop that is not held is not remembered.
- **Done when.** Unit tests for each case pass in `ci static`; an unpinned 30 s visit to every room on both CI hosts is no worse than before (3 interleaved runs); under a 12x CPU throttle during load, rooms keep full quality where the base drops them; pictures 0; suite and e2e pass.

#### O4a · A pixel walks only the lamps that can reach it
Branch `prog/O4a-lamp-grid` · after P0 · size M · owns the lamp code of `public/js/room.js` (lines 108 to 112 and where `lampU` is used) and `lampLobe` in `public/js/reflections.js`

- **Context.** Section 2.3, "Lamp highlights". `lampLobe` (`reflections.js:125`) walks every lamp of the room for
  every pixel of every finished surface, again where there is a clear coat (`room.js:173`), once on the floor
  (`room.js:229`), and all of that once more in the mirror. Fabrication has 14 spots of 20 to 30 degrees and one
  point lamp; Navigation has 9 spots. A point of either room lies inside 1 to 4 of those cones, and a lamp adds exactly
  nothing outside its cone. The Library's 8 lamps and the Lounge's 2 are point lamps: they reach everywhere.
  The owner's decision (D9): this is the program's one attempt at the cost of lamps.
- **Measured in the planning session** (HD 630, 1920x1080, tier 1, hero view; medians of six runs, GPU ms / frame ms):

  | Room | Today | Grid, a fixed count per pixel | Grid, stopping at the first empty slot |
  |---|---|---|---|
  | Fabrication (15 lamps, at most 6 in a cell) | 50.8 / 57.4 | 35.6 / 42.4 | 26.8 / 33.0 |
  | Navigation (9 lamps, at most 3 in a cell) | 33.4 / 42.5 | 23.9 / 32.9 | 19.5 / 25.9 |

  Pictures: maximum difference 0 on the hero and close views of both rooms at tier 1, and on their tier 0 views.
  The patch is `/srv/arcadia/seed/patches/lampgrid.diff` (37 added lines; it applies to `6390b52`), the runs are in
  `/srv/arcadia/seed/baseline-hd630/lampgrid.txt`.
- **Goal.** Land it. When a room is built, a grid over it (cells of about 1 m) records for each cell the lamps whose
  cone can reach it, in a small 3D texture; `lampLobe` reads its cell and walks only that list.
- **Notes.** The prototype's grid covers the probe box and 3 m around it: cover the scene's own bounds, so that nothing
  lit lies outside it. A cell's lamps keep their order, so the sums add up in today's order. A room where every cell
  would list every lamp (the Library, the Lounge) keeps today's loop. The inspect poses are not deterministic from run
  to run today (the base differs from itself): prove equality on the picture list of I2, or pin those poses first.
  A second, separate step for the point lamps: one loop for the base layer and the clear coat, sharing what does not
  depend on roughness. The clear coat's own loop costs 6.6 ms in the Library and 4.8 ms in Fabrication; keep the
  merged loop only if pictures stay at 0.
- **Done when.** Pictures 0 in every room at both tiers; GPU ms on the HD 630 reported for all six rooms; Fabrication
  and Navigation are at least 35% below their baseline (the prototype reached 47% and 42%) and no room is more than 1%
  slower. If the grid falls short of 10% in both rooms it is closed unmerged, or reverted if a gate's numbers do not
  confirm it (D9). What is measured goes into the report for the later lamp pass (section 12).

#### O5 · The mirror at tier 1: pictures and numbers for a talk with the owner
Branch `prog/O5-mirror-memo` · after O0 · size S

- **Context.** Sections 2.3 and 2.6. `?refl=0.5` saves 2 to 4 ms. The reason for the larger mirror at tier 1 is aliasing
  of thin light strips without MSAA. The owner likes the realism of the mirror as it is (D10) and wants to talk it
  through while the run goes on.
- **Goal.** `docs/program/decisions/mirror.md`: pictures and GPU ms over mirror size and minimum mip level, and what
  each choice costs in realism, with "leave it" as the first of them.
- **Done when.** The memo is merged and the orchestrator has put it to the owner. Nothing waits for the answer; a
  change becomes a new card only if the owner asks for one.

#### O6a · The orrery's reflection costs less CPU
Branch `prog/O6a-orrery-cube` · after O6b · size S · owns `capture` in `public/js/room.js` (line 628) and its call in `draw()`

- **Context.** `CubeCamera.update` runs every frame: six `render()` calls for 24 draw calls, 3.2 of the Atrium's
  12.3 ms of JavaScript per frame and 1.3 ms of GPU.
- **Goal.** The cube pass hands the GPU the same picture for a third of the JavaScript.
- **Notes.** Draw the turning parts from a scene that holds only them, which keeps the reflection moving every frame.
  Updating on alternate frames is the second choice, and only if the clip below shows no difference.
- **Done when.** JavaScript in the cube pass is 1.0 ms a frame or less on the HD 630; pictures 0 with the orrery held
  (`?chand=30`); with it turning, a two-second clip differs from a per-frame update by 2/255 at most.

#### O6b · World matrices are updated once a frame
Branch `prog/O6b-matrices` · after P0 · size S · owns `draw()` in `public/main.js` and the scene's update flags

- **Context.** Every `renderer.render` updates the whole scene's world matrices; the Atrium calls it nine times a
  frame. `updateMatrixWorld`, `multiplyMatrices` and `projectObject` are 2.5 ms of its 12.3 ms.
- **Goal.** One update of the world matrices a frame, not one for each render call.
- **Notes.** `scene.matrixWorldAutoUpdate = false` and one update after `room.update(t)`; cameras updated by hand.
  Check everything that moves: the orrery, the drone and its book, the hologram, the route map, the reader's frame,
  the Contact field, the sent message.
- **Done when.** Pictures 0, including states in motion under the fake clock; `updateMatrixWorld` with its children is
  0.4 ms a frame or less in the Atrium's profile on the HD 630.

#### O6c · The Library's drone is a few meshes
Branch `prog/O6c-drone-merge` · after I2 · size M · owns `public/js/drone.js`

- **Context.** `createDrone` builds about 100 meshes from six materials. At rest it is about 100 of the scene pass's
  143 draw calls and about 75 of the shadow pass's 86. What moves: four rotors, the tray and its rods, the gimbal, the
  book's halves and spine, lamps whose colour changes.
- **Goal.** The drone is drawn with a handful of calls and looks and moves as it does.
- **Notes.** Merge what never moves, per material, with `mergeGeometries`; keep the shadows and the window sunlight
  (`receiveWindowSun`).
- **Done when.** Pictures 0 in the Library, book closed and open; 190 draw calls or fewer in its hero view (273 today);
  JavaScript in the scene and shadow passes down by 30% or more.

#### O6d · One primitive for each baked group
Branch `prog/O6d-one-primitive` · after I2 · size S · owns the `gltfpack` line of `tools/pack.py`

- **Context.** `room.glb` has 18 to 61 primitives for 12 to 23 mesh nodes, because `gltfpack -km` keeps materials
  apart and the page replaces every material by group anyway. Each baked primitive is drawn twice in two passes.
- **Goal.** `tools/pack.py` writes one primitive for each baked group.
- **Notes.** The packed files change, so the host's asset cache is rebuilt once for this commit (about 4 minutes).
- **Done when.** Pictures 0; draw calls: Atrium 200 or fewer (240), Fabrication 90 or fewer (111); the files are no
  larger; node names and extras survive (the page reads `grp`, `em`, `fx`, `name`).

#### O7 · Stream textures: small levels first, one file per layer
Branch `prog/O7a-layer-files` then `prog/O7b-small-levels` · after O2 · before F1 (D16, D18) · size L · owns `tools/pack.py`, the texture loading of the room loader, the head/tail split (D19) and `public/_headers`

- **Context.** The cover lifts only when every texture is in: 10 to 38 MB per room. Measured (`tools/docker/visbytes.mjs`,
  branch `prog/R-visbytes`): every texture group is partly in the opening view, so ordering whole files gains almost
  nothing; each KTX2 file stores its smallest levels first, so one range request from byte 0 gives the header and the small
  levels (quarter-size and below: 2.7 to 7.9 MB per room); `_s` holds six sky angles and `_c` three orrery phases in
  one array file each while the first frame samples one layer. A visit opens on the close shot and pulls back to the hero
  after 1.2 s, so "the opening view" is both.
- **Goal.** O7a: `pack.py` writes the layered groups as one file per layer; the loader fetches the layer in use first and
  the others after the cover lifts (the orrery holds its current phase until the next phase's file is in, D18). O7b (D19): pack.py
  splits each texture into a head (its small levels) and a tail; the loader fetches the heads, lifts the cover on them, then fetches the tails, close-shot textures first, then the hero view, then the rest, and raises each texture's detail in
  place (for example allocate full storage and lower the base level as levels arrive) or swaps and frees the small one.
  Limit transcodes running at once. A visitor who asked to save data stays on the small levels. No range requests and no Worker (D19); no `.lo.ktx2` files (they would add 17 to 25% to total bytes).
- **Done when.** At 10 Mbit/s the first frame of the Atrium and of the Lounge is 35% sooner than on `prog/int` before
  O7; bytes before the cover lifts are reported per room; once everything has arrived, pictures 0; the worst frame during
  streaming is at most twice the room's median; WebGL memory peaks at most 10% above today; total bytes at most 8% above
  today.
- **Later (D18).** Repacking atlases by what can be seen (4.8 to 19.3 MB per room is never seen) comes at the end of the
  program, after a checkpoint, with the owner's side-by-side sign-off; a rebake on the remote renderer is allowed if needed.

#### O8 · The report and the budgets
Branch `prog/O8-report` · after every other O task · size S

- **Context.** Each O task reports its numbers in its own pull request, and O0 started the report with the baseline.
  The first pass's report, `docs/opt-rolling-report.md`, is the model: what was measured and how, every change tried,
  kept or not, and why.
- **Goal.** `docs/opt-pass-2-report.md` in the manner of `docs/opt-rolling-report.md`: method, baseline, each change
  with before and after and its runs, kept or not, the final tables on both machines, what waits for the owner, and
  what O4a measured, for the later lamp pass.
  `tools/ci/budgets.json`: per room, GPU ms, frame ms, first frame and bytes on the CI host; the `perf` tier fails
  beyond 5% over.
- **Done when.** The report's final table is reproduced by one command per row; the budgets hold on `prog/int`.

### Workstream ws-found

#### F1 · A build step, and nothing else changes
Branch `prog/F1-build` · after gate G1, during the layout freeze · size L

- **Context.** `public/` is the site as served. three.js is vendored (byte-identical to npm 0.181.2) and reached
  through an import map in `public/index.html`; the first frame takes 33 script requests and 1.4 MB of unminified
  JavaScript. `tools/site.py` reads `public/index.html` as the shell (`SHELL`; it replaces the `<title>` text,
  `<!--site:head-->` and `<!--site:page-->`) and writes its pages into `public/`. `wrangler.jsonc` publishes
  `./public`. The tests serve `public/`. `/assets/<room>/` belongs to the baked rooms and `_headers` marks it immutable.
- **Goal.** Vite builds the site into `dist/`; the DOM, the behaviour and the pictures are unchanged.
- **Notes.** Do the move with a script, `tools/migrate/f1-layout.sh`, so the orchestrator can run it again on the tip
  of `prog/int`; it writes the old-to-new path map to `tools/migrate/f1-map.txt`. Layout as in 4.1, files still
  `.js`: `public/main.js` to `src/main.js`, `public/js/**` to `src/engine/**` (blueprint and asset to `src/pages/`
  as further inputs), the stylesheets to `src/styles/`, `index.html` to the root. `three` 0.181.2 and its add-ons
  from npm; the import map and `public/vendor` go, except the Basis transcoder, which moves to `public/vendor/basis/`.
  `vite.config.ts`: `build.assetsDir: 'app'`, target `esnext`, no asset inlining. `tools/site.py` gets `--shell`
  (4.4); `tools/serve.py` and the Docker helpers serve `dist`; `wrangler.jsonc` points at `dist`; `_headers` marks
  `/app/*` immutable. `tools/ci/run.sh` and `preview.sh` build before they serve (F1 may edit these two files of
  ws-infra's). `package.json` (T1 made it for the test runner) gains `dev`, `build`, `preview`; the pnpm lockfile;
  exact versions; the host
  installs with `pnpm install --frozen-lockfile` and runs no package's install script that is not listed as allowed.
- **Done when.** `pnpm install && pnpm build` on a clean clone gives a `dist/` that passes the whole suite; pictures 0;
  `window.__lobby` is unchanged; `git log --follow` works on the moved files; the pull request has a table of requests
  and bytes for the Atrium's first frame before and after; the Python tests cover `--shell`; README says how to
  develop, build and deploy.

#### F2 · Type check, lint and unit tests, as a ratchet
Branch `prog/F2-typecheck` · after F1 · size M

- **Context.** `tsc --checkJs` over the site as it is: 98 findings in 3.2 s, none a live bug (59 are properties added
  to three.js objects, or DOM types that need narrowing). There is no linter and no unit test for the JavaScript.
- **Goal.** Every push is type-checked and linted in seconds, with no big-bang fix.
- **Notes.** `tsconfig.json`: `allowJs`, `checkJs`, `jsx: preserve`, `jsxImportSource: @solidjs/web`, strict for
  `src/app/**` and for every `.ts` file; `@types/three` 0.181. Today's findings go into `tools/ci/ts-baseline.txt`:
  the check fails on a finding that is not in it, and the file may only shrink. oxlint with `eslint-plugin-solid`.
  Vitest 5 with two projects, Node for `src/**/*.test.ts` and Chromium for `src/app/**/*.test.tsx`;
  `@solidjs/testing-library` and `@solidjs/diagnostics`. First unit tests: address parsing (`route()`), `furnish()`
  on the fixtures in `tools/testdata/site`, one step of the route map's turn.
- **Done when.** `pnpm typecheck` takes 10 s or less and is green against the baseline; `pnpm lint` is green; `pnpm
  test` runs the three unit test files.

#### F3 · The engine behind one boundary
Branch `prog/F3-boundary` · after F2, O3, O6a, O6b · size L · one agent; boundary freeze (5.6)

- **Context.** `main.js` holds the renderer, camera, picking, frame loop and governor together with routing, focus
  bookkeeping, input and DOM writes. `hud.js`, `reader.js` and `comms.js` each mix scene code and DOM code. A pick is
  an untyped object whose members are added in several places of `loadRoom`: `mesh, pose, name, verb, cue, door,
  options, current, list, enter, enterLabel, onFocus, source, returnLabel, back, backLabel, url, title, reads, aside,
  steady, live, calm, typing, click, cursor, cta, station, bounds, left`. One of them once meant two things
  (commit `567d37d`).
- **Goal.** `src/engine/station.ts` exports `createStation` returning the `Station` of 4.2. Nothing under
  `src/engine/` touches the DOM except the canvas and the lines listed in `src/engine/DOM.md` (the 3D halves of the
  reader and Contact still need some until U5 and U6). What is left of the page code moves to `src/legacy-shell/` and
  uses only `Station`.
- **Notes.** Types for `Pick`, `Source`, `Way`, `RoomInfo` (`scene.json`), `Content` (`content.json`) and
  `SiteData`, each member with who sets it and who reads it. Keep `window.__lobby` exactly; add `window.__station`
  as its typed form. No behaviour change. Start the pull request with a design note and get the orchestrator's yes on
  the interface before moving code.
- **Done when.** Suite green; pictures 0; `grep -rnE "document\.|querySelector|innerHTML|classList" src/engine`
  matches only the lines in `DOM.md`; the interface is recorded as frozen in `decisions.md`.

#### F4a to F4d · Engine modules to TypeScript
Branches `prog/F4a-ts-kit`, `F4b-ts-displays`, `F4c-ts-reader`, `F4d-ts-drone-comms` · after F3 · size M each · in parallel, beside U1

| Batch | Files |
|---|---|
| F4a | `kit`, `sunlight`, `post`, `reflections` |
| F4b | `screens`, `hologram`, `routemap` |
| F4c | `reader3d`, `opening/*`, `display3d` (the geometry of `hud.js`) |
| F4d | `drone`, `comms3d` |

- **Context.** After F3 the engine has typed edges (`src/engine/types.ts`) but its modules are still JavaScript, checked
  loosely against the baseline of F2. Most of the 98 findings are properties added to three.js objects (`halo`, `tick`,
  `seed`) and DOM types that need narrowing.
- **Goal.** Each file becomes `.ts` under strict settings; its entries leave the type-check baseline; nothing behaves differently.
- **Done when.** Pictures 0; suite green; the baseline shrank by the batch's entries; no `any` without a comment saying why.

#### F5 · loadRoom in parts
Branch `prog/F5-room-parts` · after F6 and O1 to O7 · size L

- **Context.** `loadRoom` is one function of 605 lines: it fetches, builds the room's materials from shader strings,
  assembles the scene graph, makes every pick, and returns the per-frame update, all sharing one closure.
- **Goal.** `src/engine/room/`: the loader (fetching, textures, life cycle), the materials (one builder per kind),
  the scene graph, and the picks (a typed factory per kind: door, screen, hologram, station, exhibit, Contact, reading).
- **Done when.** No function in `src/engine/room/` is longer than 120 lines; every material's shader source is the
  same string as before (a script in the pull request compares hashes); pictures 0; suite green.

#### F6 · One home for the repeated helpers
Branch `prog/F6-helpers` · after F4a to F4d · size M

- **Context.** The reduced-motion query is written out in 6 files, the font stack in 5, canvas-to-texture in 6, word
  wrapping 5 times in 3 files, pointer-to-ray maths in 3, `tan(fov / 2)` in 6, smoothstep in 8, the plane vertex
  shader in 4.
- **Goal.** Each of them is written once and imported.
- **Done when.** One definition of each in `src/engine/kit/`; pictures 0; the wall screens' canvases are byte-identical
  to before.

#### D1 · The contract and the README describe the new page
Branch `prog/D1-docs` · after U8 · size M

- **Context.** `docs/v1-contracts.md` sections 4 and 5 describe today's ids, the `window.__lobby` hooks and the test
  scripts; the README describes a site with no build step. Each task has updated its own lines; this is the pass that
  makes the whole read as one.
- **Goal.** The contract and the README are true of the finished site and enough to work on it.
- **Done when.** `docs/v1-contracts.md` sections 4 and 5 and the README describe the page layer, the hooks and the
  checks as they now are; an agent given only the README can develop, build and run every tier.

#### D2 · Deploy
Branch `prog/D2-deploy` · after F1 · size S

- **Context.** `wrangler.jsonc` publishes a folder as static assets with no Worker code; `public/_headers` holds the
  cache rules. F1 pointed both at the build output.
- **Goal.** The built site can be published as the old one was, and the way back is written down.
- **Done when.** `wrangler deploy --dry-run` succeeds on `dist` without credentials; a release checklist and a way
  back (the previous line stays deployable from its own branch) are in the README. The deploy itself is the owner's.

#### D3 · Dependencies and how they are raised
Branch `prog/D3-dependencies` · after U1 · size S

- **Context.** Section 2.5. The site had no dependencies until F1; Solid 2.0 and UI SDK are both days old.
- **Goal.** A written rule for versions, so that a beta's churn reaches the site only when someone decides it should.
- **Done when.** `docs/program/dependencies.md` lists each pinned version, its licence and why it is there; a bump is one pull request with
  `e2e`, `pictures` and `perf`; Solid 2.0.x and UI SDK are looked at once a week during the program and raised at most
  once per gate.

#### F7 · Without WebGL the page still reads
Branch `prog/F7-no-webgl` · after F1 · size S

- **Context.** With WebGL unavailable, `main.js` throws "e is not a function" on every page, today's included. three.js
  r181's WebGLState catches GL errors with `catch (error)`, which hides its own `error()` helper, so any GL failure shows
  as that message.
- **Goal.** Detect WebGL 2 before the renderer is made; without it the page stays the plain page (it already reads without
  JavaScript), says the station needs WebGL, and throws nothing. A clear message where three.js hides its own.
- **Done when.** A Playwright check with WebGL disabled: no page error, the plain page and a short notice; pictures 0 elsewhere.

#### C1 · Comments out
Branch `prog/C1-comments` · after O7 and the flicker fix have merged · size M · owns comments in every file except `public/vendor/`

- **Context.** D22: code carries only a one-line header per file saying what is in it.
- **Goal.** Remove every other comment in JS, GLSL strings, Python (comments and docstrings), shell, CSS and HTML; add the header where it is missing. Keep shebangs, tool directives and vendored code.
- **Done when.** A check in `ci static` fails on a comment outside the header (with the allowed exceptions); `suite`, `e2e` pass; pictures 0; the minified size of every page script is unchanged or smaller.

### Workstream ws-ui

Before writing page-layer code, read the Solid primer and the UI SDK docs named in 2.5, and
`docs/program/ui-spec.md` once U0 has produced it.

#### U0 · What the new page layer is
Branch `prog/U0-ui-spec` · after P0 (finished once U0c has reported) · size M · the owner signs it (gate G3)

- **Context.** What the page does today is in `docs/v1-contracts.md` section 4 and in the tests; what each region is to
  become is in 4.3. The owner has decided Contact (D4) and the keys (D5); styling (D6) is still a default.
- **Goal.** `docs/program/ui-spec.md`: for each region of 4.3 the elements and their roles and names, the states, the
  keys and the focus order, the phone layout, and what may move (the contract says nothing on the display moves by
  itself). Contact as three links over the field as it is drawn today (D4). The
  hooks the tests keep. The accessibility target: WCAG 2.2 AA for the page layer, with today's measured contrast
  thresholds kept. Open questions for the owner, each with a recommendation; one of them: do the "what to write
  about" sections of `/contact/` stay, now that people write through LinkedIn.
- **Done when.** The owner's sign-off and the answer to D6 are in `decisions.md`.

#### U0b · Does the stack hold together (a spike, thrown away)
Branch `prog/U0b-stack-spike` · after P0 · size S

- **Context.** The planning session type-checked Solid 2 code and read UI SDK's docs; it never built or ran a UI SDK
  component. From the docs: `@ui-sdk/core` must be kept out of Vite's dependency optimizer, popups use the browser's
  Popover API, and the testing kit is `@ui-sdk/core/testing`. Both projects are days old (2.5).
- **Goal.** In `spikes/solid-uisdk/` with its own `package.json`: Vite, `@solidjs/vite-plugin` in plain mode,
  `@ui-sdk/solid` and `@ui-sdk/core` at the versions of 2.5. A Listbox and a Dialog on a page beside a three.js canvas
  with a frame loop.
- **Done when.** A note in the pull request answers, with what was run: does `optimizeDeps.exclude:
  ['@ui-sdk/core']` suffice; do a component test in Chromium, `checkPattern` and the diagnostics gates work together;
  what do Solid plus these two components weigh in gzip; which exact versions to pin; what surprised you. Only the
  note is merged.

#### U0c · The room's things as a primitive (a spike)
Branch `prog/U0c-picks-spike` · after U0b · size M

- **Context.** UI SDK has no component for things in a WebGL scene; its Canvas behaviour is for 2D boards.
  `spatialMove` accepts positions you supply (`rect: (el, key) => ...`), and `hud.js` (`frameOf`, line 42) already
  computes each pick's screen rectangle.
- **Goal.** In the spike folder: a primitive `scene-picks` built with `definePrimitive` from roving focus with
  `spatialMove`, selection and announcements, fed with rectangles that move every frame; proxies placed over them; an
  `agent` key with `inspect` and `read`.
- **Done when.** A note says whether it works, the keyboard model it proposes (D5), what `Station` must expose, and
  shows a test with UI SDK's `mount`. It feeds U0 and U4.

#### T1 · End-to-end tests on Playwright's runner
Branch `prog/T1-e2e-harness` · after I1 · size M

- **Context.** Section 2.1. The shared kits are `rooms.kit.mjs` and `r2.kit.mjs` (the profiles, a page with every
  error recorded, a recorder of the reader's meshes, a gate on the page's frames).
- **Goal.** `tests/e2e/` on `@playwright/test`: projects for desktop (1280x720), phone (390x844, touch) and reduced
  motion; Chromium with today's GPU flags; a smoke spec in Playwright's WebKit and Firefox (what `view.mjs` does
  today); one worker for specs tagged `@timing`; fixtures for the served site and the
  data sets of the kits; page objects for the station's hooks. Old scripts keep running until the task that owns their
  area replaces them.
- **Notes.** Port first, unchanged in what they assert: `errs`, `endpoints`, `page`, `plainpage` and `plaincheck`,
  `opening`, `turn` (these test generated pages or the engine through hooks). `tests/e2e/README.md` maps every old
  script to its new spec and owner:

  | Old script | Owner |
  |---|---|
  | `rooms.text`, `rooms.others`, the words in `hud`, `hostile` | U2 |
  | `library` (list and READ), `ringline`, `door`, `tour`, the bar in `rooms.read` | U3 |
  | the lock and stillness in `hud`, `cue` | U4 |
  | the reader in `library` and `rooms.read`, `rooms.cross`, `rooms.deeplink` | U5 |
  | `contact` (U6a cuts it down to links first) | U6 |
  | `deeplink` (the offer) | U7 |
  | `history`, `writing-alias`, addresses in `rooms.read` | U8 |

  T1 makes the root `package.json` and the pnpm lockfile, with the test runner only; F1 adds to them. The package and
  the Docker image must be the same Playwright version: the old scripts stay on the 1.64.1 image until they are gone,
  and the new runner uses the image of its own version.
- **Done when.** The first ports are green five runs in a row; the `e2e` tier runs them; the map has a row for every
  script in `tools/check.sh`.

#### U1 · The page layer's skeleton
Branch `prog/U1-skeleton` · after F3 and gate G3 · size M

- **Context.** After F3 the old page code is in `src/legacy-shell/` and reaches the engine only through `Station`.
  U0b's note says which versions and Vite settings work; the spec of U0 is signed.
- **Goal.** `src/app/main.tsx` renders into a root element of `index.html`. `src/app/state/station.ts` turns the
  `Station`'s values into signals (no polling, except the half-second clock of the live values).
  `src/app/regions.ts` says which regions Solid draws; the legacy shell skips those. `src/app/ui/`: one file per
  UI SDK component we use, with our classes; nothing outside it imports `@ui-sdk/solid`. Diagnostics on in
  development. `AGENTS.md` gains the primer and docs paths. Exact versions in `package.json`.
- **Done when.** With every region off the site is unchanged (suite green, pictures 0); a demo component behind a
  query switch renders, passes `checkPattern`, and has a component test with `expectNoDiagnostics`; the pull request
  reports the added gzip size.

#### U2 · Brand, nav, hero, facts, hint
Branch `prog/U2-hud-text` · after U1 · size M · region `hud`

- **Context.** Today: `fillHud` (`main.js:198`), `tick` (194), the nav and hero click handlers, `paintHint` in
  `hud.js`. Words come from `content.json` through `furnish()`. Markup in the data once ran as markup (commit
  `05a56cb`).
- **Goal.** Components for the nav (real links, the current room marked, the view toggle), the hero (kicker, headline
  as the page's heading, lines with live values, the room's button), the facts and the hint.
- **Done when.** The specs of its row in T1's map are green on all three projects; data is never written as markup;
  the words still meet the contrast thresholds in the bright room; the legacy code of the region is deleted.

#### U3 · The inspect bar
Branch `prog/U3-bar` · after U1 · size M · region `bar`

- **Context.** Today: the bar half of `setFocus` (`main.js:161` to 181), the bar's click handler, `#enter` shown by
  polling in `tick`, and `clearance()` (`main.js:258`), which the READ glyph calls every frame (`reader.js:264`):
  a forced layout worth 0.24 ms a frame.
- **Goal.** The caption; BACK and the two tour buttons as a toolbar; a door's ways as buttons, or a menu when it has
  several stops; a pick's choices as a listbox (the Library's volumes; on a phone the list folds to the chosen one);
  READ. The bar reports the rectangle it covers through `station.setCovered` when its size changes.
- **Done when.** Its specs are green; Escape, Enter and the arrows do what they do today; after a reading closes,
  focus is back where it came from; `checkPattern` passes for the toolbar, the menu and the listbox; the profile of
  the inspect state has no `getBoundingClientRect`; legacy code deleted.

#### U4 · The room's things: keyboard, screen reader, lock and cue
Branch `prog/U4-picks` · after U1, U0c, F4c · size L · region `picks`

- **Context.** Today a pick is reached with the pointer or the tour's arrow keys. The lock and the cue are
  `aria-hidden` and placed every frame by `hud.js`; `window.__lobby.display.state()` reports them to the tests.
- **Goal.** The primitive of U0c in the page: a proxy for each live pick with its name and verb; arrows move among
  them by position; Enter does what a click does; the lock shows on the proxy that has focus as it does under the
  pointer; the cue as today. The marks are placed in `station.onFrame` through refs.
- **Done when.** Its specs are green; a keyboard-only spec walks every room (Tab in, arrows, Enter, Escape); a screen
  reader's names are the picks' names and verbs; the stillness rule of the contract is still checked;
  `display.state()` returns the same shape; legacy code deleted.

#### U5 · The reader's frame
Branch `prog/U5-reader` · after U1, F4c · size L · region `reader`

- **Context.** `reader.js` builds `#reader` (head, contents, scroll, progress) with `innerHTML` (line 142), adopts
  the generated page's own `<article>`, intercepts its links, places the element with a matrix every frame (`place`,
  line 213) and reveals it with a clip path.
- **Goal.** Components for the frame (a named region, the title, CLOSE), the contents with the current heading marked,
  the scrolling text, the progress, and copy buttons on code that say "copied". The article stays the page's own
  element, adopted and not re-rendered. Placement through `station.frameOf('reader')` in `onFrame`. Links go to the
  router's adapter. `reader.js` keeps only what is drawn in the scene (it becomes `reader3d`).
- **Changed by D20.** The reader renders the article component itself instead of adopting the page's own article, so the plain page and the frame share one source.
- **Done when.** Its specs are green on all three projects; selecting, finding in the page and copying work; focus
  goes into the text on opening and back on closing; with the DOM hidden, pictures of a reading are 0 against the base.

#### U6a · Contact offers three links and nothing else
Branch `prog/U6a-contact-links` · after O6b · size M · owns `public/js/comms.js`, the Contact lines of `public/js/site.js` (50 to 58), `rooms.comms.comms` in `public/content.json`, `contact_page` and `profile_json` in `tools/site.py`, `tools/docker/contact.mjs`

- **Context.** The owner's decision (D4): no message form; Contact shows LinkedIn, GitHub and the résumé, and people
  write to the owner on LinkedIn. `comms.js` can be three things, chosen by data (line 93): `links`, `mail` (a message
  box handed to the visitor's mail program) and `send` (a message box posted to an endpoint). The site has only ever
  been `links`: the profile has no address and `content.json` no endpoint. Today the field has a button for every
  entry of the profile's `social_links` (LinkedIn, GitHub, Credly) and one for the résumé, and the generated
  `/contact/` page lists the same under "Elsewhere" (`elsewhere()`, which the About page also uses).
  `tools/docker/contact.mjs` tests all three modes on stubbed data; its items 6 and 7 are mail and send.
- **Goal.** Contact offers exactly three ways, in this order: LinkedIn, marked as the way to write to the owner;
  GitHub; the résumé. The `mail` and `send` modes are gone from the code, the data and the tests.
- **Notes.** Which links Contact shows is the profile's to say: a list in `data/profile.json` that names entries of
  `social_links`, the first being the one to write through, checked by `tools/content.py`; the résumé follows when
  there is one. Out of `comms.js`: the message box, the visitor's address, SEND, the mail link and COPY, their states
  and the drone's moods for them, and the mote that leaves through the window. Out of `content.json`: `address`,
  `endpoint`, `subject`, `max`, `write`, `status`. Out of `public/profile.json` (contract section 8):
  `contact.email`. The `/contact/` page lists the same three; Credly stays on the About page. The words that invite
  (`contact_invitation`, the standby line, the room's button) are the owner's: propose them in the pull request.
- **Done when.** The field and the `/contact/` page show the three links in that order, each opening its own address
  in a new tab; `grep -nE "mailto|endpoint|textarea" public/js/comms.js` finds nothing; `contact.mjs` (what the
  field says, nothing overlaps, every target pressable, the keyboard, legibility over the bright room, nothing leaves
  the machine but the links pressed), `endpoints.mjs`, `hostile.mjs` and the Python tests are green on all three
  profiles; the contract's lines on Contact (sections 4, 5, 7 and 8) say what is now true; the pull request shows the
  field before and after at desktop and phone sizes, for the owner's look at gate G1.

#### U6 · Contact's links belong to the page layer
Branch `prog/U6-contact` · after U1, F4d · size M · region `contact`

- **Context.** After U6a the field offers three links. `comms.js` draws their words into the field's canvas and makes
  the real `<a>` elements itself (`section#comms`, line 130 today), laid over the drawings and moved every frame
  (`lay`, line 320 today), so that the keyboard, a finger, a screen reader and the browser's own menu for a link find
  them. With no form (D4) the field keeps its look: light drawn in the scene.
- **Goal.** The page layer renders the three links as real links over their drawings; the engine draws the field and
  says where each link is. No DOM is left in `comms3d`.
- **Notes.** `Station` gives the links (label, note, address) and each one's rectangle for the frame; the component
  places them in `onFrame` through refs, as U4 places its marks. The focus order and the focus ring as today; inert
  while the field is closed.
- **Done when.** Its specs (from `contact.mjs`: names and standby, what the open field says, nothing overlaps, every
  target pressable at 44 by 44 CSS px on a phone, each link opens its own address in a new tab, the keyboard,
  legibility) are green on all three projects; pictures 0 for the field open and closed; it works by keyboard and
  screen reader alone; the Contact lines of `src/engine/DOM.md` are gone; legacy code deleted.

#### U7 · The cover, the offer, failures and the page's three modes
Branch `prog/U7-cover` · after U1 · size M

- **Context.** Today: `#loader`, `fail()` (`main.js:24`), `progress()` (268), `offer()` (469) and `stepIn()` (473), and
  the one-line script in the head of `index.html` that sets the class on `html` before anything is painted.
- **Goal.** The cover with its progress; the offer to step into the room from an article's page; what is shown when
  WebGL cannot start or a room fails to load; the `html` class that says whether the page is plain, being read or the
  station (the one-line script in the head stays).
- **Done when.** Its specs are green, including the page without WebGL and the visitor who asked to save data.

#### U8 · Addresses on the router, and the old shell goes
Branch `prog/U8-router` · after U2 to U7 · size L

- **Context.** `route()`, `syncUrl()`, `readPost()`, `onLink()` and the `popstate` handler in `main.js`. Every case
  in `history.mjs` was a bug once: one history entry per reading, Back and Forward reopen without the flight, a
  fragment is a place in a page, and `?room=` names nothing (a path is the only way to name a room).
- **Goal.** `@solidjs/router` owns the address. A room is an async value under a `Loading` boundary, and the engine is
  told to enter and to read. `src/legacy-shell/` is deleted.
- **Done when.** The history specs are green; no `pushState` or `replaceState` outside the router's adapter;
  `src/legacy-shell` is gone; `src/engine/DOM.md` is empty; `tools/check.sh` and the scripts the specs replaced are
  removed, and `e2e` is the suite.

#### U9 · An agent can use the rooms (behind a switch)
Branch `prog/U9-agent` · after U4 · size M

- **Context.** UI SDK components, and primitives with an `agent` key (U4's has one), can be read and operated through a
  bridge: `createAgent()`, `agent.snapshot()`, `agent.act()`, with an `allow` callback that approves or refuses. See
  `node_modules/@ui-sdk/solid/docs/` (Agents).
- **Goal.** With `agent.enabled` in `content.json`: `createAgent()` from `@ui-sdk/solid/agent`, allowed to move
  between rooms, inspect, read, close and choose a volume; following a link that leaves the site always asks a
  person; WebMCP
  where the browser has it. With the switch off, none of this code is loaded.
- **Done when.** A spec reads the room through `agent.snapshot()`, inspects a thing and opens a reading through
  `agent.act`, and sees a refused action refused.

#### U10 · Styles and leftovers
Branch `prog/U10-styles` · after U8 · size S

- **Context.** `style.css` (147 lines) and `post.css` (162 lines) were written for the old DOM. `tools/site.py` keeps a
  list, `RUNTIME_IDS` (line 37), of ids the page's scripts add at run time, which an article's headings must not take.
- **Goal.** The styles belong to the new components and nothing of the old page is left behind.
- **Done when.** `src/styles/tokens.css` and one stylesheet per component; unused rules of the old stylesheets
  removed; `RUNTIME_IDS` in `tools/site.py` lists the ids the new page adds at run time, with its tests updated.

#### U11 · The plain pages come from Solid at build time
Branch `prog/U11-pages` · after F1 and U5 · size L · owns the page generator (`tools/site.py`, `tools/site_extras.py` and their
tests, until they are retired) and `src/pages/`

- **Context.** `tools/site.py` (1,414 lines) writes every plain page, the feeds, the sitemap, `llms.txt` and `profile.json`.
  The spike U0d (`docs/program/ssr-spike-notes.md`, D17, D20) rendered a post, About and Contact with Solid 2 at build
  time under Vite 8 in plain mode: identical words, head tags and JSON-LD, pixel-identical without JavaScript.
- **Goal.** A prerender step in the build renders every page from the same Solid components the station's panels use;
  feeds, sitemap, `llms.txt` and `profile.json` in plain TypeScript; `tools/site.py` retired. The plain pages are not
  hydrated (they ship no extra JavaScript). The Markdown renderer (about 440 lines) and `site_extras.py` are ported first,
  behind a golden test against `site.py`'s output for every page.
- **Done when.** The golden test shows every generated file the same as `site.py`'s (whitespace aside) before `site.py`
  goes; the Python tests are carried over one for one (three change on purpose, as the notes say); `suite`, `e2e` and
  `pictures` pass; the build stays under 10 s on the CI host.

## 9. Gates

| Gate | When | What must hold | Owner |
|---|---|---|---|
| G0 | after P0 | `static`, `smoke` and `suite` green on `prog/int`; preview up | told |
| G1 | end of wave A | ws-infra, ws-opt and U6a in `prog/int`; suite green twice; pictures 0 except signed changes; no room slower than the baseline by more than 3% on either machine. The talk about the mirror (O5) does not hold the gate | looks at the governor and at Contact on the preview |
| G2 | F1 merged | the built site passes the suite; pictures 0; requests and bytes reported | told |
| G3 | F3 merged, U0 written | the boundary is frozen; the page-layer spec is signed | **signs** U0 and D6 |
| G4 | U2 to U8 merged | every region on Solid; legacy shell gone; `e2e` green three times, with the keyboard-only walk and the smoke in WebKit and Firefox; `component` green; pictures 0 with the DOM hidden; `perf` within budgets; script bytes for the first frame at most 60 KB gzip above G2's; the page layer adds at most 0.3 ms of JavaScript a frame in the hero view | **signs** after using the preview on a desktop and a phone; decides D11 |
| G5 | every card merged, or closed with its reason in `status.md` | pull request from `prog/int` to `explore/rolling-earth` with the report and the release checklist | **merges and deploys** |

The mirror (O5) is talked through with the owner while the run goes on; nothing waits for it.

**After G5.** Delete the merged `prog/*` branches on both remotes and the worktrees; attach the report's raw results to
the final pull request; ask the owner whether the CI host is still needed. Releasing it is the owner's decision.

## 10. Templates

**The brief for a subagent** (the orchestrator fills the angle brackets):

```
You are doing one task of the program in docs/program-plan.md, in your own git worktree of this repository.

Read first: AGENTS.md; sections 4 and 5 of docs/program-plan.md; the card below; the files it names.
<For page-layer tasks: node_modules/solid-js/skills/solid-2.0/SKILL.md, node_modules/solid-js/CHEATSHEET.md,
 node_modules/@ui-sdk/solid/docs/llms.txt, docs/program/ui-spec.md.>

The card:
<the task card, whole>

Base branch: <prog/ws-...>. Your branch: <prog/ID-slug>.
Checks: git push ci HEAD:<branch> && ssh arcadia-ci ci <branch> <tier>.
Deliver a pull request into the base branch written from docs/program/pr-template.md.
Report back: the pull request's URL; what you did; the evidence lines; what you found but did not fix; what you could
not verify. If a rule of 5.7 applies, stop and report instead of working around it.
```

**The brief for a reviewer:**

```
You are reviewing one pull request of the program in docs/program-plan.md. Change no code.

Read: AGENTS.md; sections 4 and 5 of docs/program-plan.md; the card below; the pull request
(gh pr view <number>; gh pr diff <number>).

The card:
<the task card, whole>

Check: every "done when" line against the evidence shown; one tier re-run by you on the pull request's head
(ssh arcadia-ci ci <branch> <tier>); files changed outside the card's paths; anything private (an address, a host
name, a token, an e-mail address); docs that no longer say what the code does; a test removed or weakened.
Report: "merge" or "changes needed", findings most serious first, each with file and line. Post the same text with
gh pr comment <number>. Every agent acts as the same GitHub user, so a review is a comment, not an approval.
```

**The pull request** (`docs/program/pr-template.md`):

```
## What this does            one or two plain sentences
## Card                      <ID> and its "done when" lines, each marked met or not
## What changed              by area, not by file
## Evidence
- checks: the "ci <tier> <sha> PASS ..." lines
- pictures: the table, or "not an engine change"
- numbers: before -> after, the runs, which machine
## Found but not fixed
## Could not verify
```

## 11. Risks

| Risk | What is done about it |
|---|---|
| Solid 2.0 is a week old and UI SDK is a beta that changes every day or two | exact pins; UI SDK only behind `src/app/ui/`; the spike U0b before anything depends on it; bumps only at gates. If the Solid adapter blocks a region, that region can be written by hand or with UI SDK's custom elements (`@ui-sdk/web`) behind the same wrapper |
| The page code and its tests are rewritten together | one region at a time, the old code running until the region's specs are green; engine-facing scripts ported unchanged first; the `pictures` tier guards the engine throughout |
| Solid applies writes in a microtask, the engine draws in a frame | the rules of 4.2; a spec that the lock stays on its thing while the view moves |
| Two agents in `main.js` or `room.js` | ownership by function, the two freezes, the order of section 7 |
| Measurements wander | medians of three; the quiet lock on the CI host; two machines; HD 630 runs one at a time, thrown away if the laptop was busy |
| The Library's pictures are not yet deterministic | I2 fixes it before O6c and the page-layer work lean on them |
| Headless Chromium cannot show pacing, touch or feel | the preview, and the owner's look at G1, G3 and G4 |
| One CI host | jobs queue on its locks; goldens can be regenerated from commits; O0 moves the seed tools into the repository early |
| A public repository | 5.4, checked in every review |

## 12. Not in this program

- A lamp pass (D9). After O4a the lamps that still cost are the point lamps, which no grid can cull: about 20 ms of
  the Library's 51 (8 lamps) and the Lounge's 2 lamps, and 7 to 8 ms left in Fabrication. What is left changes the
  picture or needs new bakes. The route
  that keeps the reflections: lamps shown by their lenses through the mirror and the probes, as the Lounge shows its
  downlights (commit `1dac8d5`). It needs re-bakes, and one room should be tried first for the owner to judge beside
  today's. The other route is cheaper lamp maths. Taking lamp highlights out of the mirror is not wanted (D10).
  O8's report keeps the numbers that pass will start from.
- A message form, a mail link or an address in Contact (D4).

- The plugin's start mode with server rendering or prerendered routes in place of `tools/site.py`'s pages.
- A three.js upgrade; WebGPU.
- The final pass: tone mapping through a lookup table and a cheaper guard against NaN, about 2 ms at tier 1 for a
  change of at most 1/255.
- Sky layers loaded as they are needed (the Lounge's `_s` layers are 10.4 of its 37 MB of textures); one backdrop shared by the four rooms
  with a window; texture sets transcoded ahead of time so the browser does not transcode.
- A shared uniform block for what every material of a room has in common.
- The blueprint and asset pages on Solid: they move to `src/pages/` in F1 and stay plain.
