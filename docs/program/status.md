# Program Status

Updated: 2026-11-24 (Wave A Batch 1 complete: 7/7 cards done; proceeding to Wave A Batch 2–3 toward Gate G1)

## Current Wave & Gate

- **Active Wave:** Wave A — Batch 1 complete (`7/7` cards done: `I1`, `I4`, `O1`, `O3`, `O4a`, `O6b`, `U0b`); proceeding to Wave A Batch 2–3 toward Gate `G1`
- **Active Gate:** `G0` **PASS** (next gate: `G1`)
- **Base Commit:** `explore/rolling-earth` at `6390b52ded91146778685eebd4c3224f82c9a914`
- **Integration Branch:** `prog/int`
- **Workstream Branches:** `prog/ws-infra`, `prog/ws-opt`, `prog/ws-found`, `prog/ws-ui`

## Gates

| Gate | When | Status | Date | Evidence / Notes |
|---|---|---|---|---|
| G0 | after P0 | **PASS** | 2026-11-24 | Verified on `prog/int` (`c37f311eff8d5bdf9708fa174b6e7eef0a76092c`): `static` PASS 13s (`/srv/arcadia/jobs/20261124-084437-c37f311e-static-61372`), `smoke` PASS 28s (`/srv/arcadia/jobs/20261124-084457-c37f311e-smoke-61605`), `suite` PASS 3029s (`/srv/arcadia/jobs/20261124-084547-c37f311e-suite-63755`), local Python `content.py` + 141/141 unit tests OK, `arcadia-preview@8080` active (`HTTP/1.0 200 OK`) |
| G1 | end of wave A | pending | — | Requires `ws-infra`, `ws-opt`, and `U6a` in `prog/int`, `suite` green twice, pictures 0, no room >3% slower |
| G2 | F1 merged | pending | — | Layout freeze; built `dist/` passes suite, pictures 0, requests & bytes reported |
| G3 | F3 merged, U0 written | pending | — | Engine boundary frozen; page-layer spec (`U0`) & styling (`D6`) signed |
| G4 | U2 to U8 merged | pending | — | Legacy shell gone, `e2e` green x3 (incl. keyboard walk & WebKit/Firefox smoke), `component` green, pictures 0, `perf` within budgets, D11 decided |
| G5 | every card merged or closed | pending | — | PR from `prog/int` to `explore/rolling-earth` with optimization report & release checklist |

## Tasks

All 44 task cards from `docs/program-plan.md` §7.1:

