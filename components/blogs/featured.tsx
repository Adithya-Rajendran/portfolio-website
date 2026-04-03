import Link from "next/link";
import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";

interface FeaturedProps {
    posts: TPost[];
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

export default function Featured({ posts: featuredPosts }: FeaturedProps) {
    return (
        <section className="container mx-auto px-6 mb-16">
            {/* Blog hero / intro */}
            <div className="pt-8 pb-12 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                    <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent">
                        Blog
                    </span>
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto leading-relaxed">
                    Technical deep-dives into cloud infrastructure,
                    cybersecurity, and homelab experiments.
                </p>
            </div>

            {/* Featured posts */}
            {featuredPosts && featuredPosts.length > 0 && (
                <>
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-6">
                        Featured
                    </h2>
                    <div className="grid gap-6 md:grid-cols-3">
                        {featuredPosts.slice(0, 1).map((post, index) => {
                            const slug =
                                (post.slug as unknown as string) || "";
                            const imageUrl = post.image
                                ? urlForImage(post.image)
                                      .width(900)
                                      .height(500)
                                      .fit("crop")
                                      .auto("format")
                                      .url()
                                : null;
                            return (
                                <Link
                                    key={slug || index}
                                    href={`/blogs/${slug}`}
                                    aria-label={`Read more about ${post.title || ""}`}
                                    title={`Read more about ${post.title || ""}`}
                                    className="md:col-span-2 group relative rounded-xl overflow-hidden border border-white/8 bg-white/[0.03] transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 block"
                                >
                                    {imageUrl && (
                                        <div className="relative aspect-[16/9] overflow-hidden">
                                            <Image
                                                alt={
                                                    post.image?.alt ||
                                                    `Blog post thumbnail for ${post.title || ""}`
                                                }
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                                height={500}
                                                width={900}
                                                src={imageUrl}
                                                loading="eager"
                                                priority={true}
                                                style={{
                                                    objectFit: "cover",
                                                }}
                                            />
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-500 group-hover:opacity-0" />
                                            {/* Title overlay with frosted glass — slides down on hover */}
                                            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 transition-all duration-500 ease-out group-hover:translate-y-full group-hover:opacity-0">
                                                <div className="backdrop-blur-md bg-black/40 rounded-xl p-5 sm:p-6 border border-white/10">
                                                    {post.date && (
                                                        <span className="text-xs font-semibold text-emerald-300 mb-2 block tracking-wide uppercase">
                                                            {formatDate(post.date)}
                                                        </span>
                                                    )}
                                                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight drop-shadow-md">
                                                        {post.title || ""}
                                                    </h3>
                                                    <p className="text-sm text-slate-200 line-clamp-2 max-w-xl">
                                                        {post.description || ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {!imageUrl && (
                                        <div className="p-6 sm:p-8">
                                            {post.date && (
                                                <span className="text-xs font-medium text-emerald-400 mb-2 block">
                                                    {formatDate(post.date)}
                                                </span>
                                            )}
                                            <h3 className="text-2xl font-bold mb-2">
                                                {post.title || ""}
                                            </h3>
                                            <p className="text-slate-400">
                                                {post.description || ""}
                                            </p>
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                        <div className="md:col-span-1 flex flex-col gap-6">
                            {featuredPosts.slice(1, 3).map((post, index) => {
                                const slug =
                                    (post.slug as unknown as string) || "";
                                const imageUrl = post.image
                                    ? urlForImage(post.image)
                                          .width(700)
                                          .height(400)
                                          .fit("crop")
                                          .auto("format")
                                          .url()
                                    : null;
                                return (
                                    <Link
                                        key={slug || index}
                                        href={`/blogs/${slug}`}
                                        aria-label={`Read more about ${post.title || ""}`}
                                        title={`Read more about ${post.title || ""}`}
                                        className="group relative rounded-xl overflow-hidden border border-white/8 bg-white/[0.03] transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 block flex-1"
                                    >
                                        {imageUrl && (
                                            <div className="relative h-40 overflow-hidden">
                                                <Image
                                                    alt={
                                                        post.image?.alt ||
                                                        `Blog post thumbnail for ${post.title || ""}`
                                                    }
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                                                    height={400}
                                                    width={700}
                                                    src={imageUrl}
                                                    loading="eager"
                                                    style={{
                                                        objectFit: "cover",
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="p-5">
                                            {post.date && (
                                                <span className="text-xs font-medium text-emerald-400 mb-1.5 block">
                                                    {formatDate(post.date)}
                                                </span>
                                            )}
                                            <h3 className="text-lg font-semibold mb-1.5 text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug">
                                                {post.title || ""}
                                            </h3>
                                            <p className="text-sm text-slate-400 line-clamp-2">
                                                {post.description || ""}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
