import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import Latest from "@/components/blogs/latest";
import TagChips from "@/components/blogs/tag-chips";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags, filterPostsByTag, TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";
import TerminalSection from "@/components/terminal/terminal-section";

/**
 * Data section — fetches posts, filters by tag, and 404s when the tag
 * has no matches. The hero and rows both render from this one fetch.
 */
async function TagPosts({ tag }: { tag: string }) {
    const allPosts = await getAllPosts();
    const posts = filterPostsByTag(allPosts, tag);
    if (posts.length === 0) notFound();

    const allTags = collectTags(allPosts);

    return (
        <TerminalSection
            as="div"
            path="~/blog"
            command={`rg -l "#${tag}" .`}
            promptVariant="compact"
            animatePrompt
            promptClassName="route-prompt mx-auto mb-5 w-full max-w-6xl px-6 pt-10 sm:px-8 sm:pt-16"
        >
            <header className="mx-auto w-full max-w-6xl px-6 pt-10 sm:px-8 sm:pt-16">
                <h1 className="font-display text-4xl font-semibold tracking-tight text-balance text-slate-900 dark:text-white sm:text-6xl">
                    {tag}
                </h1>
                <p className="mt-4 font-term text-sm text-slate-600 dark:text-slate-400">
                    {posts.length} post{posts.length === 1 ? "" : "s"} tagged{" "}
                    <span className="text-accent"># {tag}</span>
                </p>
            </header>

            <PageShell className="mt-14 sm:mt-16 pb-24 sm:pb-32">
                <TagChips tags={allTags} active={tag} />

                <Latest
                    posts={posts}
                    eyebrow="Posts"
                    title={`Tagged "${tag}"`}
                />

                <div>
                    <Link
                        href="/blog"
                        aria-label="Back to the blog"
                        className="text-sm text-slate-600 transition-colors hover:text-accent dark:text-slate-400"
                    >
                        ← Back to the blog
                    </Link>
                </div>
            </PageShell>
        </TerminalSection>
    );
}

/**
 * Prerender a page per known tag at build time; unknown tags still render
 * on demand (dynamicParams default). Cache Components requires at least
 * one param at build time, so when there are no posts/tags yet (CI's
 * fallback sentinel, or pre-launch) we emit a placeholder tag that
 * prerenders as the 404 page and is linked from nowhere — mirrors
 * app/blog/[slug]/page.tsx.
 */
export async function generateStaticParams() {
    const tags = collectTags(await getAllPosts());
    if (tags.length === 0) return [{ tag: "placeholder" }];
    return tags.map(({ tag }) => ({ tag }));
}

/**
 * Tag archive page — validates the route param before handing off to the
 * async data section for the actual post lookup.
 */
export default async function TagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    // Next has already percent-decoded the segment once during route
    // matching — decoding again would let double-encoded URLs (e.g.
    // /blog/tags/kub%2565rnetes) alias the canonical page.
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) notFound();

    return (
        <main id="main-content" tabIndex={-1} className="w-full">
            <TagPosts tag={tag} />
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
        description: `Browse Adithya Rajendran's posts tagged "${tag}".`,
        alternates: {
            canonical: `${siteConfig.url}/blog/tags/${tag}`,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
