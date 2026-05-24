import Image from "next/image";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import SectionHeader from "@/components/section-header";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import { formatDate, readingTimeFor } from "./utils";

interface LatestProps {
    posts: TPost[];
    /** Title shown above the grid. Defaults to "All posts". */
    title?: string;
}

export default function Latest({ posts: allPosts, title = "All posts" }: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <SectionHeader eyebrow="Archive" title={title} />

            <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {allPosts.map((post) => {
                    const slug =
                        typeof post.slug === "string"
                            ? post.slug
                            : (post.slug?.current ?? "");
                    const imageUrl = post.image
                        ? urlForImage(post.image)
                              .width(400)
                              .height(240)
                              .fit("crop")
                              .auto("format")
                              .url()
                        : null;
                    const readingTime = readingTimeFor(post);
                    return (
                        <Card
                            key={slug || post._id}
                            href={`/blogs/${slug}`}
                            aria-label={`Read more about ${post.title || ""}`}
                            title={`Read more about ${post.title || ""}`}
                            flush
                            className="flex flex-col h-full"
                        >
                            {imageUrl && (
                                <div className="relative aspect-[5/3] overflow-hidden">
                                    <Image
                                        src={imageUrl}
                                        alt={
                                            post.image?.alt || post.title || ""
                                        }
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        loading="lazy"
                                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col flex-1 p-5 sm:p-6">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2 flex items-center gap-2 flex-wrap">
                                    {post.date && (
                                        <span>{formatDate(post.date)}</span>
                                    )}
                                    {post.date && (
                                        <span
                                            aria-hidden
                                            className="w-1 h-1 rounded-full bg-accent opacity-50"
                                        />
                                    )}
                                    <span className="inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {readingTime} min read
                                    </span>
                                </p>
                                <h3 className="font-display text-base sm:text-lg font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-accent transition-colors line-clamp-2">
                                    {post.title || ""}
                                </h3>
                                {post.description && (
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                                        {post.description}
                                    </p>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}
