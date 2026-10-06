import type { PostListItem } from "@/lib/sanity-client";
import { readingTimeFromWordCount } from "@/components/blogs/utils";
import { dateOnly, MONTHS } from "@/lib/dates";
import { logNumbers } from "@/lib/designations";
import { collectTags, linkedTags, TAG_PATTERN } from "@/lib/tags";

/**
 * The writing index (G8): one row per published entry on shared column
 * tracks (date · title, standfirst and the tags that link · read time),
 * in one list. Pure, so /blog, the tag pages, the home page, a project's
 * related writing and the CV derive the same rows. Each entry keeps its
 * filing number, which orders the entries and is printed nowhere.
 */

export interface LogEntry {
    slug: string;
    title: string;
    /** The standfirst: the post's description. */
    dek: string;
    /** The date it was filed (published), `YYYY-MM-DD`; "" if unknown. */
    publishedAt: string;
    /** Minutes at 200 words a minute; null when the body has no words. */
    readMinutes: number | null;
    wordCount: number;
    /** Slug-safe tags only, so every one is a working tag page. */
    tags: string[];
    /** The tags its row shows: the ones that link, gathering two or
     *  more entries across the whole log (`linkedTags`). */
    tagLinks: string[];
    /** 1 is the oldest entry. */
    number: number;
}

/** @internal Exported for tests. */
export type LogSource = Pick<
    PostListItem,
    "slug" | "title" | "description" | "publishedAt" | "tags" | "wordCount"
> & { _id?: string | null };

/**
 * Every entry with a slug, newest first (by number, so posts filed on the
 * same day keep one order). Numbers come from the whole list, so a filtered
 * list keeps each entry's number: filter the result, never the input.
 */
export function logEntries(posts: readonly LogSource[]): LogEntry[] {
    const numbers = logNumbers(posts);
    const entries = posts
        .filter((post) => post.slug && numbers.has(post.slug))
        .map((post) => {
            const number = numbers.get(post.slug)!;
            const wordCount = post.wordCount ?? 0;
            const publishedAt = dateOnly(post.publishedAt) ?? "";
            return {
                slug: post.slug,
                title: post.title || "",
                dek: post.description || "",
                publishedAt,
                readMinutes:
                    wordCount > 0 ? readingTimeFromWordCount(wordCount) : null,
                wordCount,
                tags: (post.tags ?? []).filter((tag) => TAG_PATTERN.test(tag)),
                tagLinks: [] as string[],
                number,
            };
        })
        .sort((a, b) => b.number - a.number);
    const linked = new Set(
        linkedTags(collectTags(entries)).map(({ tag }) => tag),
    );
    for (const entry of entries) {
        entry.tagLinks = entry.tags.filter((tag) => linked.has(tag));
    }
    return entries;
}

/** Entries that carry the exact tag. */
export function entriesTagged(
    entries: readonly LogEntry[],
    tag: string,
): LogEntry[] {
    return entries.filter((entry) => entry.tags.includes(tag));
}

/** "2026-03-30" → "30 Mar 2026": the post head's date. */
export function formatEntryDate(date: string | null | undefined): string {
    const day = dateOnly(date);
    if (!day) return "";
    const [year, month, dayOfMonth] = day.split("-").map(Number);
    return `${dayOfMonth} ${MONTHS[month - 1]} ${year}`;
}
