/**
 * Shared helpers for the blog pages, the share images and cache warming.
 * Listing, plate and footnote numbering live in lib/prose.ts.
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
