---
type: concept
title: The CI host
depends: [docs/ref_ci-host.md, docs/ref_ci-tiers.md, docs/ref_ci-jobs.md]
---
# The CI host

The CI host runs the check tiers on the commits that a person pushes to it.
The repository holds the tiers in `tools/ci/`, and the programs of the host only call them.
A change to a tier is then part of the commit that the tier checks.

## How the host runs a tier

The host copies the commit into a clean job directory with no `.git`, so that the check uses only the files of the commit.
Then `tools/ci/run.sh` runs [the tier](ref_ci-tiers.md) in that directory, and it writes the results to [the job directory](ref_ci-jobs.md).
Many jobs can run at the same time, so the host uses file locks.
The locks let the light jobs run together, and they make the measurements and the browser jobs run alone.

## How the host serves a preview

The host also serves a commit as a preview for a person to see in a browser.
It prepares the new copy next to the copy that it serves, and then it replaces the served copy in one step.
A preview then does not show a copy that is not complete.

See [the CI host files and locks](ref_ci-host.md) for the programs, the scripts and the locks.
