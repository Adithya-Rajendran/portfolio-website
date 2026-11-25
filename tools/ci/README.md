# CI Checks and Previews

The repository owns its check tiers and preview setup under `tools/ci/`:

- `tools/ci/run.sh`: executes check tiers when invoked by the CI host (`/srv/arcadia/bin/ci`) or locally.
- `tools/ci/preview.sh`: prepares a checkout for previewing (`/srv/arcadia/bin/preview`).
- `tools/ci/serve.sh`: serves the prepared site (`/srv/arcadia/bin/preview-serve`).

## How the CI Host Delegates

Push a branch to the `ci` remote, then invoke `/srv/arcadia/bin/ci` or `/srv/arcadia/bin/preview` over SSH (`ssh arcadia-ci`):

1. `/srv/arcadia/bin/ci <ref> <tier> [args...]` extracts `<ref>` via `git archive` into a clean job source directory (with no `.git`), acquires `quiet.lock` on fd 8, and executes `CI_JOB="$job" CI_HOME="$A" tools/ci/run.sh <tier> "$@"`.
2. `/srv/arcadia/bin/preview <ref> [port]` extracts `<ref>` into `$CI_HOME/preview/<port>/next`, executes `CI_HOME="$A" tools/ci/preview.sh`, swaps `next` into `src`, and starts `arcadia-preview@<port>`, which invokes `tools/ci/serve.sh 0.0.0.0 <port>`.

## Check Tiers

| Tier | Arguments | What It Runs | Locks |
|---|---|---|---|
| `static` | none | `tools/content.py`, `tools/test_*.py`, `tools/site.py` | `quiet.lock` (shared) |
| `smoke` | none | `errs.mjs` across `/`, `/?room=about`, `/?room=projects`, `/?room=experience`, `/?room=comms`, `/blog/` | `quiet.lock` (shared), `gpu.lock` |
| `script` | `<name.mjs> [args...]` | Single `tools/docker/<name.mjs>` script via `tools/dtest.sh` | `quiet.lock` (shared), `gpu.lock` |
| `suite` | none | Full `tools/check.sh` static preflight, parallel browser batch (`CHECK_JOBS`, default 8), and serial motion/stillness checks | `quiet.lock` (shared), `gpu.lock` |
| `bench` | `"<query>" [runs] [seconds]` | `tools/docker/bench.mjs` at `1920x1080` (`runs` default 3, `seconds` default 8) | `quiet.lock` (exclusive), `gpu.lock` |
| `snap` | `<name> <state=query>...` | Deterministic `1920x1080` screenshots (`detsnap.mjs`, 60 frames) into `$OUT/<name>/` | `quiet.lock` (shared), `gpu.lock` |
| `pdiff` | `<jobA/out/name> <jobB/out/name>` | Pixel difference (`pdiff.mjs`) in Docker without GPU device or `gpu.lock` | `quiet.lock` (shared) |
| `pictures` | `[--against <base>]` | Render fixed 34-state suite (`tools/ci/pictures.txt`), cache goldens by `<sha>_<list_hash>`, compare with `pdiff.mjs --strict --fail-max=0` | `quiet.lock` (shared), `gpu.lock`, `pictures.lock` |

## The Suite's Steps and Their Folders

`tools/check.sh` (tier `suite`) runs the static preflight, then the browser steps: the independent ones `CHECK_JOBS` at a time, then the motion and stillness steps (hud, turn, cue) one by one. Every browser step has its own folder under `$OUT/steps/`, and nothing is deleted at the end:

```text
$OUT/steps/
  01-rooms.cross.mjs_desktop/     NN: the order the steps start in (the parallel ones in queue order, then the serial ones)
    log.txt                       everything the step printed (the suite's output shows it again once the step ends)
    ...                           what the script wrote to /out (screenshots, JSON)
  02-rooms.read.mjs_desktop/
  ...
```

