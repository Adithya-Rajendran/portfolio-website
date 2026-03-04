import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
    api: {
        projectId: process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID,
        dataset: process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production",
    },
});