| ID | Card | Workstream | Wave | After | Size | Status | Branch / PR | Notes / Closure Reason |
|---|---|---|---|---|---|---|---|---|
| I1 | The checks live in the repository | infra | A | P0 | M | done | `prog/I1-ci-in-repo` / PR #204 (`2981d27f` -> `f5ef8c4c`) | `tools/ci/{run,preview,serve}.sh`, isolated Docker scripts, `10.x.x.x` scrubbed |
| I2 | Golden pictures and the recorded baseline | infra | A | I1 | M | pending | — | — |
| I3 | The browser suite runs in parallel | infra | A | I1 | M | pending | — | — |
| I4 | The team's working files | infra | A | P0 | S | done | `prog/I4-working-files` / PR #201 (`7748d6c3` -> `f5ef8c4c`) | `AGENTS.md`, `CLAUDE.md`, `docs/program/pr-template.md` |
| I5 | Checks for the built site | infra | B | F2 | S | pending | — | — |
| O0 | The measuring tools are in the repository | opt | A | I1 | S | pending | — | — |
| O1 | The load path wastes no time | opt | A | P0 | S | done | `prog/O1-load-path` / PR #205 (`b4e80e90` -> `2ff2e0e8`) | HD 630 `50 20` Atrium `-25.9%`, Lounge `-17.2%`, Library `-20.2%`, `loadprof` `3528->1083 ms` (`-69.3%`), 8 unused pre-compiled + late programs identified |
| O2 | Textures are requested as soon as scene.json is read | opt | A | O1 | M | pending | — | — |
| O3 | The governor measures the GPU | opt | A | P0 | M | done | `prog/O3-governor` / PR #207 (`5eec8091` -> `2ff2e0e8`) | `public/js/governor.js`, `EXT_disjoint_timer_query_webgl2` + unclamped `dt` fallback + `localStorage` + D10, 19/19 Node tests, 6/6 HD 630 rooms settle <=6s & hold 20s; owner `preview` review requested in PR #207 |
| O4a | A pixel walks only the lamps that can reach it | opt | A | P0 | M | done | `prog/O4a-lamp-lists` / PR #203 (`df5dd1df` -> `2ff2e0e8`) | **D9 KEEP** — Fabrication HD 630 GPU median `50.32 -> 44.84 ms` (`-10.89%`, `passes` `-10.69%`), worst room `+0.79%` (`comms`), lamps `135->94`; remaining unculled groups noted for `O8`/§12 |
| O5 | The mirror at tier 1: pictures and numbers for a talk with the owner | opt | A | O0 | S | pending | — | — |
| O6a | The orrery's reflection costs less CPU | opt | A | O6b | S | pending | — | — |
| O6b | World matrices are updated once a frame | opt | A | P0 | S | done | `prog/O6b-matrices` / PR #206 (`c2e8bb63` -> `2ff2e0e8`) | HD 630 `umw_incl_ms` `1.472 -> 0.166 ms/frame` (Challenger `0.9181 -> 0.1993 ms/frame`), 0 pixel diff |
| O6c | The Library's drone is a few meshes | opt | A | I2 | M | pending | — | — |
| O6d | One primitive for each baked group | opt | A | I2 | S | pending | — | — |
| O7 | Small textures first | opt | B | O2, O6d, F1 | L | pending | — | — |
| O8 | The report and the budgets | opt | D | every other O task | S | pending | — | — |
| F1 | A build step, and nothing else changes | found | freeze | gate G1, during the layout freeze | L | pending | — | — |
| F2 | Type check, lint and unit tests, as a ratchet | found | B | F1 | M | pending | — | — |
| F3 | The engine behind one boundary | found | B | F2, O3, O6a, O6b | L | pending | — | — |
| F4a | Engine modules to TypeScript (`kit`, `sunlight`, `post`, `reflections`) | found | C | F3 | M | pending | — | — |
| F4b | Engine modules to TypeScript (`screens`, `hologram`, `routemap`) | found | C | F3 | M | pending | — | — |
| F4c | Engine modules to TypeScript (`reader3d`, `opening/*`, `display3d`) | found | C | F3 | M | pending | — | — |
| F4d | Engine modules to TypeScript (`drone`, `comms3d`) | found | C | F3 | M | pending | — | — |
| F5 | loadRoom in parts | found | D | F6 and O1 to O7 | L | pending | — | — |
| F6 | One home for the repeated helpers | found | D | F4a to F4d | M | pending | — | — |
| D1 | The contract and the README describe the new page | found | D | U8 | M | pending | — | — |
| D2 | Deploy | found | D | F1 | S | pending | — | — |
| D3 | Dependencies and how they are raised | found | D | U1 | S | pending | — | — |
| U0 | What the new page layer is | ui | A | P0 (finished once U0c has reported) | M | pending | — | — |
| U0b | Does the stack hold together (a spike, thrown away) | ui | A | P0 | S | done | `prog/U0b-stack-spike` / PR #202 (`4627317f` -> `8f707727`) | Findings recorded in `docs/program/ui-spike-notes.md` (Solid + Listbox + Dialog `86.82 kB` gzip; spike code not merged) |
| U0c | The room's things as a primitive (a spike) | ui | A | U0b | M | pending | — | — |
| T1 | End-to-end tests on Playwright's runner | ui | A | I1 | M | pending | — | — |
| U1 | The page layer's skeleton | ui | C | F3 and gate G3 | M | pending | — | — |
| U2 | Brand, nav, hero, facts, hint | ui | C | U1 | M | pending | — | — |
| U3 | The inspect bar | ui | C | U1 | M | pending | — | — |
| U4 | The room's things: keyboard, screen reader, lock and cue | ui | C | U1, U0c, F4c | L | pending | — | — |
| U5 | The reader's frame | ui | C | U1, F4c | L | pending | — | — |
| U6a | Contact offers three links and nothing else | ui | A | O6b | M | pending | — | — |
| U6 | Contact's links belong to the page layer | ui | C | U1, F4d | M | pending | — | — |
| U7 | The cover, the offer, failures and the page's three modes | ui | C | U1 | M | pending | — | — |
| U8 | Addresses on the router, and the old shell goes | ui | D | U2 to U7 | L | pending | — | — |
| U9 | An agent can use the rooms (behind a switch) | ui | D | U4 | M | pending | — | — |
| U10 | Styles and leftovers | ui | D | U8 | S | pending | — | — |

## Notes

