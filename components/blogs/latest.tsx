import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug } from "./utils";

interface LatestProps {
    posts: PostListItem[];
    /** Title shown above the rows. Defaults to "All posts". */
    title?: string;
    /** Eyebrow above the title. Overridable so pages with their own
     *  hero eyebrow (tag pages) don't stack mismatched labels. */
    eyebrow?: string;
}

/**
 * Post listing section: mono eyebrow + display title over the shared
 * `ls`-style rows (components/blogs/post-row.tsx). Used by the tag
 * pages; the blog index composes PostRow directly via ShowMorePosts.
 */
export default function Latest({
    posts: allPosts,
    title = "All posts",
    eyebrow = "Archive",
}: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <header className="mb-8">
                <p className="font-term text-[0.7rem] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400">
                    {eyebrow}
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                    {title}
                </h2>
            </header>

            <div className={POST_ROW_LIST_CLASSES}>
                {allPosts.map((post) => (
                    <PostRow key={getPostSlug(post) || post._id} post={post} />
                ))}
            </div>
        </section>
    );
}
