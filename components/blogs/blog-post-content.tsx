import { PortableText } from "@portabletext/react";
import { createPortableTextComponents } from "@/components/blogs/portable-text-components";
import { BlogPostJsonLd } from "@/components/json-ld";
import type { Post } from "@/sanity.types";
import { CalendarDays, Clock } from "lucide-react";
import TableOfContents, { type TocHeading } from "@/components/blogs/table-of-contents";
import { highlightCodeBlocks } from "@/lib/highlight-code";
import { slugify, formatDate } from "@/components/blogs/utils";

function estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
}

function extractBodyText(post: Post): string {
    return post.body
        ? (post.body as any[])
              .filter((block: any) => block._type === "block")
              .map((block: any) =>
                  block.children
                      ?.map((child: any) => child.text || "")
                      .join(" ")
              )
              .join(" ")
        : "";
}

export function extractHeadings(post: Post): TocHeading[] {
    return post.body
        ? (post.body as any[])
              .filter(
                  (block: any) =>
                      block._type === "block" &&
                      ["h2", "h3", "h4"].includes(block.style)
              )
              .map((block: any) => {
                  const text = (block.children as any[])
                      ?.map((child: any) => child.text || "")
                      .join("") || "";
                  return {
                      id: slugify(text),
                      text,
                      level: parseInt(block.style.replace("h", ""), 10) as 2 | 3 | 4,
                  };
              })
              .filter((h: TocHeading) => h.text.length > 0)
        : [];
}

/**
 * Blog post hero — renders instantly from post metadata.
 * No async work needed; this is the first thing the reader sees.
 */
export function BlogPostHero({ post }: { post: Post }) {
    const bodyText = extractBodyText(post);
    const readingTime = estimateReadingTime(bodyText);

    return (
        <>
            <BlogPostJsonLd
                title={post.title || ""}
                description={post.description || ""}
                date={post.date || ""}
                slug={post.slug?.current || ""}
            />
            <header className="relative py-12 sm:py-16 lg:py-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 dark:via-transparent" />
                <div className="absolute inset-0 bg-grid-pattern opacity-50" />

                <div className="relative max-w-3xl mx-auto px-6 sm:px-8">
                    {/* Meta info */}
                    <div className="flex items-center justify-center gap-4 sm:gap-6 mb-6">
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <time dateTime={post.date || ""}>
                                {formatDate(post.date)}
                            </time>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>{readingTime} min read</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-6 text-balance leading-tight text-slate-900 dark:text-white">
                        {post.title || ""}
                    </h1>

                    {/* Description */}
                    {post.description && (
                        <p className="text-base sm:text-lg text-center leading-relaxed text-slate-500 dark:text-slate-400 text-pretty max-w-2xl mx-auto">
                            {post.description}
                        </p>
                    )}

                    {/* Decorative divider */}
                    <div className="flex items-center justify-center mt-10">
                        <div className="h-px w-16 bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
                        <div className="mx-3 w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                        <div className="h-px w-16 bg-gradient-to-l from-transparent via-emerald-500/40 to-transparent" />
                    </div>
                </div>
            </header>
        </>
    );
}

/**
 * Blog post body — async because it runs shiki syntax highlighting.
 * Wrapped in Suspense at the page level so the hero streams first.
 */
export default async function BlogPostBody({ post }: { post: Post }) {
    if (!post.body) return null;

    const headings = extractHeadings(post);

    // This is the expensive async operation — shiki highlighting
    const highlightedCode = await highlightCodeBlocks(post.body as any[]);
    const portableTextComponents = createPortableTextComponents(highlightedCode);

    return (
        <div className="relative mx-auto px-6 sm:px-8 pb-24 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,48rem)_16rem_1fr] xl:grid-cols-[1fr_minmax(0,48rem)_18rem_1fr] gap-0 max-w-[90rem]">
            {/* Left spacer */}
            <div className="hidden lg:block" />

            {/* Article prose */}
            <div className="min-w-0">
                <PortableText
                    value={post.body}
                    components={portableTextComponents}
                />
            </div>

            {/* ToC sidebar */}
            <TableOfContents headings={headings} />

            {/* Right spacer */}
            <div className="hidden lg:block" />
        </div>
    );
}
