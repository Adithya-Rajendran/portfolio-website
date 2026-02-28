import { dirname } from "path";
import { fileURLToPath } from "url";
import nextConfig from "eslint-config-next";

const __dirname = dirname(fileURLToPath(import.meta.url));

const eslintConfig = [
    ...nextConfig({ dir: __dirname }),
    {
        rules: {
            "react/no-unescaped-entities": 0,
        },
    },
];

export default eslintConfig;