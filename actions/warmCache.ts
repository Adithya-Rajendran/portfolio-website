// Server-only helpers called by the authenticated webhook and publish cron.
// A "use server" directive would expose warming as a public unauthenticated
// endpoint / traffic-amplification lever.

import { getWarmLists } from "@/lib/sanity-client";
import { CACHE_TAGS, type CacheTag } from "@/lib/cache-tags";
import { siteConfig } from "@/lib/config";
import { warmPaths, type WarmTarget } from "@/lib/route-tags";
import { collectTags } from "@/lib/tags";

interface WarmResult {
    pages: { warmed: string[]; failed: string[] };
}

/**
 * Request every cached route that shows content under `tag`
 * (lib/route-tags.ts), so its stale pages regenerate before a reader asks
 * for them. The post and project lists give the slugs and tags of the
 * dynamic routes. They are read uncached (`getWarmLists`), because this runs
 * right after the tag is revalidated and the cached lists would still miss a
 * post or project published a moment ago. Entry points are warmed even when
 * the lists are empty, so listings refresh after the last post or project
 * is removed.
 */
export async function warm(tag: CacheTag): Promise<WarmResult> {
    const { posts, projectSlugs } = await getWarmLists();
    const targets = warmPaths(tag, {
        post: posts.map(({ slug }) => slug),
        tag: collectTags(posts).map(({ tag: name }) => name),
        project: projectSlugs,
    });
    return { pages: await warmUrls(targets) };
}

/** After a post is published, changed or removed, and by the publish cron. */
export function warmBlogCache(): Promise<WarmResult> {
    return warm(CACHE_TAGS.post);
}

/** After the profile changes. */
export function warmProfileCache(): Promise<WarmResult> {
    return warm(CACHE_TAGS.profile);
}

/** After a project is published, changed or removed. */
export function warmProjectCache(): Promise<WarmResult> {
    return warm(CACHE_TAGS.project);
}

async function warmUrls(
    targets: WarmTarget[],
): Promise<{ warmed: string[]; failed: string[] }> {
    const warmed: string[] = [];
    const failed: string[] = [];
    const batchSize = 5;
    for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async ({ path, redirects }) => {
                const url = `${siteConfig.url}${path}`;
                // A redirect route's cached answer is the redirect itself:
                // do not follow it to the file it points at.
                const res = await fetch(url, {
                    headers: { "x-cache-warm": "1" },
                    ...(redirects ? { redirect: "manual" as const } : {}),
                });
                const answered =
                    res.ok ||
                    (redirects && res.status >= 300 && res.status < 400);
                if (!answered) throw new Error(`${res.status}`);
                return url;
            }),
        );
        for (const [index, result] of results.entries()) {
            const url = `${siteConfig.url}${batch[index].path}`;
            if (result.status === "fulfilled") {
                warmed.push(url);
            } else {
                failed.push(url);
            }
        }
    }

    return { warmed, failed };
}
