import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
    api: {
        projectId: process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID,
        dataset: process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production",
    },
    deployment: {
        // The Studio application registered for the embedded Studio at
        // /studio in the Sanity dashboard. `pnpm schema:deploy` (sanity
        // deploy --external) refreshes that application's schema; without
        // the id the CLI would register a second application.
        appId: "go7tr653762tnknqhjkhot5x",
    },
    typegen: {
        enabled: true,
        path: "./{app,components,lib}/**/*.{ts,tsx}",
        schema: "./schema.json",
        generates: "./sanity.types.ts",
    },
});
