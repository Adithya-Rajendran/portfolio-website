import { getAllPosts, getAllSlugsWithDates } from "@/lib/sanity-client";
import { cacheLife, cacheTag } from "next/cache";
import { MetadataRoute } from "next";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { siteConfig } from "@/lib/config";
import { collectTags } from "@/lib/tags";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    "use cache";
    cacheLife("max");
    // postList is the tag the publish webhook actually revalidates — the
    // previous bare "post" tag was orphaned (never invalidated).
    cacheTag(CACHE_TAGS.postList);
    const postData = await getAllSlugsWithDates();
    // A second cached query (sanityFetch keys on the query string), but
    // it shares the post-list tag so both entries revalidate together on
    // every post publish. The duplication beats widening the slug
    // projection that every other consumer pays for.
    const tags = collectTags(await getAllPosts());

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
            url: `${BASE_URL}/about`,
            lastModified: buildDate,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/blogs`,
            lastModified: buildDate,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blogs/archive`,
            lastModified: buildDate,
            changeFrequency: "weekly",
            priority: 0.5,
        },
    ];

    const blogPages: MetadataRoute.Sitemap = (postData || []).map((post) => ({
        url: `${BASE_URL}/blogs/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    const tagPages: MetadataRoute.Sitemap = tags.map(({ tag }) => ({
        url: `${BASE_URL}/blogs/tags/${tag}`,
        lastModified: buildDate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
    }));

    return [...staticPages, ...blogPages, ...tagPages];
}
