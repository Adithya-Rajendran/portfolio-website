import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Latest from "@/components/blogs/latest";
import TagChips from "@/components/blogs/tag-chips";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags, filterPostsByTag, TAG_PATTERN } from "@/lib/tags";
import { siteConfig } from "@/lib/config";

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
        <div className="journal-page journal-container journal-writing">
            <header className="journal-writing-intro">
                <p className="journal-eyebrow">Follow a thread</p>
                <h1 className="journal-title">{tag}</h1>
                <p className="journal-description">
                    {posts.length} {posts.length === 1 ? "note" : "notes"} on{" "}
                    {tag}.
                </p>
            </header>
            <TagChips tags={allTags} active={tag} />
            <Latest posts={posts} title="From the notebook" />
            <Link href="/blog" className="journal-link">
                ← All writing
            </Link>
        </div>
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
