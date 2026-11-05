import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
    testDir: "tests/v2/browser",
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    workers: isCI ? 1 : undefined,
    timeout: 60_000,
    reporter: isCI
        ? [["list"], ["github"], ["html", { open: "never" }]]
        : [["list"], ["html", { open: "never" }]],
    use: {
        ...devices["Desktop Chrome"],
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: process.env.BASE_URL
        ? undefined
        : {
              command: `SANITY_STUDIO_PROJECT_ID=fallback SANITY_STUDIO_DATASET=production node scripts/build-studio.mjs && pnpm exec astro build --mode test && pnpm exec wrangler dev --local --ip 127.0.0.1 --port ${port} --env-file tests/v2/browser/worker.env`,
              url: `${baseURL}/robots.txt`,
              reuseExistingServer: false,
              timeout: 600_000,
          },
});
