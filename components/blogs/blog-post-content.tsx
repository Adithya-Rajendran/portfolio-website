import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/blogs/portable-text-components";
import { BlogPostJsonLd } from "@/components/json-ld";
import type { Post } from "@/sanity.types";
import { CalendarDays, Clock } from "lucide-react";

function estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export default function BlogPostContent({ post }: { post: Post }) {
    const bodyText = post.body
        ? post.body
              .filter((block: any) => block._type === "block")
              .map((block: any) =>
                  block.children
                      ?.map((child: any) => child.text || "")
                      .join(" ")
              )
              .join(" ")
        : "";
    const readingTime = estimateReadingTime(bodyText);

    return (
        <>
            <BlogPostJsonLd
                title={post.title || ""}
                description={post.description || ""}
                date={post.date || ""}
                slug={post.slug?.current || ""}
            />
            <article className="w-full">
                {/* Hero Section */}
                <header className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 dark:via-transparent" />
                    <div className="absolute inset-0 bg-grid-pattern opacity-50" />
                    
                    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Meta info */}
                        <div className="flex items-center justify-center gap-6 mb-8">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <time dateTime={post.date || ""}>
                                    {post.date
                                        ? new Date(post.date).toLocaleDateString("en-US", {
                                              year: "numeric",
                                              month: "long",
                                              day: "numeric",
                                          })
                                        : ""}
                                </time>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-600" />
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>{readingTime} min read</span>
                            </div>
                        </div>

                        {/* Title */}
                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-8 text-balance leading-tight text-slate-900 dark:text-white">
                            {post.title || ""}
                        </h1>

                        {/* Description */}
                        {post.description && (
                            <div className="max-w-3xl mx-auto">
                                <p className="text-lg sm:text-xl text-center leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                                    {post.description}
                                </p>
                            </div>
                        )}

                        {/* Decorative divider */}
                        <div className="flex items-center justify-center mt-12">
                            <div className="h-px w-16 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
                            <div className="mx-4 w-2 h-2 rounded-full bg-emerald-500/50" />
                            <div className="h-px w-16 bg-gradient-to-l from-transparent via-emerald-500/50 to-transparent" />
                        </div>
                    </div>
                </header>

                {/* Content */}
                {post.body && (
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                        <div className="prose prose-slate dark:prose-invert prose-lg max-w-none">
                            <PortableText
                                value={post.body}
                                components={portableTextComponents}
                            />
                        </div>
                    </div>
                )}
            </article>
        </>
    );
}
