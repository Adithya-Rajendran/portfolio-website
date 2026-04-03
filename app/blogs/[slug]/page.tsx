import { Suspense } from "react";
import { getPostBySlug, getPostMeta } from "@/lib/sanity-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import BlogPostBody, { BlogPostHero } from "@/components/blogs/blog-post-content";

/** Skeleton shown while the hero metadata loads (very brief) */
function HeroSkeleton() {
    return (
        <header className="relative py-12 sm:py-16 lg:py-20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 dark:via-transparent" />
            <div className="absolute inset-0 bg-grid-pattern opacity-50" />
            <div className="relative max-w-3xl mx-auto px-6 sm:px-8 animate-pulse">
                <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="h-4 w-32 bg-white/[0.06] rounded" />
                </div>
                <div className="h-10 sm:h-12 w-3/4 bg-white/[0.06] rounded mx-auto mb-6" />
                <div className="h-5 w-2/3 bg-white/[0.04] rounded mx-auto" />
            </div>
        </header>
    );
}

/** Skeleton for the article body while shiki highlighting runs */
function BodySkeleton() {
    return (
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-24 animate-pulse space-y-6">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                    {i % 3 === 0 && (
                        <div className="h-6 w-48 bg-white/[0.06] rounded" />
                    )}
                    <div className="h-4 w-full bg-white/[0.04] rounded" />
                    <div className="h-4 w-5/6 bg-white/[0.04] rounded" />
                    <div className="h-4 w-4/6 bg-white/[0.04] rounded" />
                </div>
            ))}
        </div>
    );
}

/**
 * Async hero — fetches lightweight metadata only (title, date, description).
 * This is a tiny Sanity payload with no body array, so it resolves very fast.
 */
async function HeroWithData({ slug }: { slug: string }) {
    const meta = await getPostMeta(slug);
    if (!meta) return notFound();
    return <BlogPostHero post={meta as any} />;
}

/**
 * Async body — fetches the full post (including body) and runs shiki
 * highlighting. This is the expensive part that streams in after the hero.
 */
async function BodyWithData({ slug }: { slug: string }) {
    const post = await getPostBySlug(slug);
    if (!post?.body) return null;
    return <BlogPostBody post={post as any} />;
}

/**
 * Blog post page — synchronous shell that prerenders instantly via PPR.
 * The hero and body each have their own Suspense boundary with independent
 * async data fetching, so the title streams in first (fast meta query)
 * and the body follows (full post + shiki highlighting).
 */
export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    return (
        <article className="w-full">
            {/* Hero streams in first — lightweight meta query */}
            <Suspense fallback={<HeroSkeleton />}>
                <HeroWithData slug={slug} />
            </Suspense>

            {/* Body streams in after shiki highlighting completes */}
            <Suspense fallback={<BodySkeleton />}>
                <BodyWithData slug={slug} />
            </Suspense>
        </article>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
    const { slug } = await params;
    const post = await getPostMeta(slug);
    if (!post) {
        return;
    }
    return {
        title: post.title,
        description: post.description,
        alternates: {
            canonical: `${siteConfig.url}/blogs/${slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            type: "article",
            publishedTime: post.date,
            authors: [siteConfig.author],
            url: `${siteConfig.url}/blogs/${slug}`,
            images: [
                {
                    url: "/og-image.jpg",
                    width: 1200,
                    height: 630,
                    alt: post.title,
                },
            ],
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
