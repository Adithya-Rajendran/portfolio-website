import SectionHeader from "@/components/section-header";
import PostCard from "@/components/blogs/post-card";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug } from "./utils";

interface LatestProps {
    posts: PostListItem[];
    /** Title shown above the grid. Defaults to "All posts". */
    title?: string;
}

export default function Latest({
    posts: allPosts,
    title = "All posts",
}: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <SectionHeader eyebrow="Archive" title={title} />

            <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
