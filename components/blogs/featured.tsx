import Link from "next/link";
import Image from "next/image";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import { formatDate, cardClasses } from "./utils";

interface FeaturedProps {
    posts: TPost[];
}

function getPostMeta(post: TPost) {
    const slug = (post.slug as unknown as string) || "";
    const title = post.title || "";
    return { slug, title };
}

function getPostImage(post: TPost, width: number, height: number) {
    return post.image
        ? urlForImage(post.image)
            .width(width)
            .height(height)
            .fit("crop")
            .auto("format")
            .url()
        : null;
}

function PostImageAlt(post: TPost) {
    return post.image?.alt || `Blog post thumbnail for ${post.title || ""}`;
}

export default function Featured({ posts: featuredPosts }: FeaturedProps) {
    return (
        <section className="container mx-auto px-6 mb-16">
            {/* Blog hero / intro */}
            <div className="pt-8 pb-12 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                    <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent">
                        Adithya's Blogs
                    </span>
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto leading-relaxed">
                    Technical deep-dives into cloud infrastructure,
                    cybersecurity, and homelab experiments.
                    <br />
                    All opinions are my own and do not reflect the views of my employer or anyone else.
                </p>
            </div>

            {/* Featured posts */}
            {featuredPosts && featuredPosts.length > 0 && (
                <>
                    <h2 className={cardClasses.sectionLabel}>Featured</h2>
                    <div className="grid gap-6 md:grid-cols-3">
                        {featuredPosts.slice(0, 1).map((post, index) => {
                            const { slug, title } = getPostMeta(post);
                            const imageUrl = getPostImage(post, 900, 500);
                            return (
                                <Link
                                    key={slug || index}
                                    href={`/blogs/${slug}`}
                                    aria-label={`Read more about ${title}`}
                                    title={`Read more about ${title}`}
                                    className={`md:col-span-2 ${cardClasses.base}`}
                                >
                                    {imageUrl ? (
                                        <div className="relative aspect-[16/9] overflow-hidden">
                                            <Image
                                                alt={PostImageAlt(post)}
                                                className={cardClasses.imageHover}
                                                height={500}
                                                width={900}
                                                src={imageUrl}
                                                loading="eager"
                                                priority={true}
                                                style={{ objectFit: "cover" }}
                                            />
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-500 group-hover:opacity-0" />
                                            {/* Frosted glass — slides down on hover */}
                                            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 transition-all duration-500 ease-out group-hover:translate-y-full group-hover:opacity-0">
                                                <div className="backdrop-blur-md bg-black/40 rounded-xl p-5 sm:p-6 border border-white/10">
                                                    <PostDate date={post.date} variant="overlay" />
                                                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight drop-shadow-md">
                                                        {title}
                                                    </h3>
                                                    <p className="text-sm text-slate-200 line-clamp-2 max-w-xl">
                                                        {post.description || ""}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 sm:p-8">
                                            <PostDate date={post.date} variant="card" />
                                            <h3 className="text-2xl font-bold mb-2">{title}</h3>
                                            <p className="text-slate-400">{post.description || ""}</p>
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                        <div className="md:col-span-1 flex flex-col gap-6">
                            {featuredPosts.slice(1, 3).map((post, index) => {
                                const { slug, title } = getPostMeta(post);
                                const imageUrl = getPostImage(post, 700, 400);
                                return (
                                    <Link
                                        key={slug || index}
                                        href={`/blogs/${slug}`}
                                        aria-label={`Read more about ${title}`}
                                        title={`Read more about ${title}`}
                                        className={`flex-1 ${cardClasses.base}`}
                                    >
                                        {imageUrl && (
                                            <div className="relative h-40 overflow-hidden">
                                                <Image
                                                    alt={PostImageAlt(post)}
                                                    className={cardClasses.imageHover}
                                                    height={400}
                                                    width={700}
                                                    src={imageUrl}
                                                    loading="eager"
                                                    style={{ objectFit: "cover" }}
                                                />
                                            </div>
                                        )}
                                        <div className="p-5">
                                            <PostDate date={post.date} variant="card" />
                                            <h3 className="text-lg font-semibold mb-1.5 text-slate-100 group-hover:text-emerald-400 transition-colors leading-snug">
                                                {title}
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

/** Small reusable date badge with two visual variants */
function PostDate({ date, variant }: { date?: string; variant: "overlay" | "card" }) {
    if (!date) return null;
    const className =
        variant === "overlay"
            ? "text-xs font-semibold text-emerald-300 mb-2 block tracking-wide uppercase"
            : "text-xs font-medium text-emerald-400 mb-1.5 block";
    return <span className={className}>{formatDate(date)}</span>;
}
