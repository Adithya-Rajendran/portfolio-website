import { createImageUrlBuilder } from "@sanity/image-url";

/**
 * Built from plain project config, NOT the data client: this module is
 * imported by client components, and seeding the builder with the
 * next-sanity client would drag @sanity/client + rxjs (~34KB gz) into
 * the browser bundle. The data client lives in lib/sanity-config.ts,
 * which is server-only.
 */
const builder = createImageUrlBuilder({
    projectId: process.env.NEXT_PUBLIC_STORE_SANITY_PROJECT_ID || "fallback",
    dataset: process.env.NEXT_PUBLIC_STORE_SANITY_DATASET || "production",
});

export function urlForImage(source: Parameters<typeof builder.image>[0]) {
    return builder.image(source);
}
