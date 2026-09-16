// Server-only helpers called by the authenticated webhook and publish cron.
// A "use server" directive would expose warming as a public unauthenticated
// endpoint / traffic-amplification lever.

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

/**
 * Profile edits affect identity, editorial copy, links, and résumé metadata.
 * Keep this list bounded: other pages are refreshed when visited through the
 * shared profile tag, without crawling the entire writing archive each edit.
 */
export async function warmProfileCache(): Promise<WarmResult> {
    const paths = [
        "/",
        "/about",
        "/portfolio",
        "/resume",
        "/blog",
        "/blog/archive",
        "/feed.xml",
        "/opengraph-image",
        "/about/opengraph-image",
        "/portfolio/opengraph-image",
        "/blog/opengraph-image",
    ];
    return {
        pages: await warmUrls(paths.map((path) => `${siteConfig.url}${path}`)),
    };
}

/** Warm the writing-led homepage, feed, listings, and every published post. */
async function warmPages(
    slugs: string[],
    tags: string[],
): Promise<{ warmed: string[]; failed: string[] }> {
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

    return warmUrls(urls);
}

async function warmUrls(
    urls: string[],
): Promise<{ warmed: string[]; failed: string[] }> {
    const warmed: string[] = [];
    const failed: string[] = [];
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
