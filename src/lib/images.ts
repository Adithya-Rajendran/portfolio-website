import { createImageUrlBuilder } from "@sanity/image-url";
import { env } from "cloudflare:workers";
const config = env as unknown as Record<string, string | undefined>;
const builder = createImageUrlBuilder({
    projectId: config.SANITY_PROJECT_ID || "fallback",
    dataset: config.SANITY_DATASET || "production",
});
export const urlForImage = (source: Parameters<typeof builder.image>[0]) =>
    builder.image(source);
