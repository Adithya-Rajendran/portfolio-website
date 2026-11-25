# CI Checks and Previews

The repository owns its check tiers and preview setup under `tools/ci/`:

- `tools/ci/run.sh`: executes check tiers when invoked by the CI host (`/srv/arcadia/bin/ci`) or locally.
- `tools/ci/hd630.sh`: runs `perf` / `bench` measurements on the local Intel HD 630 from a clean `git archive` copy under an exclusive lock and load-average guard.
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
| `suite` | none | Full `tools/check.sh` browser and static suite | `quiet.lock` (shared), `gpu.lock` |
| `bench` | `"<query>" [runs] [seconds]` | `tools/docker/bench.mjs` at `1920x1080` (`runs` default 3, `seconds` default 8) | `quiet.lock` (exclusive), `gpu.lock` |
| `snap` | `<name> <state=query>...` | Deterministic `1920x1080` screenshots (`detsnap.mjs`, 60 frames) into `$OUT/<name>/` | `quiet.lock` (shared), `gpu.lock` |
| `pdiff` | `<jobA/out/name> <jobB/out/name>` | Pixel difference (`pdiff.mjs`) in Docker without GPU device or `gpu.lock` | `quiet.lock` (shared) |
| `pictures` | `[--against <base>]` | Render fixed 34-state suite (`tools/ci/pictures.txt`), cache goldens by `<sha>_<list_hash>`, compare with `pdiff.mjs --strict --fail-max=0` | `quiet.lock` (shared), `gpu.lock`, `pictures.lock` |
| `perf` | `<subcommand> [args...]` | Performance subcommands: `passes`, `cpuprof`, `unpinned`, `load`, `loadprof`, `bench` (with `gpu.lock`), and `blurdiff` (`<dirA> <dirB>` or image pairs, no GPU) | `quiet.lock` (exclusive on the CI host, like `bench`, except `perf blurdiff`, which is shared), `gpu.lock` (except `blurdiff`) |

## Locks

- **`$CI_HOME/quiet.lock`**: acquired by `/srv/arcadia/bin/ci` before `run.sh` (shared `-s` for all tiers except `bench` and `perf` (other than `perf blurdiff`), which take exclusive `-x` so measurements run alone). `tools/ci/run.sh` never re-acquires `quiet.lock`.
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
- `SNAP`: base directory for `tools/pdiff.sh` (defaults to `/tmp/detsnap`).

All Docker helpers mount `lobby_pw_modules:/w:ro` read-only and copy `/work/*.mjs` into an ephemeral per-container `mktemp -d` directory, so concurrent runs never overwrite each other's scripts.

## Local HD 630 Runner (`tools/ci/hd630.sh`)

Run local GPU and loading benchmarks on the Intel HD 630 from a clean commit archive (never serving a dirty worktree):

```bash
tools/ci/hd630.sh <ref> [perf] <passes|cpuprof|unpinned|load|loadprof|blurdiff|bench> [args...]
```

- **Clean archive & asset cache:** Extracts `<ref>` via `git archive` into a temporary source directory (deleted on exit), reuses matching `public/assets` or packs into `${XDG_CACHE_HOME:-$HOME/.cache}/arcadia/hd630-assets/<key>` under `pack.lock`, and runs `tools/site.py`, all **after** acquiring the HD 630 lock, so a waiting run never prepares while another measures; it then waits up to `HD630_SETTLE` (default 120) seconds for the load average to drop to the limit before sampling "before".
- **Serialization & timeout:** Acquires exclusive `flock -w 3600 /tmp/arcadia-local-hd630.lock` first (`HD630_LOCK`, `HD630_LOCK_WAIT`), then runs the measurement under `timeout -k 10s 300s` (`HD630_TIMEOUT`; without `--foreground`, so the whole process group is signalled). `run.sh` names its Docker container from `CI_CONTAINER_NAME`, and `hd630.sh` removes that container on timeout and on exit.
- **Load average check & artifacts:** Reads `/proc/loadavg` before and after the measurement inside the lock and writes `$JOB/log.txt` and `$JOB/result.json` under `${HD630_JOBS:-${XDG_STATE_HOME:-$HOME/.local/state}/arcadia/hd630-jobs}`. If `load1_before` or `load1_after` exceeds `HD630_MAX_LOAD` (default `$(nproc) / 2`, i.e., `4` on the 8-thread i7-7700HQ), the run is marked `"usable": false, "unusable": true` (`UNUSABLE` in the summary line) while preserving logs and returning the measurement exit code.