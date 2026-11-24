# Agent Working Guide

Self-contained instructions for working on the Arcadia Station program (`explore/rolling-earth` line). Read this file and your task card from `docs/program-plan.md` before making changes.

## 1. Overview and Program Pointers

- **Line vs. default branch:** This work lives on the `explore/rolling-earth` line. GitHub's default branch is `v2-rewrite` (a different site) — never merge into or target `v2-rewrite` or `main`.
- **Canonical program documents:**
  - `docs/program-plan.md` — full architecture, rules (§5), environment (§6), wave order (§7), task cards (§8), gates (§9), PR template (§10).
  - `docs/program/status.md` — active wave, gate status, and task tracker (orchestrator-owned).
  - `docs/program/decisions.md` — owner decisions (`D1`–`D13`, `U0-contact`) and decision log (orchestrator-owned).
  - `docs/program/pr-template.md` — required PR body template passed via `--body-file`.
  - `docs/v1-contracts.md` — content schemas, URLs, static page generator, and runtime contracts.
  - `docs/program/ui-spec.md`, `docs/program/baseline.md`, `docs/program/dependencies.md`, `docs/opt-pass-2-report.md` — created and updated by their owning cards (`U0`, `I2`, `D3`, `O0`/`O8`).

## 2. Repository Layout (Target & Pre-F1 Transition)

### Target layout (§4.1, after `F1` Layout Freeze)

