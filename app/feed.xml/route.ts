import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getWritingDescription } from "@/lib/profile-content";
import { getProfile, getRecentPostsWithBody } from "@/lib/sanity-client";
import { renderFeedXml } from "@/lib/feed";

/**
 * RSS stays full-content and cacheable; the post tag is the same compact
 * taxonomy used by the Sanity revalidation webhook.
 */
async function getFeedXml(): Promise<string> {
    "use cache";
    cacheLife("max");
    cacheTag(CACHE_TAGS.post, CACHE_TAGS.profile);
    const [posts, profile] = await Promise.all([
        getRecentPostsWithBody(),
        getProfile(),
    ]);
    return renderFeedXml(posts, getWritingDescription(profile));
}

export async function GET() {
    const xml = await getFeedXml();
    return new Response(xml, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
        },
    });
}
