import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getRecentPostsWithBody } from "@/lib/sanity-client";
import { renderFeedXml } from "@/lib/feed";

/**
 * RSS feed. The XML is built inside a cached scope tagged post-list
 * (mirrors app/sitemap.ts), so publishing or editing any post through
 * the Sanity webhook refreshes the feed.
 */
async function getFeedXml(): Promise<string> {
    "use cache";
    cacheLife("max");
    cacheTag(CACHE_TAGS.postList);
    const posts = await getRecentPostsWithBody();
    return renderFeedXml(posts);
}

export async function GET() {
    const xml = await getFeedXml();
    return new Response(xml, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
        },
    });
}
