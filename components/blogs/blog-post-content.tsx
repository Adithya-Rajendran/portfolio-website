import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import type { PostWithBody } from "@/lib/sanity-client";
import TableOfContents from "@/components/blogs/table-of-contents";
import MobileToc from "@/components/blogs/mobile-toc";
import TerminalSection from "@/components/terminal/terminal-section";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import {
    extractHeadings,
    headingIdsByKey,
    getPostSlug,
} from "@/components/blogs/utils";
import { TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";

interface BlogPostHeroProps {
    slug: string;
    post: {
        title?: string | null;
        slug?: string | { current?: string } | null;
        description?: string | null;
        publishedAt?: string | null;
        tags?: string[] | null;
    };
}

/**
 * Blog post hero — renders instantly from lightweight post metadata.
 */
export function BlogPostHero({ post, slug }: BlogPostHeroProps) {
    // Same gate every other tag surface applies (collectTags, tag pages):
    // schema-invalid tags authored outside the Studio would otherwise
    // render as pills linking to guaranteed 404s.
    const tags = (post.tags ?? []).filter((tag) => TAG_PATTERN.test(tag));

    return (
        <TerminalSection
            as="header"
            path=""
            command={`cat ${slug}.md`}
            promptVariant="compact"
            animatePrompt
            className="relative overflow-hidden py-14 sm:py-20 lg:py-24"
            promptClassName="post-route-prompt mx-auto mb-7 max-w-3xl justify-center px-1 min-[360px]:px-3 sm:px-8"
            bodyClassName="relative mx-auto max-w-3xl px-6 sm:px-8"
        >
            {/* Meta info — chrome goes mono: ISO date, byline, tags */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-6">
                <div className="flex flex-col items-center gap-1 font-term text-[0.8rem] text-slate-600 sm:flex-row sm:gap-2 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span aria-hidden className="font-bold text-accent">
                            #
                        </span>
                        <time dateTime={post.publishedAt || ""}>
                            {post.publishedAt
                                ? new Date(post.publishedAt).toLocaleDateString(
                                      "en-US",
                                      {
                                          month: "long",
                                          day: "numeric",
                                          year: "numeric",
                                          timeZone: "UTC",
                                      },
                                  )
                                : ""}
                        </time>
                    </span>
                    <span aria-hidden className="hidden sm:inline">
                        ·
                    </span>
                    {/* Byline links to the standalone identity page */}
                    <Link
                        href="/about"
                        className="whitespace-nowrap transition-colors hover:text-accent"
                    >
                        by {siteConfig.author}
                    </Link>
                </div>

                {tags.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                        {tags.map((tag) => (
                            <Link
                                key={tag}
                                href={`/blogs/tags/${tag}`}
                                className="font-term text-[0.8rem] whitespace-nowrap text-slate-600 dark:text-slate-400 hover:text-accent transition-colors"
                            >
                                # {tag}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-center mb-6 text-balance leading-tight text-slate-900 dark:text-white">
                {post.title || ""}
            </h1>

            {/* Description */}
            {post.description && (
                <p className="text-base sm:text-lg text-center leading-relaxed text-slate-600 dark:text-slate-400 text-pretty max-w-2xl mx-auto">
                    {post.description}
                </p>
            )}
        </TerminalSection>
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
        <>
            <MobileToc headings={headings} />

            {/* Prose column capped at 42.5rem ≈ 75 characters/line — the
                readability comfort band for 17px body text. */}
            <div className="relative mx-auto px-6 sm:px-8 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,42.5rem)_16rem_1fr] xl:grid-cols-[1fr_minmax(0,42.5rem)_17rem_1fr] gap-0 max-w-[90rem]">
                <div className="hidden lg:block" />

                <div className="mx-auto w-full max-w-[42.5rem] min-w-0">
                    <PortableText
                        value={post.body}
                        components={portableTextComponents}
                    />
                </div>

                <TableOfContents headings={headings} />

                <div className="hidden lg:block" />
            </div>
        </>
    );
}
