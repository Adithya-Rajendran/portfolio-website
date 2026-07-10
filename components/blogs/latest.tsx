import SectionHeader from "@/components/section-header";
import PostCard from "@/components/blogs/post-card";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug, POST_GRID_CLASSES } from "./utils";

interface LatestProps {
    posts: PostListItem[];
    /** Title shown above the grid. Defaults to "All posts". */
    title?: string;
    /** Eyebrow above the title. Overridable so pages with their own
     *  hero eyebrow (tag pages) don't stack mismatched labels. */
    eyebrow?: string;
}

export default function Latest({
    posts: allPosts,
    title = "All posts",
    eyebrow = "Archive",
}: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <SectionHeader eyebrow={eyebrow} title={title} />

            <div className={POST_GRID_CLASSES}>
                {allPosts.map((post) => (
                    <PostCard
                        key={getPostSlug(post) || post._id}
                        post={post}
                        variant="list"
                    />
                ))}
            </div>
        </section>
    );
}
