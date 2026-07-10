// NOT a server action: the only caller is the server-side revalidate
// webhook route. A "use server" directive here would expose warmBlogCache
// as a public unauthenticated endpoint / traffic-amplification lever.

import { getAllPosts, type PostListItem } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";
import {
    getPostImageUrl,
    getPostSlug,
    POST_IMAGE_DIMENSIONS,
} from "@/components/blogs/utils";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Derived from the PostCard variant table so the warmer always fetches
 * the exact URLs the cards request and visitors get CDN cache HITs on
 * first load.
 */
const IMAGE_PRESETS = Object.values(POST_IMAGE_DIMENSIONS);

interface WarmResult {
    pages: { warmed: string[]; failed: string[] };
    images: { warmed: number; failed: number };
}

export async function warmBlogCache(): Promise<WarmResult> {
    // One query: the list projection already carries slug + image.
    const posts = await getAllPosts();
    const slugs = posts.map(getPostSlug).filter(Boolean);

    const pages = await warmPages(slugs);
    const images = await warmImages(posts);

    return { pages, images };
}

/** Warm Vercel edge cache by fetching every blog page + the listing page */
async function warmPages(
    slugs: string[],
): Promise<{ warmed: string[]; failed: string[] }> {
    if (!slugs || slugs.length === 0) return { warmed: [], failed: [] };

    const warmed: string[] = [];
    const failed: string[] = [];

    // Defence-in-depth: only warm slugs that match the safe pattern.
    // Sanity schemas validate slugs, but treating them as URL fragments
    // without checking would let a misconfigured doc trigger fetches against
    // arbitrary site paths.
    const safeSlugs = slugs.filter((slug) => SAFE_SLUG.test(slug));

    // Also warm the blog listing page itself
    const urls = [
        `${siteConfig.url}/blogs`,
        `${siteConfig.url}/feed.xml`,
        ...safeSlugs.map((slug) => `${siteConfig.url}/blogs/${slug}`),
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

/** Pre-fetch Sanity CDN image URLs so they're warm for real visitors.
 *  Note: this warms the Sanity CDN (the optimizer's upstream), not the
 *  Vercel /_next/image cache itself — visitors' exact optimizer URLs
 *  depend on device widths, so upstream warming is the stable layer. */
async function warmImages(
    posts: PostListItem[],
): Promise<{ warmed: number; failed: number }> {
    if (!posts || posts.length === 0) return { warmed: 0, failed: 0 };

    // Collect all image URLs we need to warm — built by the same helper
    // the cards use, so the URLs match by construction.
    const imageUrls: string[] = [];
    for (const post of posts) {
        if (!post.image?.asset) continue;
        for (const preset of IMAGE_PRESETS) {
            try {
                const url = getPostImageUrl(post, preset.width, preset.height);
                if (url) imageUrls.push(url);
            } catch {
                // Skip if image URL generation fails
            }
        }
    }

    if (imageUrls.length === 0) return { warmed: 0, failed: 0 };

    let warmed = 0;
    let failed = 0;

    // HEAD requests are cheaper — we just need to prime the CDN cache
    const batchSize = 10;
    for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map((url) => fetch(url, { method: "HEAD" })),
        );
        for (const result of results) {
            if (result.status === "fulfilled" && result.value.ok) {
                warmed++;
            } else {
                failed++;
            }
        }
    }

    return { warmed, failed };
}
