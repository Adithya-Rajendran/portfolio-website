import { siteConfig } from "@/lib/config";
import { lastRevised } from "@/lib/log-index";
import type { PostDates } from "@/lib/sanity-client";

const BASE_URL = siteConfig.url;

export type SitemapEntry = {
    url: string;
    lastModified?: Date;
    changeFrequency: "weekly" | "monthly";
    priority: number;
};

export type SitemapSource = {
    /** The profile's last edit: the identity pages' date. */
    profileUpdatedAt?: string | null;
    posts: readonly PostDates[];
    projects: readonly { slug: string; updatedAt: string }[];
    /** The tags the site links (lib/tags.ts `linkedTags`). */
    tags: readonly string[];
    /** The deploy's date, where no content dates a page. */
    buildDate?: string;
};

function validDate(value?: string | null): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function newest(dates: readonly (Date | undefined)[]): Date | undefined {
    return dates
        .filter((date): date is Date => Boolean(date))
        .sort((left, right) => right.getTime() - left.getTime())[0];
}

/**
 * The sitemap's entries. A post is dated by what it records, its
 * publication, revision and changelog (`lastRevised`), as its page and
 * the feed date it, never by `_updatedAt`, which a migration moves for
 * every post at once; /blog and the tag pages by the newest of those.
 * A project has no editorial date, so its last edit dates it.
 */
export function sitemapEntries({
    profileUpdatedAt,
    posts,
    projects,
    tags,
    buildDate,
}: SitemapSource): SitemapEntry[] {
    const built = validDate(buildDate);
    const postDates = posts.map((post) =>
        validDate(
            lastRevised({
                publishedAt: post.publishedAt,
                revisedAt: post.revisedAt,
                changes: post.changes,
            }),
        ),
    );
    const profileDate = validDate(profileUpdatedAt) ?? built;
    const newestPostDate = newest(postDates) ?? built;
    const newestProjectDate =
        newest(projects.map(({ updatedAt }) => validDate(updatedAt))) ??
        profileDate;
    const homepageDate =
        newest([validDate(profileUpdatedAt), ...postDates]) ?? built;

    return [
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
        ...posts.map((post, index) => ({
            url: `${BASE_URL}/blog/${post.slug}`,
            lastModified: postDates[index],
            changeFrequency: "weekly" as const,
            priority: 0.6,
        })),
        ...projects.map((project) => ({
            url: `${BASE_URL}/portfolio/${project.slug}`,
            lastModified: validDate(project.updatedAt),
            changeFrequency: "monthly" as const,
            priority: 0.6,
        })),
        ...tags.map((tag) => ({
            url: `${BASE_URL}/blog/tags/${tag}`,
            lastModified: newestPostDate,
            changeFrequency: "weekly" as const,
            priority: 0.5,
        })),
    ];
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** The sitemap protocol's XML, as Next.js's metadata route wrote it. */
export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
    const urls = entries.map((entry) =>
        [
            "<url>",
            `<loc>${escapeXml(entry.url)}</loc>`,
            ...(entry.lastModified
                ? [`<lastmod>${entry.lastModified.toISOString()}</lastmod>`]
                : []),
            `<changefreq>${entry.changeFrequency}</changefreq>`,
            `<priority>${entry.priority}</priority>`,
            "</url>",
        ].join("\n"),
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `${url}\n`).join("")}</urlset>
`;
}
