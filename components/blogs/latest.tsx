import Image from "next/image";
import { Card } from "@/components/ui/card";
import SectionHeader from "@/components/section-header";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import { formatDate } from "./utils";

interface LatestProps {
    posts: TPost[];
}

export default function Latest({ posts: allPosts }: LatestProps) {
    if (!allPosts || allPosts.length === 0) return null;

    return (
        <section>
            <SectionHeader eyebrow="Archive" title="All posts" />

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
                                        alt={post.image?.alt || post.title || ""}
                                        fill
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                        loading="lazy"
                                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col flex-1 p-5 sm:p-6">
                                {post.date && (
                                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                                        {formatDate(post.date)}
                                    </p>
                                )}
                                <h3 className="text-base sm:text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
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
