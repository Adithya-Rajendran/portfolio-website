/**
 * Shared utility functions for blog components.
 * Consolidates duplicated helpers that were previously scattered
 * across featured.tsx, latest.tsx, blog-post-content.tsx, and
 * portable-text-components.tsx.
 */

/** Format a date string like "2026-03-06" → "March 6, 2026" */
export function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

/** Resolve a post slug whether it's a plain string or a Sanity slug object */
export function getPostSlug(post: {
    slug?: string | { current?: string } | null;
}): string {
    return typeof post.slug === "string"
        ? post.slug
        : (post.slug?.current ?? "");
}

/** Words-per-minute reading estimate from a precomputed word count
 *  (the list GROQ projection ships `wordCount` instead of the body). */
export function readingTimeFromWordCount(wordCount?: number | null): number {
    const wordsPerMinute = 200;
    return Math.max(1, Math.ceil((wordCount ?? 0) / wordsPerMinute));
}

/**
 * Number a body's code blocks 1…n in reading order, keyed by block _key,
 * so every listing gets a unique accessible name (see codeListingLabel).
 */
export function numberCodeListings(
    codeBlocks: { _key: string }[],
): Record<string, number> {
    return Object.fromEntries(
        codeBlocks.map((block, index) => [block._key, index + 1]),
    );
}

/** "Code listing 2 (bash, install.sh)": unique per listing on a page. */
export function codeListingLabel({
    number,
    language,
    filename,
}: {
    number?: number;
    language?: string | null;
    filename?: string | null;
}): string {
    const name = number ? `Code listing ${number}` : "Code listing";
    const details = [language, filename].filter(Boolean).join(", ");
    return details ? `${name} (${details})` : name;
}
