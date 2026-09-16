import PostRow, { POST_ROW_LIST_CLASSES } from "@/components/blogs/post-row";
import type { PostListItem } from "@/lib/sanity-client";
import { getPostSlug } from "./utils";

export default function Latest({
    posts,
    title = "All writing",
}: {
    posts: PostListItem[];
    title?: string;
}) {
    const publishedPosts = posts.filter((post) => getPostSlug(post));
    if (!publishedPosts.length) return null;
    return (
        <section className="journal-topic-posts">
            <div className="journal-section-heading">
                <h2>{title}</h2>
            </div>
            <div className={POST_ROW_LIST_CLASSES}>
                {publishedPosts.map((post) => (
                    <PostRow key={getPostSlug(post)} post={post} />
                ))}
            </div>
        </section>
    );
}
