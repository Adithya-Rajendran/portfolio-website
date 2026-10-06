import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
    getAllPosts,
    getAllProjectSlugsWithDates,
    getAllSlugsWithDates,
    getProfile,
} from "@/lib/sanity-client";
import { renderSitemapXml, sitemapEntries } from "@/lib/sitemap";
import { collectTags, linkedTags } from "@/lib/tags";

/**
 * `days`, not `max`: a post whose publishedAt arrives must reach the sitemap
 * within a day even if the publish cron is missing (the tags only fire on
 * webhook or cron). The same rule applies to every derived artifact. A
 * route handler, like the feed's: served from the metadata route
 * (app/sitemap.ts), the host kept the build's copy for days past it.
 */
async function getSitemapXml(): Promise<string> {
    "use cache";
    cacheLife("days");
    cacheTag(CACHE_TAGS.profile, CACHE_TAGS.post, CACHE_TAGS.project);
    const [profile, posts, listed, projects] = await Promise.all([
        getProfile(),
        getAllSlugsWithDates(),
        getAllPosts(),
        getAllProjectSlugsWithDates(),
    ]);
    return renderSitemapXml(
        sitemapEntries({
            profileUpdatedAt: profile?._updatedAt,
            posts,
            projects,
            // Only the tag pages the site links to: a tag with one entry
            // is not shown anywhere (lib/tags.ts `linkedTags`), though its
            // page answers.
            tags: linkedTags(collectTags(listed)).map(({ tag }) => tag),
            buildDate: process.env.NEXT_PUBLIC_BUILD_DATE,
        }),
    );
}

export async function GET() {
    const xml = await getSitemapXml();
    return new Response(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
        },
    });
}
