// NOT a server action: the only caller is the server-side revalidate
// webhook route. A "use server" directive here would expose warmBlogCache
// as a public unauthenticated endpoint / traffic-amplification lever.

import { getAllPosts } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";
import { getPostSlug } from "@/components/blogs/utils";
import { collectTags } from "@/lib/tags";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

interface WarmResult {
    pages: { warmed: string[]; failed: string[] };
}

export async function warmBlogCache(): Promise<WarmResult> {
    // One query: the list projection carries the slugs and tags needed for
    // every public blog route.
    const posts = await getAllPosts();
    const slugs = posts.map(getPostSlug).filter(Boolean);
    // collectTags already TAG_PATTERN-filters, so every tag here is
    // URL-safe by construction — no extra SAFE_SLUG-style gate needed.
    const tags = collectTags(posts).map(({ tag }) => tag);

    const pages = await warmPages(slugs, tags);

    return { pages };
}

/** Warm the writing-led homepage, feed, listings, and every published post. */
async function warmPages(
    slugs: string[],
    tags: string[],
): Promise<{ warmed: string[]; failed: string[] }> {
    const warmed: string[] = [];
    const failed: string[] = [];

    // Defence-in-depth: only warm slugs that match the safe pattern.
    // Sanity schemas validate slugs, but treating them as URL fragments
    // without checking would let a misconfigured doc trigger fetches against
    // arbitrary site paths.
    const safeSlugs = slugs.filter((slug) => SAFE_SLUG.test(slug));

    // Always warm the entry points, including after the last post is removed.
    const urls = [
        `${siteConfig.url}/`,
        `${siteConfig.url}/blog`,
        `${siteConfig.url}/blog/archive`,
        `${siteConfig.url}/feed.xml`,
        ...tags.map((tag) => `${siteConfig.url}/blog/tags/${tag}`),
        ...safeSlugs.map((slug) => `${siteConfig.url}/blog/${slug}`),
    ];

    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async (url) => {
                const res = await fetch(url, {
                    headers: { "x-cache-warm": "1" },
                });
                if (!res.ok) throw new Error(`${res.status}`);
                return url;
            }),
        );
        for (const [index, result] of results.entries()) {
            if (result.status === "fulfilled") {
                warmed.push(result.value);
            } else {
                failed.push(batch[index]);
            }
        }
    }

    return { warmed, failed };
}
