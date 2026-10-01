import type { LogEntry } from "@/lib/log-index";

/**
 * What a Flight Log entry points to after its last line (G1): the entries
 * filed just before and after it (by LOG number), and other entries that
 * share a tag. Pure, over `logEntries()` (which owns the publication gate
 * and the numbering), so the pager and the list agree with the index.
 */

export interface Adjacent {
    /** The entry filed just before this one (LOG n − 1). */
    previous: LogEntry | null;
    /** The entry filed just after this one (LOG n + 1). */
    next: LogEntry | null;
}

export function adjacentEntries(
    entries: readonly LogEntry[],
    slug: string,
): Adjacent {
    const current = entries.find((entry) => entry.slug === slug);
    if (!current) return { previous: null, next: null };
    const byNumber = (number: number) =>
        entries.find((entry) => entry.number === number) ?? null;
    return {
        previous: byNumber(current.number - 1),
        next: byNumber(current.number + 1),
    };
}

/**
 * Up to `limit` other entries that share a tag with this one, most shared
 * tags first, then newest first. Entries already in `exclude` (the pager's
 * previous and next) are left out, so nothing is offered twice. Empty when
 * no other entry shares a tag: nothing is padded in.
 */
export function relatedEntries(
    entries: readonly LogEntry[],
    slug: string,
    { exclude = [], limit = 3 }: { exclude?: string[]; limit?: number } = {},
): LogEntry[] {
    const current = entries.find((entry) => entry.slug === slug);
    if (!current || current.tags.length === 0) return [];
    const tags = new Set(current.tags);
    const shared = (entry: LogEntry) =>
        new Set(entry.tags.filter((tag) => tags.has(tag))).size;
    return entries
        .filter(
            (entry) =>
                entry.slug !== slug &&
                !exclude.includes(entry.slug) &&
                shared(entry) > 0,
        )
        .sort((a, b) => shared(b) - shared(a) || b.number - a.number)
        .slice(0, limit);
}
