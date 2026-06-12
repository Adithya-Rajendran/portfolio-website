import { Suspense } from "react";
import { getPostBySlug, getPostMeta } from "@/lib/sanity-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import BlogPostBody, {
    BlogPostHero,
} from "@/components/blogs/blog-post-content";
import { BlogPostJsonLd } from "@/components/json-ld";
import { urlForImage } from "@/lib/sanity-image";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the article body while shiki highlighting runs */
function BodySkeleton() {
    return (
        <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-24 space-y-6">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                    {i % 3 === 0 && <Skeleton className="h-6 w-48 rounded" />}
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-5/6 rounded" />
                    <Skeleton className="h-4 w-4/6 rounded" />
                </div>
            ))}
        </div>
    );
}

/**
 * Async body — fetches the full post (including body) and runs shiki
 * highlighting. This is the expensive part that streams in after the hero.
 */
async function BodyWithData({ slug }: { slug: string }) {
    const post = await getPostBySlug(slug);
    if (!post?.body) return null;
    return <BlogPostBody post={post} />;
}

/**
 * Blog post page — awaits the lightweight meta query up front (it gates
 * notFound and JSON-LD anyway), renders the hero directly from it, and
 * streams the body (full post + shiki highlighting) behind Suspense.
 */
export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    // Fetch meta synchronously at the page level so JSON-LD is in the SSR
    // payload; the hero renders from the same result.
    const meta = await getPostMeta(slug);
    if (!meta) notFound();

    return (
        <article className="w-full">
            <BlogPostJsonLd
                title={meta.title || ""}
                description={meta.description || ""}
                date={meta.date || ""}
                slug={slug}
            />

            <BlogPostHero post={meta} />

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
    const sanityOgImage = post.image
        ? urlForImage(post.image)
              .width(1200)
              .height(630)
              .fit("crop")
              .auto("format")
              .url()
        : null;
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
            // When the post has a featured image in Sanity, use it directly.
            // Otherwise omit images here so Next.js falls back to the
            // file-convention opengraph-image.tsx which renders the title
            // into a branded OG via next/og.
            ...(sanityOgImage && {
                images: [
                    {
                        url: sanityOgImage,
                        width: 1200,
                        height: 630,
                        alt: post.title,
                    },
                ],
            }),
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
