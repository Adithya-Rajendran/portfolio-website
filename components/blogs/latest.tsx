import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import { SectionHeading } from "@/components/section-heading";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug } from "./utils";

interface LatestProps {
    posts: PostListItem[];
    /** Title shown above the rows. Defaults to "All posts". */
    title?: string;
}

/**
 * Post listing section: mono eyebrow + display title over the shared
 * chronological rows (components/blogs/post-row.tsx). Used by tag pages; the
 * blog index composes the same rows directly.
 */
export default function Latest({
    posts: allPosts,
    title = "All posts",
}: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <SectionHeading title={title} />

            <div className={POST_ROW_LIST_CLASSES}>
                {allPosts.map((post) => (
                    <PostRow key={getPostSlug(post) || post._id} post={post} />
                ))}
            </div>
        </section>
    );
}
