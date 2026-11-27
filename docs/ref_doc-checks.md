---
type: reference
title: Documentation and comment checks
depends: [AGENTS.md]
---
# Documentation and comment checks

This reference gives the commands, the files and the output of the checks for [the rules](../AGENTS.md#documentation).

## Commands

| Command | Result |
|---|---|
| `python3 tools/comments/check.py` | The comment check of each source file in the repository. |
| `python3 tools/docs/check.py --vale "$(tools/docs/vale.sh)"` | The module check, the dependency graph check and the language check. |
| `python3 tools/docs/check.py --no-vale` | The module check and the dependency graph check, without the language check. |
| `--seed` | A legacy line for each file that does not obey the rules. |
| `--base-legacy <file>` | A failure if the legacy list has a path that is not in the base list, or a hash that is different from the base list. |

## Files

| File | Contents |
|---|---|
| `tools/ci/legacy.txt` | One line for each legacy file: the check name, the hash of the file and the path. |
| `tools/ci/legacy.py` | The functions that read the legacy list and apply it. |
| `.vale/vale.ini` | The Vale configuration. |
| `.vale/styles/Arcadia/` | The Vale rules of the project. |
| `.vale/styles/config/dictionaries/ste.dic` | The approved general words. |
| `.vale/verbs.txt` | The approved general verbs for the first word of a step. |
| [`tools/docs/vale.sh`](../tools/docs/vale.sh) | The script that copies Vale from GitHub, checks its hash, keeps it in the cache and shows its path. The script holds the Vale version. |

## Output

- Each problem has one line, with the path, the line number and the problem.
- The last line gives the number of files and the number of problems.
- The exit code is 0 when the check finds no problems, and 1 when it finds problems.