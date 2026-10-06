/**
 * The slug rule for posts and projects, read by the Sanity schema
 * (`sanity/schemas/post.ts`, `project.ts`) and the site (the feed in
 * lib/feed.ts, cache warming in lib/route-tags.ts), so a slug the Studio
 * accepts is one the site links, lists and warms. Keep this module free of
 * imports: the Studio and `sanity schema extract` bundle it.
 */

/** Lowercase letters, digits and hyphens, from a letter or digit. */
export const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Addresses under `/blog/` that a route already answers, so a post with
 * one of these slugs could never be reached: `/blog/archive` answers 308
 * to `/blog`, `/blog/tags/…` are the tag pages and
 * `/blog/opengraph-image` is /blog's share image (next.config.mjs).
 */
export const RESERVED_POST_SLUGS = ["archive", "tags", "opengraph-image"];

/** `/portfolio/opengraph-image` is /portfolio's share image. */
export const RESERVED_PROJECT_SLUGS = ["opengraph-image"];

/**
 * The Studio's check of a slug: true, or what to fix. A missing slug is
 * left to `Rule.required()`.
 */
export function checkSlug(
    slug: string | undefined,
    reserved: readonly string[],
): true | string {
    if (!slug) return true;
    if (!SAFE_SLUG.test(slug)) {
        return "Use lowercase letters, digits and hyphens, starting with a letter or digit.";
    }
    if (reserved.includes(slug)) {
        return `“${slug}” is the address of another page. Choose another slug.`;
    }
    return true;
}
