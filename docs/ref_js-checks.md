---
type: reference
title: The type check, the lint check and the unit tests
depends: []
---
# The type check, the lint check and the unit tests

This reference gives the commands and the files of the JavaScript checks that the `static` tier runs.

## Commands

| Command | Result |
|---|---|
| `pnpm typecheck` | `tsc` with the three `tsconfig` files, compared with `tools/ci/ts-baseline.txt`. |
| `pnpm lint` | `oxlint` with `.oxlintrc.json`, compared with `tools/ci/lint-baseline.txt`. |
| `pnpm test` | Vitest runs the files `src/**/*.test.ts` in Node. |
| `pnpm typecheck --update` | Removes the lines of `tools/ci/ts-baseline.txt` that `tsc` does not show. |
| `pnpm lint --update` | Removes the lines of `tools/ci/lint-baseline.txt` that `oxlint` does not show. |
| `--base <file>` | Compares the baseline with the baseline of a base branch. Give one `--base` for each branch. |
| `node --test tools/test_ratchet.mjs` | The unit tests of the baseline rules. |

## Files

| File | Contents |
|---|---|
| `tsconfig.json` | The type check of the JavaScript files in `src/`, without the strict mode, and without `src/app/`. |
| `tsconfig.strict.json` | The type check of the TypeScript files in `src/` and of each file in `src/app/`, in the strict mode, with only the browser types. |
| `tsconfig.node.json` | The type check of the unit tests, of `tests/` and of the configuration files, in the strict mode, with the Node types. |
| `.oxlintrc.json` | The `oxlint` rules, with the rules of `eslint-plugin-solid`. |
| `vitest.config.ts` | The Vitest projects. |
| `tools/ci/ratchet.mjs` | The script that runs `tsc` or `oxlint` and compares the problems with the baseline. |
| `tools/ci/ts-baseline.txt` | One line for each type problem: the path, the code and the message. |
| `tools/ci/lint-baseline.txt` | One line for each lint problem: the path, the rule and the message. |

## Baseline rules

- A problem that is not on the baseline is a failure.
- A line of the baseline without a problem in the code is a failure.
- Each line of the baseline must also be on the baseline of each base branch.
- The baseline can have a line only as many times as each base baseline has it.
- `--update` writes the baseline only if the new baseline obeys these base rules, also after you delete the file.
- Moved code can keep its problems at a new path only if a line with the same code and message goes from the first path.
- One problem can move from one path to a different path. The number of lines with that code and message cannot increase.
- A `tsc` exit code that is not 0 is a failure when the script cannot read a problem in the output of `tsc`.
- An error of `tsc` without a path is a failure.
- An error in a `tsconfig` file is a failure.
- An error in a file that no `tsconfig` file reports is a failure.
- Each `tsconfig` file reports only the files of its row in the table of files, so each file has one type check.

## Keys of the lines

- A line has no line number and no position in the line. A change to other lines of a file does not change the baseline.
- Two equal problems in one file have two equal lines.
- The line contains the message of `tsc` or `oxlint`, so a new version of the tool can change the lines.
- Update the baseline in the same change as the version of `typescript` or `oxlint`.

## Base lists

- The `static` tier uses the baseline of `prog/int` and the baseline of each `prog/ws-*` branch.
- The base baselines include each `prog/ws-*` branch, not only the branch that the change starts from.
- Without `--base`, the script reads the same baselines from the branches of the local repository.

## Output

- Each problem that is not on the baseline has one line, with the path, the position, the code and the message.
- The last line gives the number of problems and of baseline lines, the new and the removed problems, the base baselines and the time.
- When the problems agree with the baseline and with the base baselines, the exit code is 0. If they do not agree, the exit code is 1.
