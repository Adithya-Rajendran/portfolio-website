---
type: concept
title: The CI host
depends: [docs/ref_ci-tiers.md, docs/ref_ci-jobs.md, docs/ref_hd630-runner.md]
---
# The CI host

The CI host runs the check tiers on the commits that a person pushes to it.
The repository holds the tiers in `tools/ci/`, and the scripts of the host call them.

## Scripts in tools/ci/

| Script | Use |
|---|---|
| `tools/ci/run.sh` | Runs [the check tiers](ref_ci-tiers.md), on the CI host or on a local machine. |
| `tools/ci/hd630.sh` | Runs the `perf` and `bench` measurements on a local Intel HD 630. See [the HD 630 runner](ref_hd630-runner.md). |
| `tools/ci/preview.sh` | Prepares a checkout for a preview. |
| `tools/ci/serve.sh` | Serves the site that `preview.sh` prepares. |
| `tools/ci/pictures.txt` | The list of the fixed states of the `pictures` tier. |
| `tools/ci/legacy.txt`, `tools/ci/legacy.py` | The legacy list of the documentation and comment checks, and its reader. |

## How the host runs a tier

- `/srv/arcadia/bin/ci <ref> <tier> [args...]` copies `<ref>` with `git archive` into a clean job directory, which has no `.git`.
- The script holds `quiet.lock` on file descriptor 8.
- Then it runs `CI_JOB="$job" CI_HOME="$A" tools/ci/run.sh <tier> "$@"`.
- The job writes its results to [the job directory](ref_ci-jobs.md).

## How the host serves a preview

- `/srv/arcadia/bin/preview <ref> [port]` copies `<ref>` into `$CI_HOME/preview/<port>/next`.
- It runs `CI_HOME="$A" tools/ci/preview.sh`, and then it replaces `src` with `next`.
- It starts the service `arcadia-preview@<port>`, which runs `tools/ci/serve.sh 0.0.0.0 <port>`.
- `preview.sh` makes `public/assets` a symbolic link to `$ASSETS`, so that `serve.sh` can serve the packed rooms.

## Locks

| Lock | Program | Use |
|---|---|---|
| `$CI_HOME/quiet.lock` | `/srv/arcadia/bin/ci`, before `run.sh` | Shared (`-s`) for most tiers. Exclusive (`-x`) for `bench` and for `perf` except `perf blurdiff`, so that measurements run alone. `run.sh` does not lock it again. |
| `$CI_HOME/gpu.lock` | `tools/ci/run.sh`, when `CI_HOME` has a value | Locks the GPU during the tiers that use the GPU or a browser: `smoke`, `script`, `suite`, `bench`, `snap`, `pictures`, `e2e`, and `perf` except `blurdiff`. |
| `$CI_HOME/cache/pack.lock` | `tools/ci/run.sh` | Locks the cache while it packs the rooms into `$CI_HOME/cache/assets/<key>`. |
| `$CI_HOME/cache/pictures.lock` | `tools/ci/run.sh` | Locks the cache while it moves a golden directory into `$CI_HOME/cache/pictures/<commit_sha>_<list_hash>/` in one operation. |
