import { getSlugs } from "@/components/blogs/markdown-posts";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const slugs = await getSlugs();
    const baseUrls: MetadataRoute.Sitemap = [
        {
            url: "https://adithya-rajendran.com",
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: "https://adithya-rajendran.com/blogs",
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    let slugsUrls: MetadataRoute.Sitemap = [];
    if (slugs) {
        slugsUrls = slugs.map((slug) => ({
            url: `https://adithya-rajendran.com/blogs/${slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.5,
        }));
    }
    return [...baseUrls, ...slugsUrls];
}
