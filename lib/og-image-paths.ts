/**
 * Sharing images warmed on profile edits, keyed by the file that serves
 * them. Metadata image routes inside the `app/(site)` route group get a
 * stable `-<hash>` suffix from Next.js (derived from the group path), so
 * these are the built URLs `next build` prints, not `/…/opengraph-image`.
 * tests/actions/warmCache.test.ts recomputes each one from its file, and
 * the e2e smoke spec requests each one from a real build. This module has
 * no server-only imports so that spec can read it.
 */
export const PROFILE_OG_IMAGE_PATHS = {
    "app/(site)/opengraph-image.tsx": "/opengraph-image-12o0cb",
    "app/(site)/about/opengraph-image.tsx": "/about/opengraph-image-1ycygp",
    "app/(site)/portfolio/opengraph-image.tsx":
        "/portfolio/opengraph-image-98lokn",
    "app/(site)/blog/opengraph-image.tsx": "/blog/opengraph-image-14vkmf",
} as const;
