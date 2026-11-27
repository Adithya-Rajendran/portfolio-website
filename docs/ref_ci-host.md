---
type: reference
title: The CI host files and locks
depends: [docs/ref_ci-tiers.md, docs/ref_hd630-runner.md]
---
# The CI host files and locks

This reference gives the programs of the CI host, the scripts in `tools/ci/` and the locks of the jobs.

## Scripts in tools/ci/

| Script | Use |
|---|---|
| `tools/ci/run.sh` | Runs [the check tiers](ref_ci-tiers.md), on the CI host or on a local machine. |
| `tools/ci/hd630.sh` | Runs the `perf` and `bench` measurements on a local Intel HD 630. See [the HD 630 runner](ref_hd630-runner.md). |
| `tools/ci/preview.sh` | Prepares a checkout for a preview. |
| `tools/ci/serve.sh` | Serves the `dist/` that `preview.sh` prepares. |
| `tools/ci/pictures.txt` | The list of the fixed states of the `pictures` tier. |
| `tools/ci/legacy.txt`, `tools/ci/legacy.py` | The legacy list of the documentation and comment checks, and its parser. |

## Programs of the host

| Program | Use |
|---|---|
| `/srv/arcadia/bin/ci <ref> <tier> [args...]` | Copies `<ref>` with `git archive` into a clean job directory. Holds `quiet.lock` on file descriptor 8. Then runs `CI_JOB="$job" CI_HOME="$A" tools/ci/run.sh <tier> "$@"`. |
| `/srv/arcadia/bin/preview <ref> [port]` | Copies `<ref>` into `$CI_HOME/preview/<port>/next`, runs `CI_HOME="$A" tools/ci/preview.sh`, and then replaces `src` with `next`. Then it starts the service `arcadia-preview@<port>`. |
| `/srv/arcadia/bin/preview-serve` | The program of the service `arcadia-preview@<port>`. It runs `tools/ci/serve.sh <bind address> <port>`, or `tools/serve.py` when the checkout has no `serve.sh`. |

- `preview.sh` runs `pnpm build`. Then it makes `dist/assets` a symbolic link to `$ASSETS`, so that `serve.sh` can serve the packed rooms.

## Locks

[The check tiers](ref_ci-tiers.md) give the locks that each tier holds.

| Lock | Program | Use |
|---|---|---|
| `$CI_HOME/quiet.lock` | `/srv/arcadia/bin/ci`, before `run.sh` | Shared (`-s`) or exclusive (`-x`). A job that holds it as exclusive runs alone, so that its measurements are correct. `run.sh` does not lock it again. |
| `$CI_HOME/gpu.lock` | `tools/ci/run.sh`, when `CI_HOME` has a value | Gives the GPU and the browser to one job at a time. |
| `$CI_HOME/cache/pack.lock` | `tools/ci/run.sh` | Locks the cache while it packs the rooms into `$CI_HOME/cache/assets/<key>`. |
| `$CI_HOME/cache/pictures.lock` | `tools/ci/run.sh` | Locks the cache while it moves a golden directory into `$CI_HOME/cache/pictures/<commit_sha>_<list_hash>/` in one operation. |
