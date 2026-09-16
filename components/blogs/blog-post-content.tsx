import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import type { PostWithBody } from "@/lib/sanity-client";
import TableOfContents from "@/components/blogs/table-of-contents";
import MobileToc from "@/components/blogs/mobile-toc";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import {
    extractHeadings,
    headingIdsByKey,
    getPostSlug,
    formatDate,
    readingTimeFromWordCount,
} from "@/components/blogs/utils";
import { TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";

interface BlogPostHeroProps {
    post: {
        title?: string | null;
        slug?: string | { current?: string } | null;
        description?: string | null;
        publishedAt?: string | null;
        tags?: string[] | null;
        wordCount?: number | null;
    };
}

/**
 * Blog post hero — renders instantly from lightweight post metadata.
 */
export function BlogPostHero({ post }: BlogPostHeroProps) {
    // Same gate every other tag surface applies (collectTags, tag pages):
    // schema-invalid tags authored outside the Studio would otherwise
    // render as pills linking to guaranteed 404s.
    const tags = (post.tags ?? []).filter((tag) => TAG_PATTERN.test(tag));

    const readingMinutes = post.wordCount
        ? readingTimeFromWordCount(post.wordCount)
        : null;
    return (
        <header className="journal-article-header">
            <Link href="/blog" className="journal-eyebrow journal-back-link">
                ← From the notebook
            </Link>
            <div className="journal-article-meta">
                {post.publishedAt && (
                    <time dateTime={post.publishedAt}>
                        {formatDate(post.publishedAt)}
                    </time>
                )}
                {readingMinutes && <span>{readingMinutes} min read</span>}
            </div>
            <h1>{post.title || ""}</h1>
            {post.description && (
                <p className="journal-article-description">
                    {post.description}
                </p>
            )}
            <div className="journal-article-byline">
                <Link href="/about">
                    {siteConfig.author} <span aria-hidden>↗</span>
                </Link>
            </div>
            {tags.length > 0 && (
                <nav
                    className="journal-article-tags"
                    aria-label="Article topics"
                >
                    {tags.map((tag) => (
                        <Link key={tag} href={`/blog/tags/${tag}`}>
                            {tag}
                        </Link>
                    ))}
                </nav>
            )}
        </header>
    );
}

/**
 * Blog post body — async because it runs shiki syntax highlighting.
 */
export default async function BlogPostBody({ post }: { post: PostWithBody }) {
    if (!post.body) return null;

    // One source of truth for heading ids: the ToC entries and the heading
    // anchors both derive from extractHeadings, keyed by block _key.
    const headings = extractHeadings(post);
    const headingIds = headingIdsByKey(headings);

    // Pass only the code blocks: the "use cache" key serializes the
    // arguments, so prose stays out of the cache key.
    const codeBlocks = post.body.filter(
        (block): block is typeof block & CodeBlock =>
            block._type === "code" && typeof block._key === "string",
    );
    const highlightedCode = await highlightCodeBlocks(
        codeBlocks,
        getPostSlug(post),
    );
    const portableTextComponents = createPortableTextComponents(
        highlightedCode,
        headingIds,
    );

    return (
        <div className="journal-reading-frame">
            <div className="journal-reading-column">
                <MobileToc headings={headings} />
                <div className="journal-prose">
                    <PortableText
                        value={post.body}
                        components={portableTextComponents}
                    />
                </div>
            </div>
            <TableOfContents headings={headings} />
        </div>
    );
}
