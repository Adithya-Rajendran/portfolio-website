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
import { collectTags, linkedTags } from "@/lib/tags";

const BASE_URL = siteConfig.url;

/**
 * `days`, not `max`: a post whose publishedAt arrives must reach the sitemap
 * within a day even if the publish cron is missing (the tags only fire on
 * webhook or cron). The same rule applies to every derived artifact.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    "use cache";
    cacheLife("days");
    cacheTag(CACHE_TAGS.profile, CACHE_TAGS.post, CACHE_TAGS.project);
    const [profile, postData, posts, projectData] = await Promise.all([
        getProfile(),
        getAllSlugsWithDates(),
        getAllPosts(),
        getAllProjectSlugsWithDates(),
    ]);
    // Only the tag pages the site links to: a tag with one entry is not
    // shown anywhere (lib/tags.ts `linkedTags`), though its page answers.
    const tags = linkedTags(collectTags(posts));

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
    const homepageDate =
        newestDate([{ updatedAt: profile?._updatedAt ?? "" }, ...postData]) ??
        buildDate;

    const staticPages: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: homepageDate,
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
            url: `${BASE_URL}/resume`,
            lastModified: profileDate,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/contact`,
            lastModified: profileDate,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/blog`,
            lastModified: newestPostDate,
            changeFrequency: "weekly",
            priority: 0.8,
        },
        {
            url: `${BASE_URL}/blog/archive`,
            lastModified: newestPostDate,
            changeFrequency: "weekly",
            priority: 0.5,
        },
    ];

    const blogPages: MetadataRoute.Sitemap = (postData || []).map((post) => ({
        url: `${BASE_URL}/blog/${post.slug}`,
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
        url: `${BASE_URL}/blog/tags/${tag}`,
        lastModified: newestPostDate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
    }));

    return [...staticPages, ...blogPages, ...projectPages, ...tagPages];
}
