---
type: procedure
title: Remove a file from the legacy list
depends: [AGENTS.md, docs/ref_doc-checks.md]
---
# Remove a file from the legacy list

## Prerequisites

- You have a worktree of the repository.
- The file has a line in `tools/ci/legacy.txt`.

## Procedure

1. Change the file until it obeys [the rules](../AGENTS.md).
2. Remove the line of the file from `tools/ci/legacy.txt`.
3. Run the two checks with [the commands](ref_doc-checks.md#commands).

## Verification

- The checks show no problems for the file.
- The exit code of each check is 0.