The folder name is the step's title with every character outside `A-Za-z0-9._-` turned into `_`, cut to 80 characters. The suite's own output ends with `=== summary`: `all steps passed`, or one `FAILED:` line per failed step. A step that did not report (the suite's wait failed) or was never started is listed as failed too, with `(did not report; stopped)` or `(not run)` after its name.

Stopping the suite (SIGINT, SIGTERM or SIGHUP, also during the serial steps) stops every running step. Each step is a process group of its own (`set -m`), which the trap kills whole, and the containers carry the label `arcadia.check=<run id>` (`CHECK_RUN`, passed to `tools/dtest.sh`), so any that outlive their client are removed with `docker rm -f`, also when a second signal arrives while the first is still cleaning up. Only those three signals, caught by the trap, clean up: because the steps are not in `check.sh`'s process group, a SIGKILL of `check.sh` (or any signal that kills it without the trap) leaves the steps and their containers running, and a signal sent to `check.sh`'s process group (a kill of `-<pgid>`, a terminal's Ctrl-C reaches only the foreground group, which is `check.sh`'s own) does not reach the steps except through that trap. A shell that starts `check.sh` as a background job (`check.sh &` in a script, with no job control) leaves SIGINT ignored for it, so SIGINT does nothing there; send SIGTERM. `tools/check-selftest.sh` shows it with stand-in steps (SIGTERM, SIGINT and SIGHUP in the parallel phase, SIGTERM in the serial phase, a step that ignores SIGTERM, a second signal during slow container removal, a failed `wait`, a normal run); it needs Docker and takes about a minute.

The recorder of `tools/docker/r2.kit.mjs` (used by `opening.mjs`) counts its samples and the largest gap between them; its "never" checks are only trusted when the gap is at most 250 ms, and otherwise fail as a set-up failure (`SET-UP, not the page`).

## Locks

- **`$CI_HOME/quiet.lock`**: acquired by `/srv/arcadia/bin/ci` before `run.sh` (shared `-s` for all tiers except `bench`, which takes exclusive `-x` so benchmarks run alone). `tools/ci/run.sh` never re-acquires `quiet.lock`.
- **`$CI_HOME/gpu.lock`**: acquired by `tools/ci/run.sh` around GPU/browser tiers (`smoke`, `script`, `suite`, `bench`, `snap`, `pictures`) when `CI_HOME` is set.
- **`$CI_HOME/cache/pack.lock`**: acquired around packing rooms into `$CI_HOME/cache/assets/<key>`.
- **`$CI_HOME/cache/pictures.lock`**: acquired around atomic golden directory swaps into `$CI_HOME/cache/pictures/<commit_sha>_<list_hash>/`.

## Job Artifacts and Asset Cache

- Each CI job writes to `$CI_JOB/` (`$CI_HOME/jobs/<timestamp>-<sha8>-<tier>-<pid>/`):
  - `result.json`: `{ "ref", "sha", "tier", "status", "seconds", "job" }`
  - `log.txt`: combined stdout/stderr from `tools/ci/run.sh`
  - `pack.log`, `site.log`: asset packing and static page generation logs
  - `out/`: screenshots and script outputs (`$OUT`; `pictures` writes `$OUT/current/` and `$OUT/heat/`)
- Asset caching uses a deterministic 20-character SHA-256 content-hash key computed from all files under `assets-src/` and `tools/pack.py` (works without `.git` in `git archive` extracts).
- Golden pictures cache on the CI host at `$CI_HOME/cache/pictures/<commit_sha>_<list_hash>/`, where `list_hash` is the first 12 hex characters of `sha256sum tools/ci/pictures.txt`. The current commit is always rendered fresh into `$OUT/current/`; when `--against` is omitted, it compares against its own cached golden (seeding the cache on the first run). When `--against <base>` is passed and `<base>`'s golden is missing, it is extracted via `git archive`, packed/reused via `cache/assets/`, and rendered with the current `tools/docker/detsnap.mjs`.
- `run.sh` keeps `$ROOT/public/assets` as an **empty directory** (never a symlink) so Docker can bind-mount `$ASSETS` at `/site/assets:ro`. `preview.sh` symlinks `public/assets` to `$ASSETS` for host-side serving via `tools/ci/serve.sh`.

## Local Usage

Every tier and Docker helper runs locally without `CI_HOME` or external server dependencies:

```bash
tools/ci/run.sh static
tools/ci/run.sh smoke
tools/ci/run.sh script rooms.mjs
tools/ci/run.sh snap s1 "lobby-hero=?room=lobby&shot=hero&scale=1&tier=0&chand=30&rollat=45"
tools/ci/run.sh pdiff /path/to/s1 /path/to/s2
tools/ci/run.sh pictures
tools/ci/run.sh pictures --against origin/prog/ws-infra
```

Environment variables:

- `ASSETS`: path to packed `public/assets` directory. If unset, helpers check `$ROOT/public/assets` and then the main git checkout's `public/assets` (for git worktrees).
- `ORIGIN`: optional external origin (e.g. `ORIGIN=http://host:8080`). When unset, Docker helpers mount `$ROOT/public` and `$ASSETS` and serve the checkout inside the container via `node serve.mjs /site 8080`.
- `OUT`: host output directory for screenshots and artifacts (defaults to `$CI_JOB/out` in CI, `/tmp/arcadia-ci-out` in `run.sh`, `/tmp/dtest` in `dtest.sh`, `/tmp/dshot` in `dshot.sh`, `/tmp/snap` in `dsnap.sh`, `/tmp/detsnap/<name>` in `detsnap.sh`).
- `CHECK_JOBS`: number of concurrent browser workers in `tools/check.sh` Phase 2 (default `8`).
- `SNAP`: base directory for `tools/pdiff.sh` (defaults to `/tmp/detsnap`).

All Docker helpers mount `lobby_pw_modules:/w:ro` read-only and copy `/work/*.mjs` into an ephemeral per-container `mktemp -d` directory, so concurrent runs never overwrite each other's scripts.
