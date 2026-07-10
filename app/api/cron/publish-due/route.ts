import { revalidateTag } from "next/cache";
import { after, connection, type NextRequest, NextResponse } from "next/server";
import { warmBlogCache } from "@/actions/warmCache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { client, isSanityConfigured } from "@/lib/sanity-config";

/**
 * Vercel Cron target (vercel.json) — runs daily just after the UTC date
 * flips. Published visibility is gated by `date <= $today`, so a
 * future-dated post becomes eligible at midnight UTC but stays invisible
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
        // Live read, deliberately NOT sanityFetch: the whole point is to
        // see past the data cache. $today is a fresh param value each day,
        // so Sanity's CDN can't serve yesterday's result either.
        const today = new Date().toISOString().split("T")[0];
        const dueSlugs = await client.fetch<string[]>(
            `*[_type == "post" && date == $today].slug.current`,
            { today },
        );
        const slugs = (dueSlugs ?? []).filter(Boolean);

        if (slugs.length === 0) {
            return NextResponse.json({ revalidated: false, due: 0 });
        }

        revalidateTag(CACHE_TAGS.postList, { expire: 0 });
        for (const slug of slugs) {
            revalidateTag(CACHE_TAGS.post(slug), { expire: 0 });
        }

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
