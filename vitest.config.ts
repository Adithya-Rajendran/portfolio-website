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
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./", import.meta.url)),
        },
    },
});
