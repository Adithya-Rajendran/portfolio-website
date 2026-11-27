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
| `pnpm typecheck` | `tsc` with `tsconfig.json` and `tsconfig.strict.json`, compared with `tools/ci/ts-baseline.txt`. |
| `pnpm lint` | `oxlint` with `.oxlintrc.json`, compared with `tools/ci/lint-baseline.txt`. |
| `pnpm test` | Vitest runs the files `src/**/*.test.ts` in Node. |
| `pnpm typecheck --update` | Removes the lines of `tools/ci/ts-baseline.txt` that `tsc` does not show. |
| `pnpm lint --update` | Removes the lines of `tools/ci/lint-baseline.txt` that `oxlint` does not show. |
| `--base <file>` | A failure if the baseline has more lines than each base list. Give one `--base` for each branch. |

## Files

| File | Contents |
|---|---|
| `tsconfig.json` | The type check of the JavaScript files in `src/`, without the strict mode. |
| `tsconfig.strict.json` | The type check of each TypeScript file, in the strict mode. |
| `.oxlintrc.json` | The `oxlint` rules, with the rules of `eslint-plugin-solid`. |
| `vitest.config.ts` | The Vitest projects. |
| `tools/ci/ratchet.mjs` | The script that runs `tsc` or `oxlint` and compares the problems with the baseline. |
| `tools/ci/ts-baseline.txt` | One line for each type problem: the path, the code and the message. |
| `tools/ci/lint-baseline.txt` | One line for each lint problem: the path, the rule and the message. |

## Baseline rules

- A problem that is not on the baseline is a failure.
- A line of the baseline without a problem in the code is a failure.
- The lines do not have line numbers, so a change to other lines of a file does not change the baseline.
- When you move code to a new file, its problems move to the new path. Then the number of lines must not increase.

## Base lists in CI

- The `static` tier uses the baselines of `prog/int` and of each `prog/ws-*` branch that has them.

## Output

- Each problem that is not on the baseline has one line, with the path, the position, the code and the message.
- The last line gives the number of problems, the number of baseline lines, the new problems, the removed problems and the time.
- When the problems agree with the baseline, the exit code is 0. If they do not agree, the exit code is 1.