- **P0 / Gate G0 (2026-11-24):**
  - `prog/int` bootstrapped from `explore/rolling-earth` (`6390b52ded91146778685eebd4c3224f82c9a914`) at `c37f311eff8d5bdf9708fa174b6e7eef0a76092c`, with workstream branches `prog/ws-infra`, `prog/ws-opt`, `prog/ws-found`, and `prog/ws-ui` pushed to both `origin` and `ci`.
  - Local Python checks on `c37f311e`: `python3 tools/content.py` (4 posts, 10 projects, profile valid) and all 5 `tools/test_*.py` suites (25 + 48 + 21 + 23 + 24 = 141 tests OK).
  - CI host checks on `prog/int` (`c37f311eff8d5bdf9708fa174b6e7eef0a76092c`):
    - `ci static c37f311e PASS 13s /srv/arcadia/jobs/20261124-084437-c37f311e-static-61372`
    - `ci smoke c37f311e PASS 28s /srv/arcadia/jobs/20261124-084457-c37f311e-smoke-61605`
    - `ci suite c37f311e PASS 3029s /srv/arcadia/jobs/20261124-084547-c37f311e-suite-63755` (all 50 steps passed)
  - Preview on port 8080 (`arcadia-preview@8080`): active and serving `HTTP/1.0 200 OK` (`prog/int` updated again after recording this gate).

- **Milestone M1 — Wave A Batch 1 (2026-11-24):**
  - Completed `7/7` Batch 1 cards across `prog/ws-infra` (`I4` PR #201 -> `7748d6c3`, `I1` PR #204 -> `2981d27f`), `prog/ws-opt` (`O6b` PR #206 -> `c2e8bb63`, `O1` PR #205 -> `b4e80e90`, `O4a` PR #203 -> `df5dd1df`, `O3` PR #207 -> `5eec8091`), and `prog/ws-ui` (`U0b` PR #202 -> `4627317f`), merged into `prog/int` (`f5ef8c4c`, `2ff2e0e8`, `8f707727`).
  - `O1` also documented the Atrium shader breakdown (8 unused pre-compiled programs `#31..#38` from hidden hologram `detail` points and hidden pick/reader/opening materials, plus 5 late-compiled programs) for follow-up in Wave A–D.
  - `O3` requested owner `preview` review in PR #207 to inspect windowed browser compositor pacing across rooms (`D10` preserved: `tier`/`scale` only, reflections untouched).
  - `U0b` verified Solid `2.0.3` + `@ui-sdk/solid 0.1.0-beta.16` + Vite `8.3.8` + Vitest `5.1.1` (`optimizeDeps.exclude: ['@ui-sdk/core']`, `86.82 kB` gzip for Solid + Listbox + Dialog, `skipLibCheck: true` for TS `7.0.2`, `settle()` + `userEvent.click`, and diagnostics contention notes for `F2`/`I5`/`U1`–`U8`); temporary spike code was discarded without merging.
  - **O4a D9 Measurement Summary (for `O8` / §12):** Conservative per-mesh world-AABB lamp culling in `public/js/room.js` met Decision `D9` (`>= 10%` GPU ms reduction, no room `> 1%` slower, `0` pixel diff on deterministic views) and is **KEPT**:
    - Fabrication (`projects`, `135 -> 94` material-lamp evaluations across `floorN` 15->7, `floorF` 15->11, `back` 15->1, `archL` 15->7, `archR` 15->8): Challenger HD 630 GPU median `50.32 -> 44.84 ms` (`-10.89%`, `passes.mjs` `gpu_sum` `50.63 -> 45.22 ms` / `-10.69%`, `scene` pass `32.88 -> 27.98 ms` / `-14.90%`; Worker median `50.71 -> 44.38 ms` / `-12.48%`).
    - Other 5 rooms on HD 630 (Challenger interleaved): Atrium `-2.62%` (`32.02 -> 31.18 ms`), Lounge `-0.12%` (`25.61 -> 25.58 ms`), Navigation `-0.62%` (`32.36 -> 32.16 ms`), Library `+0.04%` (`51.30 -> 51.32 ms`), Comms `+0.79%` (`20.23 -> 20.39 ms`, worst room within `+1%`).
    - Remaining unculled groups noted for `O8` / §12 later pass: Fabrication room-spanning/double-sided groups (`archC`, `polish`, `center`, `props` at 15/15), Navigation room-spanning baked groups (7 groups at 9/9 spotlights), and Library/Lounge unculled point lamps (`8/8` and `2/2`), which require a 3D-texture lamp grid or `O6d` mesh splitting to cull further.
