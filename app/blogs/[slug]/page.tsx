import { getAllSlugs, getPostBySlug, getPostMeta } from "@/lib/sanity-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteConfig } from "@/lib/config";
import BlogPostBody, {
    BlogPostHero,
} from "@/components/blogs/blog-post-content";
import { BlogPostJsonLd } from "@/components/json-ld";
import NewsletterNotice from "@/components/newsletter/newsletter-notice";

/**
 * Async body — fetches the full post (including body) and runs shiki
 * highlighting.
 */
async function BodyWithData({ slug }: { slug: string }) {
    const post = await getPostBySlug(slug);
    if (!post?.body) return null;
    return <BlogPostBody post={post} />;
}

/**
 * Prerender every published post at build time; unknown slugs still
 * render on demand (dynamicParams default). Cache Components requires
 * at least one param at build time, so when Sanity is unconfigured
 * (CI's fallback sentinel) or has no posts we emit a placeholder slug
 * that prerenders as the 404 page and is linked from nowhere.
 */
export async function generateStaticParams() {
    const slugs = await getAllSlugs();
    if (slugs.length === 0) return [{ slug: "placeholder" }];
    return slugs.map((slug) => ({ slug }));
}

/**
 * Blog post page — awaits the lightweight meta query up front (it gates
 * notFound and JSON-LD anyway), renders the hero directly from it, and
 * awaits the body (full post + shiki highlighting) inline.
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
        <main id="main-content" tabIndex={-1} className="w-full">
            <article>
                <BlogPostJsonLd
                    title={meta.title || ""}
                    description={meta.description || ""}
                    publishedAt={meta.publishedAt || ""}
                    slug={slug}
                    updatedAt={meta._updatedAt}
                    tags={meta.tags ?? undefined}
                    wordCount={meta.wordCount}
                />

                <BlogPostHero post={meta} slug={slug} />

                <BodyWithData slug={slug} />

                {/* Width tracks the prose column. */}
                <div className="mx-auto max-w-[45.5rem] px-6 sm:px-8 pb-20">
                    <NewsletterNotice />
                </div>
            </article>
        </main>
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
        ...(post.tags && post.tags.length > 0 && { keywords: post.tags }),
        alternates: {
            canonical: `${siteConfig.url}/blogs/${slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            type: "article",
            publishedTime: post.publishedAt,
            authors: [siteConfig.author],
            url: `${siteConfig.url}/blogs/${slug}`,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
