import type { APIRoute } from "astro";
import { getProfile, getRecentPostsWithBody } from "../lib/sanity";
import { getWritingDescription } from "../../lib/profile-content";
import { renderFeedXml } from "../lib/feed";
export const GET: APIRoute = async () => {
    const [posts, profile] = await Promise.all([
        getRecentPostsWithBody(),
        getProfile(),
    ]);
    return new Response(renderFeedXml(posts, getWritingDescription(profile)), {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
};
