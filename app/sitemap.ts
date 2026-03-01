import { getAllSlugs } from "@/lib/sanity-client";
import { MetadataRoute } from "next";

const BASE_URL = "https://adithya-rajendran.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const slugs = await getAllSlugs();

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${BASE_URL}/portfolio`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/blogs`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    const blogPages: MetadataRoute.Sitemap = (slugs || []).map((slug) => ({
        url: `${BASE_URL}/blogs/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    return [...staticPages, ...blogPages];
}
