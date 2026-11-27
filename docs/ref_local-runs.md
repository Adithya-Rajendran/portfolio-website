---
type: reference
title: Local runs of the tiers
depends: [docs/ref_ci-tiers.md]
---
# Local runs of the tiers

This reference gives the commands and the environment variables for [the check tiers](ref_ci-tiers.md) on a local machine, without `CI_HOME` or an external server.

## Commands

```bash
tools/ci/run.sh static
tools/ci/run.sh smoke
tools/ci/run.sh script rooms.mjs
tools/ci/run.sh snap s1 "lobby-hero=/?shot=hero&scale=1&tier=0&chand=30&rollat=45"
tools/ci/run.sh pdiff /path/to/s1 /path/to/s2
tools/ci/run.sh pictures
tools/ci/run.sh pictures --against origin/prog/ws-infra
```

## Environment variables

| Variable | Use |
|---|---|
| `ASSETS` | The path of the packed rooms. Without it, the tools use `$ROOT/public/assets`. If that directory is not there, a Git worktree uses `public/assets` of the main checkout. |
| `ORIGIN` | An external origin, for example `http://host:8080`. Without it, the Docker tools mount `$ROOT/dist` and `$ASSETS`, and serve the checkout inside the container with `node serve.mjs /site 8080`. |
| `OUT` | The directory for the screenshots and the output. The default is `$CI_JOB/out` in CI, `/tmp/arcadia-ci-out` for `run.sh`, `/tmp/dtest` for `dtest.sh`, `/tmp/dshot` for `dshot.sh`, `/tmp/snap` for `dsnap.sh` and `/tmp/detsnap/<name>` for `detsnap.sh`. |
| `CHECK_JOBS` | The number of browser workers that run at the same time in `tools/check.sh`. The default is 8. |
| `SNAP` | The base directory of `tools/pdiff.sh`. The default is `/tmp/detsnap`. |
| `PLAYWRIGHT_IMAGE`, `PLAYWRIGHT_E2E_IMAGE` | The Docker images of the browser scripts and of the `e2e` tier. The default values are `mcr.microsoft.com/playwright:v1.64.1-noble` and `mcr.microsoft.com/playwright:v1.65.1-noble`. |

- All Docker tools mount `lobby_pw_modules:/w:ro` as read only.
- Each container copies `/work/*.mjs` into a different temporary directory, so two runs at the same time do not write over the scripts of each other.
