import type { PostListItem } from "@/lib/sanity-client";
import { readingTimeFromWordCount } from "@/components/blogs/utils";
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

export type LogSource = Pick<
    PostListItem,
    "slug" | "title" | "description" | "publishedAt" | "tags" | "wordCount"
> & { _id?: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}/;

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
            const publishedAt = DATE.test(post.publishedAt ?? "")
                ? post.publishedAt.slice(0, 10)
                : "";
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

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/**
 * The newest date a post records for itself: its publication, its last
 * substantive revision (`revisedAt`) and its changelog's dates, the
 * dates its page prints. A document edit (`_updatedAt`) is not one: a
 * migration touches every post at once. The sitemap's lastmod and the
 * feed's lastBuildDate read it; undefined when no date is readable.
 */
export function lastRevised(post: {
    publishedAt?: string | null;
    revisedAt?: string | null;
    changes?: readonly (string | null | undefined)[] | null;
}): string | undefined {
    let newest: string | undefined;
    for (const date of [
        post.publishedAt,
        post.revisedAt,
        ...(post.changes ?? []),
    ]) {
        if (!date || Number.isNaN(Date.parse(date))) continue;
        if (!newest || Date.parse(date) > Date.parse(newest)) newest = date;
    }
    return newest;
}

/** "2026-03-30" → "30 Mar 2026": the post head's date. */
export function formatEntryDate(date: string | null | undefined): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
    if (!match) return "";
    return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}
