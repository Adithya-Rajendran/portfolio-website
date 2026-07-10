import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TerminalSection from "@/components/terminal/terminal-section";
import { PageShell } from "@/components/page-shell";
import Latest from "@/components/blogs/latest";
import TagChips from "@/components/blogs/tag-chips";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags, filterPostsByTag, TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";

function TagPageSkeleton() {
    return (
        <div className="pb-24 sm:pb-32 animate-pulse">
            <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-2 sm:pt-6">
                <Skeleton className="h-4 w-72 mb-10" />
                <Skeleton className="h-10 w-56 mb-5" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="mx-auto max-w-6xl px-6 sm:px-8 mt-14 sm:mt-16">
                <div className="flex flex-wrap gap-4 mb-12">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-5 w-24" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Data section — fetches posts, filters by tag, and 404s when the tag
 * has no matches. Lives inside <Suspense> per cacheComponents (data
 * access can't happen in the static shell), so the hero and rows both
 * render from this one fetch.
 */
async function TagPosts({ tag }: { tag: string }) {
    const allPosts = await getAllPosts();
    const posts = filterPostsByTag(allPosts, tag);
    if (posts.length === 0) notFound();

    const allTags = collectTags(allPosts);

    return (
        <>
            <TerminalSection
                command={`grep -ri "${tag}" posts/`}
                path="~/blogs"
                storageId={`blogs-tag-${tag}`}
                className="w-full max-w-6xl mx-auto px-6 sm:px-8 pt-2 sm:pt-6"
                promptClassName="mb-8"
            >
                <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                    {tag}
                </h1>
                <p className="mt-4 font-term text-sm text-slate-500 dark:text-slate-400">
                    # {posts.length} post{posts.length === 1 ? "" : "s"} tagged{" "}
                    {tag}
                </p>
            </TerminalSection>

            <PageShell className="mt-14 sm:mt-16 pb-24 sm:pb-32">
                <TagChips tags={allTags} active={tag} />

                <Latest
                    posts={posts}
                    eyebrow="Posts"
                    title={`Tagged "${tag}"`}
                />

                <div>
                    <Link
                        href="/blogs"
                        aria-label="Back to all posts"
                        className="font-term text-sm text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        [ cd ~/blogs ]
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
