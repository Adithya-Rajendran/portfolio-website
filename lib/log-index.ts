import type { PostListItem } from "@/lib/sanity-client";
import { readingTimeFromWordCount } from "@/components/blogs/utils";
import { formatLogDesignation, logNumbers } from "@/lib/designations";
import { TAG_PATTERN, type TagCount } from "@/lib/tags";

/**
 * The writing index (G8): one row per published entry on shared column
 * tracks (date and any revision · title, standfirst and tags · read
 * time), grouped by year (`groupPostsByYear` in lib/tags.ts). Pure, so
 * /blog, the tag pages, the archive, the home page and About derive the
 * same rows. Each entry keeps its derived LOG number, the quiet
 * identifier its own page prints.
 */

export interface LogEntry {
    slug: string;
    title: string;
    /** The standfirst: the post's description. */
    dek: string;
    /** The date it was filed (published), `YYYY-MM-DD`; "" if unknown. */
    publishedAt: string;
    /** The last substantive revision (`revisedAt`), `YYYY-MM-DD`, only
     *  when the owner set one after the filing date; otherwise null. */
    revisedAt: string | null;
    /** Minutes at 200 words a minute; null when the body has no words. */
    readMinutes: number | null;
    wordCount: number;
    /** Slug-safe tags only, so every one is a working tag page. */
    tags: string[];
    /** 1 is the oldest entry. */
    number: number;
    /** "LOG 003". */
    designation: string;
}

export type LogSource = Pick<
    PostListItem,
    "slug" | "title" | "description" | "publishedAt" | "tags" | "wordCount"
> & { _id?: string | null; revisedAt?: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Every entry with a slug, newest first (by number, so posts filed on the
 * same day keep one order). Numbers come from the whole list, so a filtered
 * list keeps each entry's number: filter the result, never the input.
 */
export function logEntries(posts: readonly LogSource[]): LogEntry[] {
    const numbers = logNumbers(posts);
    return posts
        .filter((post) => post.slug && numbers.has(post.slug))
        .map((post) => {
            const number = numbers.get(post.slug)!;
            const wordCount = post.wordCount ?? 0;
            const publishedAt = DATE.test(post.publishedAt ?? "")
                ? post.publishedAt.slice(0, 10)
                : "";
            const revised = DATE.test(post.revisedAt ?? "")
                ? post.revisedAt!.slice(0, 10)
                : null;
            return {
                slug: post.slug,
                title: post.title || "",
                dek: post.description || "",
                publishedAt,
                revisedAt:
                    revised && (!publishedAt || revised > publishedAt)
                        ? revised
                        : null,
                readMinutes:
                    wordCount > 0 ? readingTimeFromWordCount(wordCount) : null,
                wordCount,
                tags: (post.tags ?? []).filter((tag) => TAG_PATTERN.test(tag)),
                number,
                designation: formatLogDesignation(number),
            };
        })
        .sort((a, b) => b.number - a.number);
}

/**
 * Whether the index offers its tag filters and search: only once a tag
 * gathers two or more entries. Until then every entry is on one short
 * list, and a filter would only narrow it to the entry already in view.
 */
export function offersFilters(tags: readonly TagCount[]): boolean {
    return tags.some((tag) => tag.count >= 2);
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

/** "2026-03-30" → "30 Mar 2026": the post head's date. */
export function formatEntryDate(date: string | null | undefined): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
    if (!match) return "";
    return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** "3 entries", "1 entry". */
export function entryCount(count: number): string {
    return `${count.toLocaleString("en-US")} ${count === 1 ? "entry" : "entries"}`;
}
