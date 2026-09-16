import Link from "next/link";
import type { PostListItem } from "@/lib/sanity-client";
import { formatDate, getPostSlug, readingTimeFromWordCount } from "./utils";

export const POST_ROW_LIST_CLASSES = "journal-post-list";

export default function PostRow({ post }: { post: PostListItem }) {
    const readingMinutes =
        post.wordCount > 0
            ? readingTimeFromWordCount(post.wordCount)
            : undefined;
    return (
        <Link href={`/blog/${getPostSlug(post)}`} className="journal-post-row">
            <span className="journal-post-meta">
                {post.publishedAt && (
                    <time dateTime={post.publishedAt}>
                        {formatDate(post.publishedAt)}
                    </time>
                )}
                {readingMinutes && <span>{readingMinutes} min read</span>}
            </span>
            <span className="journal-post-summary">
                <span className="journal-post-title">{post.title}</span>
                {post.description && (
                    <span className="journal-post-description">
                        {post.description}
                    </span>
                )}
                {post.tags && post.tags.length > 0 && (
                    <span className="journal-post-tags">
                        {post.tags.slice(0, 3).join(" / ")}
                    </span>
                )}
            </span>
            <span className="journal-post-arrow" aria-hidden>
                ↗
            </span>
        </Link>
    );
}
