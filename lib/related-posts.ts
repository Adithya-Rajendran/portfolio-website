import type { PostListItem, PostMeta } from "@/lib/sanity-client";

/** Select from getAllPosts(), which owns the public publication gate. */
export function selectNextPosts(
    posts: readonly PostListItem[],
    currentPost: Pick<PostMeta, "slug" | "tags">,
): PostListItem[] {
    const currentTags = new Set(currentPost.tags ?? []);
    const sharedTopics = (post: PostListItem) =>
        [...new Set(post.tags ?? [])].filter((tag) => currentTags.has(tag))
            .length;

    return posts
        .filter(
            (post) =>
                post.slug && post.publishedAt && post.slug !== currentPost.slug,
        )
        .sort(
            (a, b) =>
                sharedTopics(b) - sharedTopics(a) ||
                b.publishedAt.localeCompare(a.publishedAt),
        )
        .slice(0, 2);
}
