---
type: concept
title: The suite
depends: [docs/ref_suite.md, docs/ref_browser-scripts.md]
---
# The suite

`tools/check.sh` runs the suite, which is the `suite` tier.
It runs all checks of the content and of the reader in the rooms. It stops with the exit code 1 if a step failed.
It runs each step to its end, and then it lists the steps that failed, so that one run shows all failures.
On the CI host, the suite runs for approximately 15 to 35 minutes, and for more time when other jobs use the host.

## Sequence

- First, the suite runs the static checks. Then it installs the packages and runs `pnpm build`.
- Then it runs the browser steps that can run in parallel, `CHECK_JOBS` at a time.
- Last, it runs the steps of motion and stillness, `hud`, `turn` and `cue`, one at a time, because other work on the host can change their times.
- The browser steps use Docker, because `tools/dtest.sh` serves `dist/` inside a container.
- [The browser scripts](ref_browser-scripts.md) gives the scripts of the steps.

## The process groups of the steps

A step starts a browser in a container, and a container can continue after its client stops.
For this reason, the suite starts each step in a different process group, and it gives each container a label for the run.
When the suite stops, it can then stop all steps and remove all containers of the run.
See [the suite reference](ref_suite.md) for the directories of the steps and the signals.

## The recorder of the opening checks

Some opening checks make sure that a thing does not appear.
Such a check is correct only when the recorder records each frame.
When other jobs use the host, the recorder does not record all frames, and the check can pass when it must fail.
For this reason, the recorder measures the time between its measurements. When that time is too long, the check fails as a failure of the setup.
