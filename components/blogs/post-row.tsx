import Link from "next/link";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug } from "./utils";

/** Hairline top rule for the list wrapper — rows carry the bottom rule,
 *  so the container adds the opening line of the "table". */
export const POST_ROW_LIST_CLASSES =
    "border-t border-slate-400/25 dark:border-white/10";

/**
 * One `ls`-style listing row: mono tabular date column, display-face
 * title, optional dek, hover accent + trailing arrow. Mirrors the row
 * anatomy of components/home/recent-writing.tsx — the canonical
 * terminal listing. Featured posts get a small mono `★ featured` chip
 * instead of a separate card hero.
 */
export default function PostRow({ post }: { post: PostListItem }) {
    return (
        <Link
            href={`/blogs/${getPostSlug(post)}`}
            className="group grid gap-y-1 gap-x-8 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] items-baseline py-6 border-b border-slate-400/25 dark:border-white/10"
        >
            <span className="font-term text-[0.8rem] tabular-nums text-slate-600 dark:text-slate-400">
                {post.date}
            </span>
            <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white group-hover:text-accent transition-colors text-balance">
                        {post.title}
                    </span>
                    {post.featured && (
                        <span className="font-term text-[0.7rem] font-bold text-accent whitespace-nowrap">
                            ★ featured
                        </span>
                    )}
                </span>
                {post.description && (
                    <span className="block mt-1.5 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400 text-pretty">
                        {post.description}
                    </span>
                )}
            </span>
            <span
                aria-hidden
                className="hidden sm:block font-term text-accent transition-transform group-hover:translate-x-1"
            >
                →
            </span>
        </Link>
    );
}
