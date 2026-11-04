/** Estimate reading time from the precomputed word count. */
export function readingTimeFromWordCount(wordCount?: number | null): number {
    return Math.max(1, Math.ceil((wordCount ?? 0) / 200));
}
