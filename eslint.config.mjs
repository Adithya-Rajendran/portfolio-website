import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "dist/**",
            "public/studio/**",
            "public/draco/**",
            ".astro/**",
            ".wrangler/**",
            ".sanity/**",
            ".claude/**",
            "worker-configuration.d.ts",
            "sanity.types.ts",
            "coverage/**",
            "playwright-report/**",
            "test-results/**",
            "blob-report/**",
            "out/**",
            "build/**",
            "next-env.d.ts",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.serviceworker,
            },
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            "no-undef": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
        },
    },
    {
        files: ["lib/feed.ts", "src/lib/feed.ts"],
        rules: { "no-control-regex": "off" },
    },
);
