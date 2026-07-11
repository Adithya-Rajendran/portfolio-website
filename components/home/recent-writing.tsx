import Link from "next/link";
import TerminalSection from "@/components/terminal/terminal-section";
import type { PostListItem } from "@/lib/sanity-client";

/** How many essays the home page lists before pointing at /blogs. */
const RECENT_COUNT = 4;

/**
 * `$ ls posts/` — the home page surfaces the writing itself: date +
 * title + one-sentence description rows (tabular mono dates, reading
 * titles in the display face). Posts arrive newest-first from
 * getAllPosts.
 */
export default function RecentWriting({ posts }: { posts: PostListItem[] }) {
    if (posts.length === 0) return null;

    return (
        <TerminalSection
            command="ls posts/ --sort date"
            label="Recent writing"
            className="w-full max-w-6xl mx-auto px-6 sm:px-8"
        >
            <div className="border-t border-slate-400/25 dark:border-white/10">
                {posts.slice(0, RECENT_COUNT).map((post) => (
                    <Link
                        key={post._id}
                        href={`/blogs/${post.slug}`}
                        className="group grid gap-y-1 gap-x-8 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] items-baseline py-6 border-b border-slate-400/25 dark:border-white/10"
                    >
                        <span className="font-term text-[0.8rem] tabular-nums text-slate-600 dark:text-slate-400">
                            {post.date}
                        </span>
                        <span className="min-w-0">
                            <span className="block font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white group-hover:text-accent transition-colors text-balance">
                                {post.title}
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
                ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                <Link
                    href="/blogs"
                    className="font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
                >
                    [ ./blog --all ]
                </Link>
                <Link
                    href="/blogs/archive"
                    className="font-term text-sm text-slate-600 hover:text-accent dark:text-slate-400 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
                >
                    [ ./archive ]
                </Link>
            </div>
        </TerminalSection>
    );
}
