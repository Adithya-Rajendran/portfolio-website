import { getAllSlugsWithDates } from "@/lib/sanity-client";
import { cacheLife, cacheTag } from "next/cache";
import { MetadataRoute } from "next";

const BASE_URL = "https://adithya-rajendran.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    "use cache";
    cacheLife("max");
    cacheTag("post");
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
