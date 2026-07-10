import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UnifiedHero from "@/components/unified-hero";
import { PageShell } from "@/components/page-shell";
import Latest from "@/components/blogs/latest";
import TagChips from "@/components/blogs/tag-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags, filterPostsByTag, TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";

function TagPageSkeleton() {
    return (
        <div className="pb-24 sm:pb-32">
            <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:pt-12 sm:pb-20 text-center animate-pulse">
                <Skeleton className="h-3 w-16 rounded mx-auto mb-5" />
                <Skeleton className="h-11 w-56 rounded mx-auto mb-5" />
                <Skeleton className="h-4 w-72 rounded mx-auto" />
            </div>
            <div className="mx-auto max-w-6xl px-6 sm:px-8 animate-pulse">
                <div className="flex flex-wrap gap-2 mb-12">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-9 w-20 rounded-full" />
                    ))}
                </div>
                <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="os-card h-72" />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Data section — fetches posts, filters by tag, and 404s when the tag
 * has no matches. Lives inside <Suspense> per cacheComponents (data
 * access can't happen in the static shell), so the hero and grid both
 * render from this one fetch.
 */
async function TagPosts({ tag }: { tag: string }) {
    const allPosts = await getAllPosts();
    const posts = filterPostsByTag(allPosts, tag);
    if (posts.length === 0) notFound();

    const allTags = collectTags(allPosts);

    return (
        <>
            <UnifiedHero
                eyebrow="Tag"
                title={tag}
                description={`${posts.length} post${posts.length === 1 ? "" : "s"} tagged ${tag}`}
            />

            <PageShell>
                <TagChips tags={allTags} active={tag} />

                <Latest
                    posts={posts}
                    eyebrow="Posts"
                    title={`Tagged "${tag}"`}
                />

                <div>
                    <Link
                        href="/blogs"
                        className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                    >
                        <ArrowLeft aria-hidden className="w-4 h-4" />
                        Back to all posts
                    </Link>
                </div>
            </PageShell>
        </>
    );
}

/**
 * Prerender a page per known tag at build time; unknown tags still render
 * on demand (dynamicParams default). Cache Components requires at least
 * one param at build time, so when there are no posts/tags yet (CI's
 * fallback sentinel, or pre-launch) we emit a placeholder tag that
 * prerenders as the 404 page and is linked from nowhere — mirrors
 * app/blogs/[slug]/page.tsx.
 */
export async function generateStaticParams() {
    const tags = collectTags(await getAllPosts());
    if (tags.length === 0) return [{ tag: "placeholder" }];
    return tags.map(({ tag }) => ({ tag }));
}

/**
 * Tag archive page — validates the route param synchronously (no data
 * access, so it stays outside Suspense) before handing off to the async
 * data section for the actual post lookup.
 */
export default async function TagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    // Next has already percent-decoded the segment once during route
    // matching — decoding again would let double-encoded URLs (e.g.
    // /blogs/tags/kub%2565rnetes) alias the canonical page.
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) notFound();

    return (
        <main id="main-content" tabIndex={-1} className="w-full">
            <Suspense fallback={<TagPageSkeleton />}>
                <TagPosts tag={tag} />
            </Suspense>
        </main>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ tag: string }>;
}): Promise<Metadata | undefined> {
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) {
        return;
    }
    return {
        title: `Posts tagged ${tag}`,
        description: `Browse posts tagged "${tag}" — technical deep-dives into cloud infrastructure, cybersecurity, and homelab experiments.`,
        alternates: {
            canonical: `${siteConfig.url}/blogs/tags/${tag}`,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
