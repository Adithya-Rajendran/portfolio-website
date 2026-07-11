import { revalidateTag } from "next/cache";
import { after, connection, type NextRequest, NextResponse } from "next/server";
import { defineQuery } from "next-sanity";
import { warmBlogCache } from "@/actions/warmCache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { client, isSanityConfigured } from "@/lib/sanity-config";

const DUE_POSTS_QUERY = defineQuery(`*[
    _type == "post" &&
    defined(publishedAt) &&
    publishedAt == $today
].slug.current`);

/**
 * Vercel Cron target (vercel.json) — runs daily just after the UTC date
 * flips. Published visibility is date-based (`publishedAt <= $today`), so a
 * future-dated post becomes eligible on its UTC date but stays invisible
 * until something invalidates the cached queries. This route is that
 * something: it looks for posts whose publish date is today and, when
 * found, revalidates the same tags the Sanity webhook would.
 *
 * Auth: Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to cron
 * invocations when the CRON_SECRET env var is set. Anything else gets
 * the same stealth 404 the revalidate webhook uses.
 */
export async function GET(req: NextRequest) {
    // Force request-time evaluation: without this, the env-check below can
    // short-circuit before any request read and the fallback build bakes
    // the route as a static 404 (segment configs like force-dynamic are
    // not available under cacheComponents).
    await connection();

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return new NextResponse(null, { status: 404 });
    }
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        return new NextResponse(null, { status: 404 });
    }
    if (!isSanityConfigured) {
        return new NextResponse(null, { status: 404 });
    }

    try {
        // This deliberately bypasses sanityFetch so the scheduled request
        // can see the new publication date before invalidating the cache.
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const dueSlugs = await client.fetch<string[]>(DUE_POSTS_QUERY, {
            today,
        });
        const slugs = (dueSlugs ?? []).filter(Boolean);

        if (slugs.length === 0) {
            return NextResponse.json({ revalidated: false, due: 0 });
        }

        revalidateTag(CACHE_TAGS.post, "max");

        // Same shape as the revalidate webhook: warm after the response
        // so a slow warm can't fail the cron invocation.
        after(async () => {
            try {
                const result = await warmBlogCache();
                console.log(
                    `[Cron] Published ${slugs.length} due post(s); warmed ` +
                        `${result.pages.warmed.length} pages ` +
                        `(${result.pages.failed.length} failed), ` +
                        `${result.images.warmed} images (${result.images.failed} failed)`,
                );
            } catch (err) {
                console.error("[Cron] Cache warming failed:", err);
            }
        });

        return NextResponse.json({
            revalidated: true,
            due: slugs.length,
            slugs,
            warming: "scheduled",
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Cron] publish-due failed:", message);
        return NextResponse.json(
            { revalidated: false, error: "query-failed" },
            { status: 500 },
        );
    }
}
