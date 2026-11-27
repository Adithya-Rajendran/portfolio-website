---
type: reference
title: The HD 630 runner
depends: [docs/ref_ci-tiers.md]
---
# The HD 630 runner

This reference tells how `tools/ci/hd630.sh` runs measurements on a local Intel HD 630 from a clean copy of a commit.

It does not serve a worktree with changes.

```bash
tools/ci/hd630.sh <ref> [perf] <passes|cpuprof|unpinned|load|loadprof|blurdiff|bench> [args...]
```

## Sequence

1. It holds the exclusive lock `flock -w 3600 /tmp/arcadia-local-hd630.lock` (`HD630_LOCK`, `HD630_LOCK_WAIT`).
2. It copies `<ref>` with `git archive` into a temporary source directory, which it deletes at the end.
3. It uses the `public/assets` that has the same key, or it packs the rooms into `${XDG_CACHE_HOME:-$HOME/.cache}/arcadia/hd630-assets/<key>` under `pack.lock`.
4. It runs `pnpm install` and `pnpm build`, and serves `dist/`.
5. It waits a maximum of `HD630_SETTLE` seconds, by default 120, until the load is below the limit.
6. It runs the measurement with `timeout -k 10s 300s` (`HD630_TIMEOUT`), without `--foreground`, so the signal goes to all of the process group.

A run that waits does not prepare while a different run measures, because the copy, the pack and the pages come after the lock.

## Signals and timeouts

- Each slow step runs as a child in the background, and `hd630.sh` waits for it.
- `hd630.sh` catches `INT`, `TERM` and `HUP`. It kills all processes below it at once, writes `"status": "interrupted"` and `"usable": false` in `result.json`, and stops. The exit code is 128 added to the number of the signal: 130, 143 or 129.
- A run that goes to the timeout is also not usable.
- `run.sh` names its Docker container from `CI_CONTAINER_NAME`, and `hd630.sh` removes that container at the timeout and at the end.
- The measurement writes its log to `$JOB/log.raw`, which the terminal shows. Then `hd630.sh` filters it into `log.txt`, so no output goes away after a signal.
- A SIGKILL of `hd630.sh` does not let it clean up. Its children keep the lock until they stop, until the timeout at the maximum. The next run removes the stale `src` directories and the `arcadia-hd630-*` containers under its lock.
- When the `run.sh` of a commit has no `perf` case, `hd630.sh` runs the scripts in `tools/docker/` of the checkout that starts it, on the site of that commit.

## Load and results

- `hd630.sh` reads `/proc/loadavg` before and after the measurement, inside the lock.
- It writes `$JOB/log.txt` and `$JOB/result.json` under `${HD630_JOBS:-${XDG_STATE_HOME:-$HOME/.local/state}/arcadia/hd630-jobs}`.
- If `load1_before` or `load1_after` is more than `HD630_MAX_LOAD`, the run is not usable: `"usable": false, "unusable": true`, and `UNUSABLE` in the last line of the output. The default limit is `$(nproc) / 2`, which is 4 on the i7-7700HQ with 8 threads.
- A run that is not usable keeps its logs and returns the exit code of the measurement.
- [The perf tier](ref_ci-tiers.md) gives the subcommands.
