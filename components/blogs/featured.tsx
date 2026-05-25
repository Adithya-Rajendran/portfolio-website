import Image from "next/image";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import SectionHeader from "@/components/section-header";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import { formatDate, readingTimeFor } from "./utils";

interface FeaturedProps {
    posts: TPost[];
}

function getSlug(post: TPost) {
    return typeof post.slug === "string"
        ? post.slug
        : (post.slug?.current ?? "");
}

function getImage(post: TPost, width: number, height: number) {
    if (!post.image) return null;
    return urlForImage(post.image)
        .width(width)
        .height(height)
        .fit("crop")
        .auto("format")
        .url();
}

/**
 * Featured posts grid. Layout adapts to count:
 *   - 1 post  → single full-width hero card
 *   - 2 posts → 2-col equal grid
 *   - 3+ posts → 1 hero + remaining in a 3-col grid (no posts are dropped)
 */
export default function Featured({ posts: featuredPosts }: FeaturedProps) {
    if (!featuredPosts || featuredPosts.length === 0) return null;

    const [hero, ...rest] = featuredPosts;

    return (
        <section>
            <SectionHeader eyebrow="Featured" title="Reads I'm proud of" />

            {featuredPosts.length === 1 && hero && (
                <FeatureCard post={hero} variant="hero" />
            )}

            {featuredPosts.length === 2 && (
                <div className="grid gap-5 sm:gap-6 md:grid-cols-2">
                    {featuredPosts.map((post) => (
                        <FeatureCard
                            key={getSlug(post)}
                            post={post}
                            variant="medium"
                        />
                    ))}
                </div>
            )}

            {featuredPosts.length >= 3 && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    {hero && <FeatureCard post={hero} variant="hero" />}
                    <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {rest.map((post) => (
                            <FeatureCard
                                key={getSlug(post)}
                                post={post}
                                variant="side"
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

function FeatureCard({
    post,
    variant,
}: {
    post: TPost;
    variant: "hero" | "medium" | "side";
}) {
    const slug = getSlug(post);
    const title = post.title || "";
    const isHero = variant === "hero";
    const readingTime = readingTimeFor(post);

    const imageWidth = isHero ? 1200 : variant === "medium" ? 800 : 600;
    const imageHeight = isHero ? 600 : variant === "medium" ? 480 : 400;
    const imageUrl = getImage(post, imageWidth, imageHeight);

    const aspectClass = isHero
        ? "aspect-[2/1] sm:aspect-[21/9]"
        : variant === "medium"
          ? "aspect-[16/10]"
          : "aspect-[16/10]";

    const padClass = isHero
        ? "p-6 sm:p-8 md:p-10"
        : variant === "medium"
          ? "p-6 sm:p-7"
          : "p-5 sm:p-6";

    const titleClass = isHero
        ? "text-2xl sm:text-3xl md:text-4xl tracking-tight"
        : variant === "medium"
          ? "text-xl sm:text-2xl tracking-tight"
          : "text-base sm:text-lg";

    const descClass = isHero
        ? "text-base sm:text-lg line-clamp-3"
        : "text-sm line-clamp-2";

    return (
        <Card
            href={`/blogs/${slug}`}
            aria-label={`Read more about ${title}`}
            title={`Read more about ${title}`}
            flush
            className="flex flex-col"
        >
            {imageUrl && (
                <div className={`relative overflow-hidden ${aspectClass}`}>
                    <Image
                        src={imageUrl}
                        alt={post.image?.alt || title}
                        fill
                        sizes={
                            isHero
                                ? "(max-width: 768px) 100vw, 1200px"
                                : variant === "medium"
                                  ? "(max-width: 768px) 100vw, 50vw"
                                  : "(max-width: 768px) 100vw, 33vw"
                        }
                        loading="eager"
                        priority={isHero}
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                    />
                </div>
            )}
            <div className={`flex-1 flex flex-col ${padClass}`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2 flex items-center gap-2 flex-wrap">
                    {post.date && <span>{formatDate(post.date)}</span>}
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
                <h3
                    className={`font-display font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-accent transition-colors ${titleClass}`}
                >
                    {title}
                </h3>
                {post.description && (
                    <p
                        className={`mt-2 text-slate-600 dark:text-slate-400 ${descClass}`}
                    >
                        {post.description}
                    </p>
                )}
            </div>
        </Card>
    );
}
