import Link from "next/link";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug, readingTimeFromWordCount } from "./utils";

/** Hairline top rule for the list wrapper — rows carry the bottom rule,
 *  so the container adds the opening line of the "table". */
export const POST_ROW_LIST_CLASSES =
    "border-t border-slate-400/25 dark:border-white/10";

/**
 * One compact editorial listing row: mono date/read-time metadata,
 * display-face title, optional description and topic labels. Every post uses
 * the same row so the index does not manufacture a featured hierarchy.
 */
export default function PostRow({ post }: { post: PostListItem }) {
    const readingMinutes =
        post.wordCount > 0
            ? readingTimeFromWordCount(post.wordCount)
            : undefined;

    return (
        <Link
            href={`/blogs/${getPostSlug(post)}`}
            className="group grid min-h-11 gap-x-8 gap-y-3 border-b border-slate-400/25 py-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] sm:items-start sm:py-7"
        >
            <span className="flex flex-wrap items-center gap-x-2 font-term text-[0.76rem] tabular-nums text-slate-600 dark:text-slate-400 sm:block">
                {post.publishedAt && (
                    <time dateTime={post.publishedAt}>
                        {post.publishedAt.slice(0, 10)}
                    </time>
                )}
                {post.publishedAt && readingMinutes && (
                    <span aria-hidden className="text-accent sm:hidden">
                        /
                    </span>
                )}
                {readingMinutes && (
                    <span className="sm:mt-1 sm:block">
                        {readingMinutes} min read
                    </span>
                )}
            </span>
            <span className="min-w-0">
                <span className="font-display text-xl font-semibold tracking-tight text-balance text-slate-900 transition-colors group-hover:text-accent dark:text-white sm:text-2xl">
                    {post.title}
                </span>
                {post.description && (
                    <span className="mt-2 block text-sm leading-relaxed text-pretty text-slate-600 dark:text-slate-400 sm:text-base">
                        {post.description}
                    </span>
                )}
                {post.tags && post.tags.length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-term text-[0.72rem] text-slate-600 dark:text-slate-400">
                        {post.tags.slice(0, 3).map((tag) => (
                            <span key={tag}># {tag}</span>
                        ))}
                    </span>
                )}
            </span>
            <span
                aria-hidden
                className="hidden pt-1 font-term text-accent transition-transform group-hover:translate-x-1 sm:block"
            >
                →
            </span>
        </Link>
    );
}
