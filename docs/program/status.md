# Program Status

Updated: 2026-11-26 (Gate G1 passed; Wave A2 under way: O7 texture streaming, the window-edge flicker fix and I2b, ahead of F1)

## Current Wave & Gate

- **Active Wave:** Wave A2 — O7 (before F1; O7a in review, O7b in progress), the window-edge flicker fix, and I2b
- **Active Gate:** `G1` **PASS** (next gate: `G2`, after F1)
- **Base Commit:** `explore/rolling-earth` at `6390b52ded91146778685eebd4c3224f82c9a914`
- **Integration Branch:** `prog/int`
- **Workstream Branches:** `prog/ws-infra`, `prog/ws-opt`, `prog/ws-found`, `prog/ws-ui`

## Gates

| Gate | When | Status | Date | Evidence / Notes |
|---|---|---|---|---|
| G0 | after P0 | **PASS** | 2026-11-24 | Verified on `prog/int` (`c37f311eff8d5bdf9708fa174b6e7eef0a76092c`): `static` PASS 13s, `smoke` PASS 28s, `suite` PASS 3029s, local Python `content.py` + 141/141 unit tests OK, preview on 8080 serving |
| G1 | end of wave A | **PASS** | 2026-11-26 | `suite` PASS on both CI hosts at `2774661` (847 s, 842 s), `e2e` PASS, `static` PASS. Pictures against `explore/rolling-earth`: only `comms-contact` (intended Contact change, owner signed, D21) and `writing-book` (max 11, 0.064% of pixels, caused by #211's deterministic page-edge texture in `drone.js`, intended). Owner look passed (D21). HD 630 sitting (D15) done, 113 runs. See the G1 notes below |
| G2 | F1 merged | pending | — | Layout freeze; built `dist/` passes suite, pictures 0, requests & bytes reported |
| G3 | F3 merged, U0 written | pending | — | Engine boundary frozen; page-layer spec (`U0`) & styling (`D6`) signed |
| G4 | U2 to U8 merged | pending | — | Legacy shell gone, `e2e` green x3 (incl. keyboard walk & WebKit/Firefox smoke), `component` green, pictures 0, `perf` within budgets, D11 decided |
| G5 | every card merged or closed | pending | — | PR from `prog/int` to `explore/rolling-earth` with optimization report & release checklist |

## Tasks

All 48 task cards from `docs/program-plan.md` §7.1 (F4a to F4d listed one by one; I2b, F7, C1 and U11 added since the last update):

| ID | Card | Workstream | Wave | After | Size | Status | Branch / PR | Notes / Closure Reason |
|---|---|---|---|---|---|---|---|---|
| I1 | The checks live in the repository | infra | A | P0 | M | done | `prog/I1-ci-in-repo` / PR #204 | Checks in `tools/ci/`, isolated Docker scripts, private address scrubbed |
| I2 | Golden pictures and the recorded baseline | infra | A | I1 | M | done | PR #211 | Deterministic 34-state `pictures` tier and recorded baseline |
| I3 | The browser suite runs in parallel | infra | A | I1 | M | done | PR #217, #219, #221 | Eight steps at a time, about 14 minutes (847 s and 842 s at gate G1); #219 stops every step and container on interrupt; #221 removes containers even when a second signal arrives during cleanup |
| I4 | The team's working files | infra | A | P0 | S | done | `prog/I4-working-files` / PR #201 | `AGENTS.md`, `CLAUDE.md`, `docs/program/pr-template.md` |
| I2b | Pictures that never flake | infra | B | I2 | S | in progress | — | Three single-pixel flakes on 2026-11-25 (`comms-contact`/`comms-hero-t1`, `lobby-inspect`, `lobby-sky-180`); cause to be named, 20 runs across both hosts at max 0 |
| I5 | Checks for the built site | infra | B | F2 | S | pending | — | — |
| O0 | The measuring tools are in the repository | opt | A | I1 | S | done | PR #215 | Perf measuring scripts behind a `perf` tier, with the HD 630 runner |
| O1 | The load path wastes no time | opt | A | P0 | S | done | `prog/O1-load-path` / PR #205 | Atrium first frame at 50 Mbit/s and 20 ms improved; longest main-thread task in Atrium load 1378 -> 456 ms at gate G1 |
| O2 | Textures are requested as soon as scene.json is read | opt | A | O1 | M | done | PR #209 | Predicted room textures requested immediately after `scene.json` |
| O3 | The governor measures the GPU | opt | A | P0 | M | done | `prog/O3-governor` / PR #207 | Settles in 2-4 s and holds in all rooms at gate G1; owner look passed (D21) |
| O4a | A pixel walks only the lamps that can reach it | opt | A | P0 | M | done | PR #203, #218, #220 | D9 keep; #218 grid-cell lamp walk, #220 normalized lamp directions and lamp grid fetched by cell; 35% target met on the HD 630 (Fabrication -37.3%, Navigation -39.0%), no room >1% slower |
| O5 | The mirror at tier 1: pictures and numbers for a talk with the owner | opt | A | O0 | S | closed | — | Nothing left to find under D10 (D21) |
| O6a | The orrery's reflection costs less CPU | opt | A | O6b | S | closed | PR #213 (closed) | Gain within spread; on the HD 630 the cube-pass JavaScript is 1.63 ms against the 1.0 ms target, not met, recorded |
| O6b | World matrices are updated once a frame | opt | A | P0 | S | done | `prog/O6b-matrices` / PR #206 | `updateMatrixWorld` 0.18 ms on the HD 630 (target met), 0 pixel diff |
| O6c | The Library's drone is a few meshes | opt | A | I2 | M | closed | PR #216 (closed) | One mesh per material, pixel for pixel; the shadow-caster merge cost GPU +0.6 ms |
| O6d | One primitive for each baked group | opt | A | I2 | S | closed | `prog/O6d-one-primitive` (no PR) | Every baked group was already one primitive; merging the static strips changes pictures; deferred until after F5 (D14) |
| O7 | Stream textures: small levels first, one file per layer | opt | A2 | O2 (before F1) | L | in progress | PR #224 (O7a, open) | O7a: fetch the sky angle and orrery phase in use first, the other layers after the cover lifts; in review fixes. O7b: head/tail split of each KTX2 at pack time, in progress (D18, D19) |
| O8 | The report and the budgets | opt | D | every other O task | S | pending | — | — |
| F1 | A build step, and nothing else changes | found | freeze | gate G1, during the layout freeze | L | pending | — | Gate G1 has passed; starts after O7, the flicker fix and I2b |
| F2 | Type check, lint and unit tests, as a ratchet | found | B | F1 | M | pending | — | — |
| F3 | The engine behind one boundary | found | B | F2, O3, O6a, O6b | L | pending | — | — |
| F4a | Engine modules to TypeScript (`kit`, `sunlight`, `post`, `reflections`) | found | C | F3 | M | pending | — | — |
| F4b | Engine modules to TypeScript (`screens`, `hologram`, `routemap`) | found | C | F3 | M | pending | — | — |
| F4c | Engine modules to TypeScript (`reader3d`, `opening/*`, `display3d`) | found | C | F3 | M | pending | — | — |
| F4d | Engine modules to TypeScript (`drone`, `comms3d`) | found | C | F3 | M | pending | — | — |
| F5 | loadRoom in parts | found | D | F6 and O1 to O7 | L | pending | — | — |
| F6 | One home for the repeated helpers | found | D | F4a to F4d | M | pending | — | — |
| F7 | Without WebGL the page still reads | found | B | F1 | S | pending | — | Added 2026-11-26 |
| D1 | The contract and the README describe the new page | found | D | U8 | M | pending | — | — |
| D2 | Deploy | found | D | F1 | S | pending | — | — |
| D3 | Dependencies and how they are raised | found | D | U1 | S | pending | — | — |
| U0 | What the new page layer is | ui | A | P0 (finished once U0c has reported) | M | done | PR #212 | Page layer, scene-picks primitive and accessibility targets specified |
| U0b | Does the stack hold together (a spike, thrown away) | ui | A | P0 | S | done | `prog/U0b-stack-spike` / PR #202 | Findings in `docs/program/ui-spike-notes.md`; spike code not merged |
| U0c | The room's things as a primitive (a spike) | ui | A | U0b | M | done | PR #208 | Scene-picks primitive, D5 keyboard model and Station contract spike findings documented |
| T1 | End-to-end tests on Playwright's runner | ui | A | I1 | M | done | PR #214 | First end-to-end specs on Playwright's test runner |
| U1 | The page layer's skeleton | ui | C | F3 and gate G3 | M | pending | — | — |
| U2 | Brand, nav, hero, facts, hint | ui | C | U1 | M | pending | — | — |
| U3 | The inspect bar | ui | C | U1 | M | pending | — | — |
| U4 | The room's things: keyboard, screen reader, lock and cue | ui | C | U1, U0c, F4c | L | pending | — | — |
| U5 | The reader's frame | ui | C | U1, F4c | L | pending | — | Renders the article component instead of adopting the page's own article (D20) |
| U6a | Contact offers three links and nothing else | ui | A | O6b | M | done | PR #210 | Three ordered links; mail and send modes removed; `comms-contact` picture change signed (D21) |
| U6 | Contact's links belong to the page layer | ui | C | U1, F4d | M | pending | — | — |
| U7 | The cover, the offer, failures and the page's three modes | ui | C | U1 | M | pending | — | — |
| U8 | Addresses on the router, and the old shell goes | ui | D | U2 to U7 | L | pending | — | — |
| U9 | An agent can use the rooms (behind a switch) | ui | D | U4 | M | pending | — | — |
| C1 | Comments out | found | B | O7, flicker fix | M | pending | — | Removes existing code comments once the branches in flight have merged (D22); added 2026-11-26 |
| U10 | Styles and leftovers | ui | D | U8 | S | pending | — | — |
| U11 | The plain pages come from Solid at build time | ui | D | F1, U5 | L | pending | — | Go on U0d's conditions (D20); added 2026-11-26 |

## Pull Requests (GitHub, as of 2026-11-26)

| PR | State | Base | Title |
|---|---|---|---|
| #224 | OPEN | `prog/ws-opt` | Fetch the sky angle and orrery phase in use first, the other layers after the cover lifts |
| #223 | MERGED | `prog/ws-opt` | Weaker bloom, address switches only on dev hosts, rooms named only by path, developer pages left out of the deploy |
| #222 | MERGED | `prog/ws-ui` | Record the build-time Solid rendering spike: go with conditions |
| #221 | MERGED | `prog/ws-infra` | Remove the suite's containers even when a second signal arrives during cleanup |
| #220 | MERGED | `prog/ws-opt` | Normalize lamp directions and fetch the lamp grid by cell |
| #219 | MERGED | `prog/ws-infra` | Stop every step and container when the suite is interrupted |
| #218 | MERGED | `prog/ws-opt` | Walk only the lamps whose cone reaches a pixel's grid cell |
| #217 | MERGED | `prog/ws-infra` | Run the browser suite eight steps at a time, in about 14 minutes |
| #216 | CLOSED | `prog/ws-opt` | Draw the Library drone with one mesh per material, pixel for pixel |
| #215 | MERGED | `prog/ws-opt` | Put the perf measuring scripts behind a perf tier with the HD 630 runner |
| #214 | MERGED | `prog/ws-ui` | Run the first end-to-end specs on Playwright's test runner |
| #213 | CLOSED | `prog/ws-opt` | Render the orrery cube reflection from its own minimal scene |
| #212 | MERGED | `prog/ws-ui` | Specify the Solid page layer, scene-picks primitive, and accessibility targets |
| #211 | MERGED | `prog/ws-infra` | Add deterministic 34-state pictures tier and recorded baseline |
| #210 | MERGED | `prog/ws-ui` | Limit Contact to three ordered links and remove mail and send modes |
| #209 | MERGED | `prog/ws-opt` | Request predicted room textures immediately after scene.json |
| #208 | MERGED | `prog/ws-ui` | Document scene-picks primitive, D5 keyboard model, and Station contract spike findings |
| #207 | MERGED | `prog/ws-opt` | The governor measures the GPU (O3) |
| #206 | MERGED | `prog/ws-opt` | Update room scene world matrices once per frame in draw |
| #205 | MERGED | `prog/ws-opt` | Overlap KTX2 transcoding, texture upload, and shader compilation during room load |
| #204 | MERGED | `prog/ws-infra` | Move CI checks and preview setup into the repository and isolate Docker helpers |
| #203 | MERGED | `prog/ws-opt` | Cull per-mesh lamp lists in room.js using conservative world AABBs |
| #202 | MERGED | `prog/ws-ui` | Document Solid 2.0, UI SDK, Vite 8, and Vitest 5 stack spike findings |
| #201 | MERGED | `prog/ws-infra` | Add the team's working guide, entry pointer, and pull request template |
| #200 | OPEN | `v2-rewrite` | Bump the dev-tooling group across 1 directory with 5 updates |

## Notes

- **P0 / Gate G0 (2026-11-24):** `prog/int` bootstrapped from `explore/rolling-earth` (`6390b52ded91146778685eebd4c3224f82c9a914`) at `c37f311eff8d5bdf9708fa174b6e7eef0a76092c`; static, smoke and suite passed on the CI host; preview on port 8080 active.

- **Wave A Batch 1 (2026-11-24):** I4 (#201), I1 (#204), O6b (#206), O1 (#205), O4a (#203), O3 (#207) and U0b (#202) merged into `prog/int`. O4a met D9 on CI-host evidence at the time (Fabrication GPU -10.9%, worst room +0.79%); the HD 630 numbers were later taken at gate G1.

- **Wave A Batches 2-3 (2026-11-25 to 2026-11-26):**
  - Infra: I2 (#211) added the deterministic 34-state pictures tier; I3 (#217, with #219 and #221) runs the suite eight steps at a time in about 14 minutes and cleans up on interrupt; O0 (#215) put the perf scripts behind a `perf` tier with the HD 630 runner; T1 (#214) runs the first end-to-end specs on Playwright's runner.
  - Opt: O2 (#209) requests predicted textures right after `scene.json`; O4a follow-ups #218 and #220 (lamp grid walk by cell, normalized directions).
  - UI: U0 (#212) and U0c (#208) specified the page layer, scene-picks primitive and D5 keyboard model; U6a (#210) limited Contact to three ordered links.
  - Closed: #213 (O6a) closed, gain within the spread, and on the HD 630 the cube-pass JavaScript is 1.63 ms against the 1.0 ms target, not met, recorded; #216 (O6c) closed, the shadow-caster merge cost GPU +0.6 ms; O6d closed and deferred until after F5 (D14); O5 closed (D21).
  - U0d spike notes merged as #222: go with conditions (D20), which adds U11.
  - #223 merged into ws-opt at the owner's request: bloom at 75%, address switches only on dev hosts, rooms named only by path, developer pages left out of the deploy.
  - Owner decisions D14 to D22 are recorded in `docs/program/decisions.md`.

- **Gate G1 passed (2026-11-26):**
  - Checks: `suite` PASS on both CI hosts at `2774661` (847 s and 842 s), `e2e` PASS, `static` PASS.
  - Pictures against `explore/rolling-earth`: only `comms-contact` (intended Contact change, owner signed, D21) and `writing-book` (max 11, 0.064% of pixels, caused by #211's deterministic page-edge texture in `drone.js`, intended). Owner look passed (D21).
  - HD 630 sitting (D15) done, 113 runs. Tier 1 GPU, `prog/int` against `explore/rolling-earth`: Fabrication 51.29 -> 28.69 ms (-44.1%), Navigation 33.56 -> 20.70 ms (-38.3%), Atrium, Lounge, Library and Comms within +0.2% / -1.2%.
  - O4a 35% target met (Fabrication -37.3%, Navigation -39.0%), no room more than 1% slower, D9 keep. O3 settles in 2-4 s and holds in all rooms. O6b `updateMatrixWorld` 0.18 ms (met).
  - Not met: O0's Atrium tier-1 frame line is +11.6% against the planning record on every version (laptop CPU state; GPU matches).
  - Load at 50 Mbit/s: Atrium 12.5 -> 9.8 s (-21.9%), Lounge 11.9 -> 10.1 s (-14.9%).
  - CI-host savings (second host, Iris Xe): Fabrication GPU -43%, Navigation -35%, others 0%; first visit at 50 Mbit/s -9 to -18%; longest main-thread task in Atrium load 1378 -> 456 ms.

- **In flight (Wave A2):**
  - O7a (#224) is open and in review fixes; O7b (head/tail split of each KTX2, D19) is in progress.
  - Window-edge flicker: old (present in `explore/rolling-earth`), made worse by the governor; cause narrowed to baked geometry at window reveals; round 2 in progress on `prog/F-window-flicker`.
  - I2b is in progress.
  - #200 (dev-tooling bump, base `v2-rewrite`) is open and outside the program line.

- **Next:** O7 (before F1), the flicker fix and I2b; then F1 (layout freeze); then Wave B (F2, I5, F3, F7, C1), Wave C, and Wave D (including U11); atlas repacking (D18) at the end. The Library is the slowest room and is proposed as the next optimization target after O7.
