---
type: reference
title: The job directory and the caches
depends: []
---
# The job directory and the caches

This reference gives the files that a CI job writes and the caches of the CI host.

## Job directory

Each job writes to `$CI_JOB/`, which is `$CI_HOME/jobs/<timestamp>-<sha8>-<tier>-<pid>/`.

| File | Contents |
|---|---|
| `result.json` | `{ "ref", "sha", "tier", "status", "seconds", "job" }` |
| `log.txt` | The output of `tools/ci/run.sh`, with its errors. |
| `pack.log`, `site.log` | The logs of the pack tool and of the page generator. |
| `out/` | The screenshots and the output of the scripts (`$OUT`). The `pictures` tier writes `$OUT/current/` and `$OUT/heat/`. |

The last line of a job is `ci <tier> <sha8> PASS|FAIL <seconds>s <job directory>`.

## Room cache

- The key of the room cache is the first 20 characters of a SHA-256 hash of all files under `assets-src/` and of `tools/pack.py`.
- The key does not use `.git`, so it works in a copy from `git archive`.
- `run.sh` keeps `$ROOT/public/assets` as an empty directory, not a symbolic link, so that Docker can mount `$ASSETS` at `/site/assets:ro`.

## Golden pictures

- The golden pictures are in `$CI_HOME/cache/pictures/<commit_sha>_<list_hash>/`.
- `list_hash` is the first 12 hex characters of a SHA-256. The hash is of `tools/ci/pictures.txt`, `tools/docker/detsnap.mjs`, the name and ID of the Playwright image, and the function `pw_for`.
- The tier does not use a golden picture that a different version of these files rendered.
- The hash does not include the contents of the Docker volume `lobby_pw_modules`, which holds the Playwright package of the scripts. After a change to that volume, clear `$CI_HOME/cache/pictures/`.
- The tier always renders the current commit again into `$OUT/current/`.
- When the cache has no golden pictures of `<base>`, the tier copies `<base>` with `git archive` and uses its rooms from the room cache or packs them. Then it renders `<base>` with the current `tools/docker/detsnap.mjs`.