```text
index.html            the shell; Vite's entry. tools/site.py builds every page from the built copy
src/
  main.ts             creates the station (engine) and mounts the page layer
  engine/             three.js. No DOM except the canvas
    station.ts        the boundary: createStation(canvas, content, site) -> Station (§4.2)
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

### Pre-F1 layout (Wave A, before `F1` lands)

Until `F1` (Layout Freeze) merges, `src/`, `dist/`, and `node_modules/` do not exist yet. The live site lives under `public/`:

- `public/index.html`, `public/main.js`, `public/js/*.js` (including `js/opening/`), `public/style.css`, `public/post.css`, `public/content.json`.
- `tools/*.py`, `tools/*.sh`, and `tools/docker/*.mjs` hold the static generator, unit tests, and Docker/Playwright scripts (migrated to `tools/ci/` and `tests/e2e/` by `I1` and `T1`).

> **Note for Wave C (`U1`+):** Task `U1` will append the installed Solid 2.0 / UI SDK primer and docs paths here once `pnpm` dependencies are added.

## 3. Branching, Default-Branch Warning, and Remotes (§5.1)

```text
explore/rolling-earth      the owner's line — no agent merges into it
  prog/int                 integration — only the orchestrator merges into it
    prog/ws-infra          checks and test tooling          (tasks I*)
    prog/ws-opt            optimization pass                (tasks O*)
    prog/ws-found          build, TypeScript, boundary      (tasks F*, D*)
    prog/ws-ui             page layer and its tests         (tasks U*, T*)
      prog/<ID>-<slug>     one task: cut from its workstream branch, one PR back into it
```

- **Mandatory `--base` warning:** GitHub's default branch is `v2-rewrite` (a different site). **NEVER** merge into or target `main` or `v2-rewrite`. Always pass `--base prog/ws-<name>` on task PRs (or `--base prog/int` / `--base explore/rolling-earth` for workstream/gate PRs).
- **Merge flow:** Task PRs target `prog/ws-<name>` and are squash-merged. Workstream branches merge into `prog/int` with a merge commit (at gates or when another workstream needs the changes), and `prog/int` is merged back into every other workstream branch. At gates, the orchestrator merges `explore/rolling-earth` into `prog/int`. Never rebase or force-push shared branches.
- **Isolated worktrees:** Cut every task in its own worktree under `/tmp/wt-<ID>-<slug>`. Never edit checked-out files in the main repository clone, never touch `/home/ubuntu/Projects/.arcadia-*`, and leave unrelated branches/worktrees (`review/*`, `feat/*`, `opt/*`) alone.
- **Dual remotes:**
  - `origin` — GitHub (for pull requests).
  - `ci` — `ssh://arcadia-ci/srv/arcadia/repo.git` (for running checks on the CI host).
  - Push every branch to both `ci` (for checks) and `origin` (for PRs).
  - The repository is public and has no hosted CI on this line — **do NOT add a GitHub Actions self-hosted runner**.

## 4. Task Workflow and PR Review (§5.2, §5.3, §5.8, §10)

### Six-step task loop

1. **Fetch and branch in an isolated worktree:**
   ```sh
   git fetch origin && git fetch ci
   git worktree add -b prog/<ID>-<slug> /tmp/wt-<ID>-<slug> origin/prog/ws-<name>
   ```
2. **Read before editing:** Read the card in `docs/program-plan.md` (§8), all files it names, `docs/program/decisions.md`, and `docs/v1-contracts.md` (plus `docs/program/ui-spec.md` after `U0`). If the card asks for numbers, measure the "before" baseline first.
3. **Iterate in small commits and run cheap checks on `ci`:**
   ```sh
   git push ci HEAD:prog/<ID>-<slug>
   ssh arcadia-ci '/srv/arcadia/bin/ci prog/<ID>-<slug> static'
   ```
4. **Sync with the workstream branch and run all card tiers before opening the PR:**
   ```sh
   git fetch origin && git merge --no-edit origin/prog/ws-<name>
   git push ci HEAD:prog/<ID>-<slug>
   ssh arcadia-ci '/srv/arcadia/bin/ci prog/<ID>-<slug> static'
   # plus every other tier required by the card
   ```
5. **Push to `origin` and open the PR with `--base` and `--body-file`:**
   GitHub only auto-loads `.github/` PR templates from its default branch (`v2-rewrite`), so copy `docs/program/pr-template.md` to an untracked/gitignored path (e.g., `.agent-chat/pr-<ID>.md`), fill every section, and pass `--body-file`:
   ```sh
   git push -u origin prog/<ID>-<slug>
   gh pr create --base prog/ws-<name> --title "<plain sentence>" --body-file .agent-chat/pr-<ID>.md
   ```
6. **Answer review comments:** A task is done when the pull request is merged, not when it is opened.

### Pull request review (§5.8, §10)

- A second agent reviews each PR against the card: every "Done when" line against shown evidence, re-running one check tier on the PR head (`ssh arcadia-ci '/srv/arcadia/bin/ci prog/<ID>-<slug> <tier>'`), verifying no out-of-scope paths changed, scanning for private info, checking docs match the code, and confirming no tests were removed or weakened. Style is the linter's job.
- Because agents act under the same GitHub account, GitHub disallows self-approval (`gh pr review --approve`). Post the review verdict via `gh pr comment <number>`:
  - `gh pr comment <number> --body "merge"` when ready to merge, or
  - `gh pr comment <number> --body "changes needed ..."` listing findings most serious first with file and line.
- The orchestrator squash-merges approved task PRs into `prog/ws-<name>`.

## 5. Commits, Secrecy, and `.agent-chat/` (§5.4)

- **Commit messages:** Use a plain-sentence subject describing what the site or tool now does (match `git log`). **Do NOT use prefixes** such as `feat:`, `fix:`, or `chore:`. Explain why and include measurements in the body. Keep the `Co-Authored-By:` trailer.
- **Public-repo secrecy:** Never write any `10.x.x.x` IP address, private hostname, token, secret, email address, or network detail into commits, files, pull requests, or comments. Always write `"the CI host"` and use the SSH alias `arcadia-ci`. Never read, print, or commit `.env` or `.dev.vars`. Never write the address returned by `ssh -G arcadia-ci` into any file, commit, PR, or comment.
- **Working scratch vs. tracked docs:** Keep any repo-local agent chat, scratch notes, or draft `--body-file` files inside `.agent-chat/` (already in `.gitignore`). Keep `docs/program/` tracked.

## 6. Evidence, Ownership, Freezes, Stop Rules, and Done Criteria (§5.5–§5.9)

### Evidence bar (§5.5)

- Every performance number is the **median of at least 3 runs**, with all individual runs listed. Before and after must be measured in the same session on the same machine.
- For GPU changes, **GPU ms** from the timer query is primary, with **frame ms** reported beside it.
- **"Pixel-identical"** means a maximum pixel difference of `0` on every state in the `pictures` list (`I2`). Before `I2` lands, verify with `snap` and `pdiff` on the states in `tools/detsnap.sh` (Atrium, Lounge, Fabrication, Navigation), comparing the base commit against yours.
- A gain inside run-to-run spread is no gain: close the PR with the measurements in the report (`O8`) instead of merging.
- Any intentional visual change requires before/after pictures and the owner's sign-off (§9).

### Ownership and freezes (§5.6)

| Paths | Owner |
|---|---|
| `tools/ci/**`, `tools/d*.sh`, `tools/docker/detsnap.mjs`, `tests/e2e/**` harness files | `ws-infra`, `T1` |
| `public/js/**`, `public/main.js`, `tools/pack.py` (until `F1`); `src/engine/**` (after) | `ws-opt` for the functions its cards name; `U6a` for `comms.js`; `ws-found` for everything else |
| `src/app/**`, `src/styles/**`, `tests/e2e/**` specs | `ws-ui`, one region per task |
| `tools/site.py` and its tests | `U6a` (contact page & `profile.json`), `F1` (`--shell`), `U10` (runtime ids); nobody else |
| `docs/program/status.md`, `docs/program/decisions.md` | the orchestrator |
| `docs/v1-contracts.md`, `README.md` | each task updates the lines about what it changed; `D1` does the final pass |

- Two open tasks never edit the same function (where two cards share a file/function, §7 sets the order).
- **Layout freeze (`F1`):** No PR touching `public/main.js`, `public/js/`, `public/index.html`, or `public/*.css` may be open while `F1` is produced and merged.
- **Boundary freeze (`F3`):** While `F3` is open, nobody else edits `src/main.*` or the files `F3` splits. After `F3`, any change to `src/engine/types.ts` or the `Station` interface (`src/engine/station.ts`) requires an entry in `docs/program/decisions.md` and notice to every open `ws-ui` task.
- **Engine/app boundary (§4.2):** The engine never reads or writes the DOM (except the canvas and any tracked exceptions until removed) and never imports `src/app/`. The page layer never reads a Solid signal inside `onFrame(...)`; Solid 2 applies writes in a microtask (call `flush()` before asserting DOM changes in tests).

### Stop-and-ask rules (§5.7)

Stop and report to the orchestrator (who escalates to the owner if needed) instead of working around:

- A picture changes and the card did not say it would.
- The baseline is red before you start, or a test fails that your change cannot explain.
- The card needs a dependency, a file, or an interface change it does not list.
- A test would have to be deleted or weakened rather than rewritten.
- The work turns out more than twice the size the card suggests.
- A package's release-age or audit policy blocks an install (do NOT loosen the policy).

### Done criteria checklist (§5.9)

- Every "Done when" criterion on the card is met and shown in the PR.
- `static` is green and all tiers named by the card are green on the PR head merged with its base.
- Tests exist for added or changed behavior; no test was removed without a replacement.
- After `F2`, the type-check baseline (`tools/ci/ts-baseline.txt`) did not grow.
- Docs describing what changed are updated in the same PR.
- `## Found but not fixed` lists any issues noticed outside the card.

## 7. CI, Preview, and Verification Commands (§6, §4.5, Local Fallback)

### CI host commands

Push first, then invoke the CI runner on `arcadia-ci` (both `/srv/arcadia/bin/ci` and `ci` on `PATH` work; `/srv/arcadia/bin/ci` delegates automatically to `tools/ci/run.sh` once `I1` lands):

```sh
git push ci HEAD:prog/<ID>-<slug>
ssh arcadia-ci '/srv/arcadia/bin/ci prog/<ID>-<slug> <tier> [args...]'
```

Output format: `ci <tier> <sha> PASS|FAIL <seconds>s  <job folder>` with logs, `result.json`, and `out/` artifacts under `/srv/arcadia/jobs/<job>/`.

### Preview

```sh
ssh arcadia-ci '/srv/arcadia/bin/preview prog/<ID>-<slug> [port]'
```

- Port `8080` is reserved for `prog/int`; ports `8081`–`8089` are for task branch previews.
- Never write the CI host's address into any file, commit, or PR; look it up locally via `ssh -G arcadia-ci` only when giving a preview URL to the owner in-session.

### Tiers

- **Pre-F1 / §6 tiers:**
  - `static` — `tools/content.py`, Python unit tests (`tools/test_*.py`), `tools/site.py`
  - `smoke` — `errs.mjs` across all six rooms
  - `script <name.mjs> [args]` — run a single script from `tools/docker/`
  - `suite` — full functional suite (`tools/check.sh`, parallelized by `I3`)
  - `bench "<query>" [runs] [seconds]` — frame/GPU ms, draw calls, memory, bytes
  - `snap <name> <state=query>...` — deterministic snapshots
  - `pdiff <jobA>/out/<n> <jobB>/out/<n>` — pixel diff between two `snap` runs
  - `pictures` (added in `I2`) — deterministic golden comparison across all six rooms (`max diff == 0`)
  - `perf` (added in `O0`) — performance suite
- **Post-F1 / §4.5 tiers (wired by `I5`):**
  - `static` (type check, lint, Python content checks & unit tests, `site.py`), `build`, `unit` (Vitest Node), `component` (Vitest Chromium), `e2e` (Playwright against `dist`), `pictures`, `perf` (against `tools/ci/budgets.json`).

### Locks and laptop / HD 630 rules

- **Locks on the CI host:** Browser/GPU tiers serialize on `gpu.lock`; `bench` takes an exclusive `quiet.lock` (shared by other tiers) so benchmarks run alone.
- **Laptop & HD 630:** Keep builds and test suites off the laptop (it runs services the CI host depends on). HD 630 measurements run one at a time via `tools/ci/hd630.sh` after `O0` lands (through the orchestrator before `O0`).

### Local `static` fallback

If `arcadia-ci` is unreachable or for quick pre-push validation, run the Python checks locally (pass `--out` to `site.py` so generated files stay outside the worktree):

```sh
python3 tools/content.py
for t in tools/test_*.py; do python3 -m unittest -q "$t" || exit 1; done
python3 tools/site.py --out <temp_dir>   # pass --out so generated pages stay out of public/, then delete <temp_dir>
```
