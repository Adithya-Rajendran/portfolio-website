import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
    test: {
        // Deliberately "node", not "jsdom": this repo has no
        // component-rendering tests. Component-level verification happens
        // by running the app (optionally with fixture content) and
        // screenshotting the live dev server instead.
        environment: "node",
        include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        setupFiles: ["./tests/setup.ts"],
        coverage: {
            // Every module of pure logic, whether a test imports it or not:
            // without `include`, Vitest counts only the files the tests
            // load, and an untested module drops out of the total. The
            // components, pages and the flight's WebGL are the browser
            // tests' (tests/e2e).
            include: [
                "lib/**/*.{ts,tsx}",
                "actions/**/*.ts",
                "app/api/**/*.ts",
                "app/sitemap.ts",
                "app/feed.xml/**/*.ts",
            ],
            reporter: ["text", "json-summary"],
            // Under today's totals (86% of statements, 83% of branches,
            // 86% of functions; `pnpm test:coverage`, run in CI), so the
            // number cannot drift down unnoticed. Raise them as tests are
            // added; never lower them to let a change through.
            thresholds: {
                statements: 80,
                branches: 80,
                functions: 80,
                lines: 80,
            },
        },
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
});
