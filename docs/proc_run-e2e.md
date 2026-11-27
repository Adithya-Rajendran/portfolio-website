---
type: procedure
title: Run the Playwright tests
depends: [docs/ref_e2e-files.md, docs/proc_run-tier.md]
---
# Run the Playwright tests

Use this procedure to run [the Playwright tests](ref_e2e-files.md) on a local machine.

## Prerequisites

- The machine has the packed rooms, or `ASSETS` names them.

## Procedure

1. Install the packages with `pnpm@12.23.0`.
   ```sh
   pnpm install --frozen-lockfile
   ```
2. Make the site in `dist/`.
   ```sh
   pnpm build
   ```
3. Run the tests.
   ```sh
   pnpm test:e2e
   ```

## Verification

- Playwright shows no failed test.

## Troubleshooting

- To run the tests one time, use Playwright without `run.mjs`:
  ```sh
  pnpm exec playwright test -c tests/e2e/playwright.config.ts --grep-invert @timing
  pnpm exec playwright test -c tests/e2e/playwright.config.ts --grep @timing --workers=1
  ```

## Additional resources

- To run the tests on the CI host, [run the tier](proc_run-tier.md) `e2e`.
