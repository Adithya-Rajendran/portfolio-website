import { PortableText } from "@portabletext/react";
import Link from "next/link";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import type { PostWithBody } from "@/lib/sanity-client";
import { CalendarDays } from "lucide-react";
import TableOfContents from "@/components/blogs/table-of-contents";
import MobileToc from "@/components/blogs/mobile-toc";
import { highlightCodeBlocks, type CodeBlock } from "@/lib/highlight-code";
import {
    extractHeadings,
    headingIdsByKey,
    getPostSlug,
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

    return (
        <header className="relative py-14 sm:py-20 lg:py-24 overflow-hidden">
            <div className="relative max-w-3xl mx-auto px-6 sm:px-8">
                {/* Meta info — chrome goes mono: ISO date, byline, tags */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-6">
                    <div className="flex items-center gap-2 font-term text-[0.8rem] text-slate-600 dark:text-slate-400">
                        <CalendarDays
                            aria-hidden
                            className="w-4 h-4 text-accent"
                        />
                        <time
                            className="tabular-nums"
                            dateTime={post.publishedAt || ""}
                        >
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
                        <span aria-hidden>·</span>
                        {/* Byline links to the standalone identity page */}
                        <Link
                            href="/about"
                            className="hover:text-accent transition-colors"
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

                {/* Decorative divider — picks up the theme accent */}
                <div className="flex items-center justify-center mt-10">
                    <div className="h-px w-16 bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />
                    <div className="mx-3 w-1.5 h-1.5 rounded-full bg-accent-gradient" />
                    <div className="h-px w-16 bg-gradient-to-l from-transparent via-accent to-transparent opacity-40" />
                </div>
            </div>
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
