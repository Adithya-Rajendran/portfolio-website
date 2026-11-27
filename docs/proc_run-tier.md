---
type: procedure
title: Run a tier on the CI host
depends: [docs/ref_ci-tiers.md, docs/ref_ci-jobs.md]
---
# Run a tier on the CI host

Use this procedure to run one of [the check tiers](ref_ci-tiers.md) on a commit.

## Prerequisites

- Your clone has the Git `ci` remote, which is the repository on the CI host.
- You can connect to the CI host with `ssh arcadia-ci`.

## Procedure

1. Push the branch to the CI host.
   ```sh
   git push ci HEAD:<branch>
   ```
2. Run the tier.
   ```sh
   ssh arcadia-ci 'ci <branch> <tier> [args]'
   ```

## Verification

- The last line shows `PASS`.
- `log.txt` in [the job directory](ref_ci-jobs.md) shows the output of each check.

## Troubleshooting

- The browser tiers wait for `gpu.lock`, so a job can wait while a job of a different branch runs.
- For a long tier, start the job in the background on the host, and read its log.
