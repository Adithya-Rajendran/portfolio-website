import Image from "next/image";
import { Card } from "@/components/ui/card";
import SectionHeader from "@/components/section-header";
import { urlForImage } from "@/lib/sanity-image";
import type { Post as TPost } from "@/sanity.types";
import { formatDate } from "./utils";

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

export default function Featured({ posts: featuredPosts }: FeaturedProps) {
    if (!featuredPosts || featuredPosts.length === 0) return null;

    const [hero, ...rest] = featuredPosts;
    const sidePosts = rest.slice(0, 2);

    return (
        <section>
            <SectionHeader eyebrow="Featured" title="Reads I'm proud of" />

            <div className="grid gap-5 sm:gap-6 md:grid-cols-3">
                {hero && <FeatureCard post={hero} variant="hero" />}
                <div className="md:col-span-1 flex flex-col gap-5 sm:gap-6">
                    {sidePosts.map((post) => (
                        <FeatureCard
                            key={getSlug(post)}
                            post={post}
                            variant="side"
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

function FeatureCard({
    post,
    variant,
}: {
    post: TPost;
    variant: "hero" | "side";
}) {
    const slug = getSlug(post);
    const title = post.title || "";
    const isHero = variant === "hero";
    const imageUrl = isHero
        ? getImage(post, 900, 500)
        : getImage(post, 700, 400);

    return (
        <Card
            href={`/blogs/${slug}`}
            aria-label={`Read more about ${title}`}
            title={`Read more about ${title}`}
            flush
            className={
                isHero
                    ? "md:col-span-2 flex flex-col"
                    : "flex-1 flex flex-col"
            }
        >
            {imageUrl && (
                <div
                    className={`relative overflow-hidden ${
                        isHero ? "aspect-[16/9]" : "aspect-[16/10]"
                    }`}
                >
                    <Image
                        src={imageUrl}
                        alt={post.image?.alt || title}
                        fill
                        sizes={
                            isHero
                                ? "(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 900px"
                                : "(max-width: 768px) 100vw, 33vw"
                        }
                        loading="eager"
                        priority={isHero}
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                    />
                </div>
            )}
            <div
                className={`flex-1 flex flex-col ${
                    isHero ? "p-6 sm:p-8" : "p-5 sm:p-6"
                }`}
            >
                {post.date && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent mb-2">
                        {formatDate(post.date)}
                    </p>
                )}
                <h3
                    className={`font-display font-semibold leading-snug text-slate-900 dark:text-white group-hover:text-accent transition-colors ${
                        isHero
                            ? "text-2xl sm:text-3xl tracking-tight"
                            : "text-base sm:text-lg"
                    }`}
                >
                    {title}
                </h3>
                {post.description && (
                    <p
                        className={`mt-2 text-slate-600 dark:text-slate-400 line-clamp-2 ${
                            isHero ? "text-base sm:text-lg" : "text-sm"
                        }`}
                    >
                        {post.description}
                    </p>
                )}
            </div>
        </Card>
    );
}
