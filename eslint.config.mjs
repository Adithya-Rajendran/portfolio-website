import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
    ...nextVitals,
    globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
    {
        rules: {
            "react/no-unescaped-entities": 0,
        },
    },
]);

export default eslintConfig;