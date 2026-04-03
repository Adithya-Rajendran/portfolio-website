"use server";

import { getAllSlugs, getAllPosts } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";
import { siteConfig } from "@/lib/config";

/**
 * Image size presets that match the sizes used in the blog components.
 * When the warm cache runs, it fetches these exact URLs from the Sanity
 * CDN so that real visitors get cache HITs on the first load.
 */
const IMAGE_PRESETS = [
    { width: 900, height: 500 }, // featured hero
    { width: 700, height: 400 }, // featured sidebar
    { width: 400, height: 240 }, // latest carousel
] as const;

interface WarmResult {
    pages: { warmed: string[]; failed: string[] };
    images: { warmed: number; failed: number };
}

export async function warmBlogCache(): Promise<WarmResult> {
    const [slugs, posts] = await Promise.all([getAllSlugs(), getAllPosts()]);

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

    // Also warm the blog listing page itself
    const urls = [
        `${siteConfig.url}/blogs`,
        ...slugs.map((slug) => `${siteConfig.url}/blogs/${slug}`),
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
        for (const result of results) {
            if (result.status === "fulfilled") {
                warmed.push(result.value);
            } else {
                failed.push(batch[results.indexOf(result)]);
            }
        }
    }

    return { warmed, failed };
}

/** Pre-fetch Sanity CDN image URLs so they're warm for real visitors */
async function warmImages(
    posts: any[],
): Promise<{ warmed: number; failed: number }> {
    if (!posts || posts.length === 0) return { warmed: 0, failed: 0 };

    // Collect all image URLs we need to warm
    const imageUrls: string[] = [];
    for (const post of posts) {
        if (!post.image?.asset) continue;
        for (const preset of IMAGE_PRESETS) {
            try {
                const url = urlForImage(post.image)
                    .width(preset.width)
                    .height(preset.height)
                    .fit("crop")
                    .auto("format")
                    .url();
                imageUrls.push(url);
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
