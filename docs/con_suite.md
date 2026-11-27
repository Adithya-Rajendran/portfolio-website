---
type: concept
title: The suite
depends: [docs/ref_browser-scripts.md]
---
# The suite

`tools/check.sh` runs the suite, which is the `suite` tier.
It runs all checks of the content and of the reader in the rooms. It stops with the exit code 1 if a step failed.
It runs each step, and then it lists the steps that failed.

## Phases

- First, the suite runs the static checks, and it makes the pages again.
- Then it runs the browser steps that can run in parallel, `CHECK_JOBS` at a time.
- Last, it runs the steps of motion and stillness, `hud`, `turn` and `cue`, one at a time.
- The browser steps use Docker, because `tools/dtest.sh` serves `public/` inside a container.
- [The browser scripts](ref_browser-scripts.md) gives the scripts of the steps.

## Directories of the steps

Each browser step has a directory under `$OUT/steps/`, and the suite does not delete them at the end.

```text
$OUT/steps/
  01-rooms.cross.mjs_desktop/     NN: the order the steps start in (the parallel ones in queue order, then the serial ones)
    log.txt                       everything the step printed (the suite's output shows it again once the step ends)
    ...                           what the script wrote to /out (screenshots, JSON)
  02-rooms.read.mjs_desktop/
  ...
```

- The name of the directory is the title of the step. Each character that is not in `A-Za-z0-9._-` changes to `_`, and the name has a maximum of 80 characters.
- The output of the suite ends with `=== summary`, then `all steps passed` or one `FAILED:` line for each step that failed.
- When the wait of the suite fails, a step without a report is a failed step with `(did not report; stopped)` after its name.
- A step that does not start is a failed step with `(not run)` after its name.

## Stop the suite

- SIGINT, SIGTERM and SIGHUP stop all steps that run, also during the serial steps.
- Each step is a different process group (`set -m`), and the trap kills all of the group.
- The containers have the label `arcadia.check=<run id>` (`CHECK_RUN`, which the suite gives to `tools/dtest.sh`). The trap removes the containers that continue after their client with `docker rm -f`.
- The trap removes the containers again until no container appears for one second. When its client stops, a container that Docker starts to create appears later, in the state Created. This also applies when a second signal comes during the first cleanup.
- Only these three signals clean up, because the trap catches them. The steps are not in the process group of `check.sh`, so a SIGKILL of `check.sh` does not stop the steps and their containers.
- A signal to the process group of `check.sh` does not go to the steps, except through the trap. A Ctrl-C in a terminal goes only to the foreground group, which is the group of `check.sh`.
- A shell that starts `check.sh` as a background job without job control, for example `check.sh &` in a script, makes SIGINT have no effect for it. Send SIGTERM.
- `tools/check-selftest.sh` shows this behavior with stand-in steps. It uses Docker, and it runs for approximately one minute.

## The recorder of the opening checks

- The recorder in `tools/docker/r2.kit.mjs`, which `opening.mjs` uses, counts its samples and the maximum time between two samples.
- A check that a thing does not appear is correct only when that time is a maximum of 250 ms. If the time is more, the check fails as a failure of the setup, with the text `SET-UP, not the page`.
