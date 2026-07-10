"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { groupPostsByYear } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input-classes";
import { formatDate } from "./utils";

interface ArchivePostItem {
    slug: string;
    title: string;
    description: string;
    date: string;
    tags: string[];
    readingMinutes: number;
}

interface ArchiveListProps {
    posts: ArchivePostItem[];
}

/** Case-insensitive substring match over title, description, and tags. */
function matchesQuery(post: ArchivePostItem, query: string): boolean {
    if (!query) return true;
    return (
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        post.tags.some((tag) => tag.toLowerCase().includes(query))
    );
}

/**
 * Client-side searchable archive: a single text input filters the full
 * post list (title + description + tags, simple substring match) and the
 * results re-group by year on every keystroke. All posts ship to the
 * client up front — there is no server round trip for search.
 */
export default function ArchiveList({ posts }: ArchiveListProps) {
    const [query, setQuery] = useState("");
    const inputId = useId();

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? posts.filter((post) => matchesQuery(post, q)) : posts;
    }, [posts, query]);

    const groups = useMemo(() => groupPostsByYear(filtered), [filtered]);

    return (
        <section>
            <label
                htmlFor={inputId}
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
                Search posts
            </label>
            <input
                id={inputId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, description, or tag…"
                className={cn(inputClasses, "h-12")}
            />

            <p
                aria-live="polite"
                className="mt-4 text-sm text-slate-500 dark:text-slate-400"
            >
                {filtered.length} of {posts.length} posts
            </p>

            {filtered.length === 0 ? (
                <div className="mt-8 os-card-flat p-10 text-center text-slate-600 dark:text-slate-400">
                    No posts match &ldquo;{query}&rdquo;. Try a different
                    search.
                </div>
            ) : (
                <div className="mt-8 flex flex-col gap-10 sm:gap-12">
                    {groups.map((group) => (
                        <div key={group.year}>
                            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200/70 dark:border-white/10">
                                <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
                                    {group.year}
                                </h2>
                                <span className="inline-flex items-center justify-center rounded-pill bg-accent-soft text-accent text-xs font-semibold px-2.5 py-0.5 min-w-6">
                                    {group.posts.length}
                                </span>
                            </div>

                            <ul className="flex flex-col gap-3">
                                {group.posts.map((post) => (
                                    <li key={post.slug}>
                                        <div className="os-card-flat p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/blogs/${post.slug}`}
                                                    className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white hover:text-accent transition-colors"
                                                >
                                                    {post.title}
                                                </Link>
                                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    {post.date && (
                                                        <span>
                                                            {formatDate(
                                                                post.date,
                                                            )}
                                                        </span>
                                                    )}
                                                    {post.date && (
                                                        <span
                                                            aria-hidden
                                                            className="w-1 h-1 rounded-full bg-accent opacity-50"
                                                        />
                                                    )}
                                                    <span>
                                                        {post.readingMinutes}{" "}
                                                        min
                                                    </span>
                                                </p>
                                            </div>

                                            {post.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                                                    {post.tags.map((tag) => (
                                                        <Link
                                                            key={tag}
                                                            href={`/blogs/tags/${tag}`}
                                                            className="rounded-pill border border-accent-soft bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent hover:border-accent transition-colors"
                                                        >
                                                            {tag}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
