/**
 * The reading-time estimate shared by the blog pages, the index and the
 * share images.
 * Listing, plate and footnote numbering live in lib/prose.ts.
 */

/** Words-per-minute reading estimate from a precomputed word count
 *  (the list GROQ projection ships `wordCount` instead of the body). */
export function readingTimeFromWordCount(wordCount?: number | null): number {
    const wordsPerMinute = 200;
    return Math.max(1, Math.ceil((wordCount ?? 0) / wordsPerMinute));
}
