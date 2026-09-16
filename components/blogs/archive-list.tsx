"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { groupPostsByYear } from "@/lib/tags";
import { formatDate } from "./utils";

interface ArchivePostItem {
    slug: string;
    title: string;
    description: string;
    publishedAt: string;
    tags: string[];
    readingMinutes: number | null;
}

export default function ArchiveList({ posts }: { posts: ArchivePostItem[] }) {
    const [query, setQuery] = useState("");
    const inputId = useId();
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q
            ? posts.filter(
                  (post) =>
                      post.title.toLowerCase().includes(q) ||
                      post.description.toLowerCase().includes(q) ||
                      post.tags.some((tag) => tag.toLowerCase().includes(q)),
              )
            : posts;
    }, [posts, query]);
    const groups = useMemo(() => groupPostsByYear(filtered), [filtered]);
    return (
        <section
            className="journal-archive"
            aria-label="Search the writing archive"
        >
            <label htmlFor={inputId} className="journal-search-label">
                Search the notebook
            </label>
            <div className="journal-search-field">
                <Search aria-hidden size={18} />
                <input
                    id={inputId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search titles, summaries, or topics…"
                />
            </div>
            <p
                aria-live="polite"
                aria-atomic="true"
                className="journal-search-count"
            >
                {filtered.length} of {posts.length}{" "}
                {posts.length === 1 ? "note" : "notes"}
            </p>
            {filtered.length === 0 ? (
                <div className="journal-empty">
                    <h2>No notes found.</h2>
                    <p>
                        No writing matches “{query}”. Try another word or topic.
                    </p>
                    <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="journal-link"
                    >
                        Clear search →
                    </button>
                </div>
            ) : (
                groups.map((group) => (
                    <section
                        key={group.year}
                        className="journal-archive-year"
                        aria-labelledby={`year-${group.year}`}
                    >
                        <div className="journal-section-heading">
                            <h2 id={`year-${group.year}`}>{group.year}</h2>
                            <span className="journal-post-meta">
                                {group.posts.length}{" "}
                                {group.posts.length === 1 ? "note" : "notes"}
                            </span>
                        </div>
                        <ul className="journal-post-list">
                            {group.posts.map((post) => (
                                <li key={post.slug}>
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        className="journal-post-row"
                                    >
                                        <span className="journal-post-meta">
                                            <time
                                                dateTime={
                                                    post.publishedAt ||
                                                    undefined
                                                }
                                            >
                                                {formatDate(post.publishedAt) ||
                                                    "Undated"}
                                            </time>
                                            {post.readingMinutes && (
                                                <span>
                                                    {post.readingMinutes} min
                                                    read
                                                </span>
                                            )}
                                        </span>
                                        <span className="journal-post-summary">
                                            <span className="journal-post-title">
                                                {post.title}
                                            </span>
                                            {post.description && (
                                                <span className="journal-post-description">
                                                    {post.description}
                                                </span>
                                            )}
                                            {post.tags.length > 0 && (
                                                <span className="journal-post-tags">
                                                    {post.tags.join(" / ")}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            aria-hidden
                                            className="journal-post-arrow"
                                        >
                                            ↗
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}
        </section>
    );
}
