import { Suspense } from "react";
import { getPostBySlug } from "@/lib/sanity-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import BlogPostBody, { BlogPostHero } from "@/components/blogs/blog-post-content";

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

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostBySlug(slug);
    if (!post) {
        return notFound();
    }

    return (
        <article className="w-full">
            {/* Hero renders immediately — no async deps */}
            <BlogPostHero post={post as any} />

            {/* Body streams in after shiki highlighting completes */}
            <Suspense fallback={<BodySkeleton />}>
                <BlogPostBody post={post as any} />
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
    const post = await getPostBySlug(slug);
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
