import {
    getAllPosts,
    getAllProjectSlugsWithDates,
    getAllSlugsWithDates,
    getProfile,
} from "@/lib/sanity-client";
import { cacheLife, cacheTag } from "next/cache";
import { MetadataRoute } from "next";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { siteConfig } from "@/lib/config";
import { collectTags } from "@/lib/tags";

const BASE_URL = siteConfig.url;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    "use cache";
    cacheLife("max");
    cacheTag(CACHE_TAGS.profile, CACHE_TAGS.post, CACHE_TAGS.project);
    const [profile, postData, posts, projectData] = await Promise.all([
        getProfile(),
        getAllSlugsWithDates(),
        getAllPosts(),
        getAllProjectSlugsWithDates(),
    ]);
    const tags = collectTags(posts);

    const validDate = (value?: string) => {
        if (!value) return undefined;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    };
    const buildDate = validDate(process.env.NEXT_PUBLIC_BUILD_DATE);
    const newestDate = (values: { updatedAt: string }[]) =>
        values
            .map(({ updatedAt }) => validDate(updatedAt))
            .filter((date): date is Date => Boolean(date))
            .sort((left, right) => right.getTime() - left.getTime())[0];
    const profileDate = validDate(profile?._updatedAt) ?? buildDate;
    const newestPostDate = newestDate(postData) ?? buildDate;
    const newestProjectDate = newestDate(projectData) ?? profileDate;

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: profileDate,
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${BASE_URL}/portfolio`,
            lastModified: newestProjectDate,
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${BASE_URL}/about`,
            lastModified: profileDate,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/blogs`,
            lastModified: newestPostDate,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blogs/archive`,
            lastModified: newestPostDate,
            changeFrequency: "weekly",
            priority: 0.5,
        },
    ];

    const blogPages: MetadataRoute.Sitemap = (postData || []).map((post) => ({
        url: `${BASE_URL}/blogs/${post.slug}`,
        lastModified: validDate(post.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    const projectPages: MetadataRoute.Sitemap = (projectData || []).map(
        (project) => ({
            url: `${BASE_URL}/portfolio/${project.slug}`,
            lastModified: validDate(project.updatedAt),
            changeFrequency: "monthly" as const,
            priority: 0.6,
        }),
    );

    const tagPages: MetadataRoute.Sitemap = tags.map(({ tag }) => ({
        url: `${BASE_URL}/blogs/tags/${tag}`,
        lastModified: newestPostDate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
    }));

    return [...staticPages, ...blogPages, ...projectPages, ...tagPages];
}
