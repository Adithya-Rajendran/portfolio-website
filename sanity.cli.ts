import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
    api: {
        projectId: process.env.SANITY_STUDIO_PROJECT_ID,
        dataset: process.env.SANITY_STUDIO_DATASET || "production",
    },
    deployment: {
        // The Studio application registered for the embedded Studio at
        // /studio in the Sanity dashboard. `pnpm schema:deploy` (sanity
        // deploy --external) refreshes that application's schema: the CLI
        // resolves this id before any URL, so the deploy goes to that
        // application whatever URL it was registered with.
        appId: "go7tr653762tnknqhjkhot5x",
    },
    vite: (config) => ({
        ...config,
        // Vite copies `<root>/public` into the build output, and the Studio
        // is built from the repository root into public/studio: without
        // this the Studio would carry a second copy of every site asset
        // (models, images, fonts, Draco, lighting, about 38 MB). The Studio
        // has no public files of its own; its assets live in `static/`.
        publicDir: false,
    }),
    typegen: {
        enabled: true,
        path: "./{src,lib}/**/*.{ts,tsx}",
        schema: "./schema.json",
        generates: "./sanity.types.ts",
    },
});
