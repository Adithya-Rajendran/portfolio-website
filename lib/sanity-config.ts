import { createClient } from "next-sanity";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const apiVersion = "2024-01-01";

if (!projectId) {
    console.warn("[Sanity] Missing NEXT_PUBLIC_SANITY_PROJECT_ID env var");
}

export const client = createClient({
    projectId: projectId || "fallback",
    dataset,
    apiVersion,
    useCdn: true,
});

export const isSanityConfigured = Boolean(projectId && projectId !== "fallback");
