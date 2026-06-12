import { PortableText } from "@portabletext/react";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import type { Post } from "@/sanity.types";
import { CalendarDays } from "lucide-react";
import TableOfContents from "@/components/blogs/table-of-contents";
import { highlightCodeBlocks } from "@/lib/highlight-code";
import {
    extractHeadings,
    headingIdsByKey,
    formatDate,
    getPostSlug,
} from "@/components/blogs/utils";

interface BlogPostHeroProps {
    post: {
        title?: string | null;
        slug?: string | { current?: string } | null;
        description?: string | null;
        date?: string | null;
    };
}

/**
 * Blog post hero — renders instantly from lightweight post metadata.
 */
export function BlogPostHero({ post }: BlogPostHeroProps) {
    return (
        <header className="relative py-14 sm:py-20 lg:py-24 overflow-hidden">
            <div className="relative max-w-3xl mx-auto px-6 sm:px-8">
                {/* Meta info */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 mb-6">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <CalendarDays className="w-4 h-4 text-accent" />
                        <time dateTime={post.date || ""}>
                            {formatDate(post.date ?? undefined)}
                        </time>
                    </div>
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
export default async function BlogPostBody({ post }: { post: Post }) {
    if (!post.body) return null;

    // One source of truth for heading ids: the ToC entries and the heading
    // anchors both derive from extractHeadings, keyed by block _key.
    const headings = extractHeadings(post);
    const headingIds = headingIdsByKey(headings);

    const highlightedCode = await highlightCodeBlocks(
        post.body,
        getPostSlug(post),
    );
    const portableTextComponents = createPortableTextComponents(
        highlightedCode,
        headingIds,
    );

    return (
        <div className="relative mx-auto px-6 sm:px-8 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,48rem)_16rem_1fr] xl:grid-cols-[1fr_minmax(0,48rem)_18rem_1fr] gap-0 max-w-[90rem]">
            <div className="hidden lg:block" />

            <div className="min-w-0">
                <PortableText
                    value={post.body}
                    components={portableTextComponents}
                />
            </div>

            <TableOfContents headings={headings} />

            <div className="hidden lg:block" />
        </div>
    );
}
