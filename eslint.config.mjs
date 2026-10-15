import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
    ...nextVitals,
    globalIgnores([
        ".next/**",
        "out/**",
        "build/**",
        "next-env.d.ts",
        "playwright-report/**",
        "test-results/**",
        "blob-report/**",
    ]),
    {
        rules: {
            "react/no-unescaped-entities": 0,
        },
    },
    {
        // A browser context's request client skips its routes, so it
        // never carries the preview's protection-bypass header
        // (tests/e2e/support/test.ts).
        files: ["tests/e2e/**/*.ts"],
        rules: {
            "no-restricted-syntax": [
                "error",
                {
                    selector:
                        "MemberExpression[object.name=/^(page|context)$/][property.name='request']",
                    message:
                        "Use the request fixture: page.request and context.request reach a protected preview without the bypass header.",
                },
            ],
        },
    },
]);

export default eslintConfig;
