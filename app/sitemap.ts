import { getAllSlugsWithDates } from "@/lib/sanity-client";
import { cacheLife, cacheTag } from "next/cache";
import { MetadataRoute } from "next";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { siteConfig } from "@/lib/config";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    "use cache";
    cacheLife("max");
    // postList is the tag the publish webhook actually revalidates — the
    // previous bare "post" tag was orphaned (never invalidated).
    cacheTag(CACHE_TAGS.postList);
    const postData = await getAllSlugsWithDates();

    const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE
        ? new Date(process.env.NEXT_PUBLIC_BUILD_DATE)
        : undefined;

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: buildDate,
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${BASE_URL}/portfolio`,
            lastModified: buildDate,
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blogs`,
            lastModified: buildDate,
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    const blogPages: MetadataRoute.Sitemap = (postData || []).map((post) => ({
        url: `${BASE_URL}/blogs/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    return [...staticPages, ...blogPages];
}
