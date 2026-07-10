"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { groupPostsByYear } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { inputClasses } from "@/components/ui/input-classes";

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
 * client up front — there is no server round trip for search. Rows are
 * dek-less compact `ls` lines: mono ISO date, display-face title, mono
 * reading time and bracket tags, hairline separators.
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
                className="block font-term text-sm text-slate-700 dark:text-slate-300 mb-2"
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
                className="mt-4 font-term text-[0.8rem] tabular-nums text-slate-500 dark:text-slate-400"
            >
                {filtered.length} of {posts.length} posts
            </p>

            {filtered.length === 0 ? (
                <div className="mt-8 rounded-card border border-slate-400/25 dark:border-white/10 p-10 text-center text-slate-600 dark:text-slate-400">
                    No posts match &ldquo;{query}&rdquo;. Try a different
                    search.
                </div>
            ) : (
                <div className="mt-8 flex flex-col gap-10 sm:gap-12">
                    {groups.map((group) => (
                        <div key={group.year}>
                            <div className="flex items-baseline gap-3 mb-2 pb-2 border-b border-slate-400/25 dark:border-white/10">
                                <h2 className="font-term text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                                    {group.year}/
                                </h2>
                                <span className="font-term text-[0.8rem] tabular-nums text-slate-500 dark:text-slate-400">
                                    # {group.posts.length}{" "}
                                    {group.posts.length === 1
                                        ? "post"
                                        : "posts"}
                                </span>
                            </div>

                            <ul>
                                {group.posts.map((post) => (
                                    <li
                                        key={post.slug}
                                        className="grid gap-y-1 gap-x-8 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] items-baseline py-4 border-b border-slate-400/25 dark:border-white/10"
                                    >
                                        <span className="font-term text-[0.8rem] tabular-nums text-slate-500 dark:text-slate-400">
                                            {post.date}
                                        </span>
                                        <span className="min-w-0">
                                            <Link
                                                href={`/blogs/${post.slug}`}
                                                className="font-display font-semibold text-base sm:text-lg text-slate-900 dark:text-white hover:text-accent transition-colors"
                                            >
                                                {post.title}
                                            </Link>
                                            <span className="ml-3 font-term text-[0.75rem] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {post.readingMinutes} min
                                            </span>
                                        </span>

                                        {post.tags.length > 0 && (
                                            <span className="flex flex-wrap gap-x-3 gap-y-1 sm:justify-end">
                                                {post.tags.map((tag) => (
                                                    <Link
                                                        key={tag}
                                                        href={`/blogs/tags/${tag}`}
                                                        className="font-term text-[0.75rem] whitespace-nowrap text-slate-500 dark:text-slate-400 hover:text-accent transition-colors"
                                                    >
                                                        <span aria-hidden>
                                                            [{" "}
                                                        </span>
                                                        {tag}
                                                        <span aria-hidden>
                                                            {" "}
                                                            ]
                                                        </span>
                                                    </Link>
                                                ))}
                                            </span>
                                        )}
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
