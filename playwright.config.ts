import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (tests/e2e). Two targets:
 *
 * - `fixture` (`pnpm test:e2e`): Playwright builds the site with
 *   `NEXT_PUBLIC_STORE_SANITY_PROJECT_ID=fallback` and `SANITY_USE_FIXTURES=1`
 *   (lib/fixtures.ts content, zero network I/O), then serves it with
 *   `next start`. The build overwrites `.next`. Locally an already-running
 *   server on the port is reused, so specs can be iterated against a fixture
 *   build started by hand.
 * - `preview` (`pnpm test:e2e:preview`): a deployed site at `BASE_URL`
 *   (a Vercel preview, from .github/workflows/e2e-preview.yml). The
 *   protection-bypass secret, when set, is sent to that origin only
 *   (tests/e2e/support/test.ts). No server is started.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const FIXTURE_URL = `http://127.0.0.1:${PORT}`;
const PREVIEW_URL = process.env.BASE_URL;
const isCI = Boolean(process.env.CI);

export default defineConfig({
    testDir: "tests/e2e",
    testMatch: "**/*.spec.ts",
    outputDir: "test-results",
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    workers: isCI ? 2 : undefined,
    timeout: 60_000,
    reporter: isCI
        ? [["list"], ["github"], ["html", { open: "never" }]]
        : [["list"], ["html", { open: "never" }]],
    use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "fixture", use: { baseURL: FIXTURE_URL } },
        // Defined only with a target, so the fixture run never needs one.
        ...(PREVIEW_URL
            ? [{ name: "preview", use: { baseURL: PREVIEW_URL } }]
            : []),
    ],
    webServer: PREVIEW_URL
        ? undefined
        : {
              command: `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${PORT}`,
              url: `${FIXTURE_URL}/robots.txt`,
              reuseExistingServer: !isCI,
              // A cold fixture build takes a minute or two on CI runners.
              timeout: 600_000,
              env: {
                  NEXT_PUBLIC_STORE_SANITY_PROJECT_ID: "fallback",
                  SANITY_USE_FIXTURES: "1",
                  NEXT_TELEMETRY_DISABLED: "1",
              },
          },
});
