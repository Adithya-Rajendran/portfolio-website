import type { APIRoute } from "astro";
import {
    getAllPosts,
    getAllProjectSlugsWithDates,
    getAllSlugsWithDates,
    getProfile,
} from "../lib/sanity";
import { renderSitemapXml, sitemapEntries } from "../../lib/sitemap";
import { collectTags, linkedTags } from "../../lib/tags";
export const GET: APIRoute = async () => {
    const [profile, posts, listed, projects] = await Promise.all([
        getProfile(),
        getAllSlugsWithDates(),
        getAllPosts(),
        getAllProjectSlugsWithDates(),
    ]);
    return new Response(
        renderSitemapXml(
            sitemapEntries({
                profileUpdatedAt: profile?._updatedAt,
                posts,
                projects,
                tags: linkedTags(collectTags(listed)).map(({ tag }) => tag),
            }),
        ),
        {
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
};
