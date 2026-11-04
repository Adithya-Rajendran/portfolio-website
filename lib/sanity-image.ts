import { createImageUrlBuilder } from "@sanity/image-url";

/**
 * Built from plain project config, NOT the data client, so it stays
 * importable from either side; today only server files import it. If a
 * client component ever needs it, keep it off the data client: seeding
 * the builder with the Sanity data client would drag @sanity/client +
 * rxjs (~34KB gz) into the browser bundle, and lib/sanity-config.ts,
 * where that client lives, is server-only.
 */
const builder = createImageUrlBuilder({
    projectId: process.env.SANITY_STUDIO_PROJECT_ID || "fallback",
    dataset: process.env.SANITY_STUDIO_DATASET || "production",
});

export function urlForImage(source: Parameters<typeof builder.image>[0]) {
    return builder.image(source);
}
