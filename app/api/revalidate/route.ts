import { revalidateTag } from "next/cache";
import { after, type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
    warmBlogCache,
    warmProfileCache,
    warmProjectCache,
} from "@/actions/warmCache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { SANITY_SIGNATURE_HEADER, isSignedBySanity } from "@/lib/request-auth";

// Secret shared between Sanity webhook and this API route, trimmed as
// @sanity/webhook trims it. One of spaces alone is no secret: an HMAC
// under an empty key is one anybody can make.
const revalidateSecret = process.env.SANITY_REVALIDATE_SECRET?.trim();

/**
 * What the webhook's projection sends: the document's type, which picks
 * the tag, and its slug, which only names the change in the answer (one
 * of another shape is dropped, not refused).
 */
const deliverySchema = z.object({
    _type: z.string().min(1),
    slug: z.object({ current: z.string().optional() }).nullish().catch(null),
});

/**
 * Content Lake is eventually consistent: the warm after the response
 * queries the live API, so wait as next-sanity's `parseBody` did before
 * this route checked the signature itself.
 */
const CONSISTENCY_WAIT_MS = 3000;

/**
 * The Sanity webhook (CLAUDE.md, caching contract). Its answers, so the
 * delivery log tells each case apart: 404 when the secret is unset (or
 * blank) or the signature is missing or wrong (the stealth 404 the cron uses too; the
 * signature is compared whole, in constant time, lib/request-auth.ts),
 * 400 for a signed body that is not a document's type and slug, 200 with
 * `ignored` for a type no page shows (an asset, a system document), and
 * 500 when revalidating fails.
 */
export async function POST(req: NextRequest) {
    try {
        // If no secret is configured (or a blank one), stealthily drop the
        // request
        if (!revalidateSecret) {
            return new NextResponse(null, { status: 404 });
        }

        const raw = await req.text();
        const signature = req.headers.get(SANITY_SIGNATURE_HEADER);
        if (!isSignedBySanity(raw, signature, revalidateSecret)) {
            return new NextResponse(null, { status: 404 });
        }

        let json: unknown;
        try {
            json = JSON.parse(raw);
        } catch {
            json = null;
        }
        const delivery = deliverySchema.safeParse(json);
        if (!delivery.success) {
            return NextResponse.json(
                { revalidated: false, error: "invalid-body" },
                { status: 400 },
            );
        }
        const body = delivery.data;
        const docType = body._type;

        if (["post", "profile", "project"].includes(docType)) {
            await new Promise((resolve) =>
                setTimeout(resolve, CONSISTENCY_WAIT_MS),
            );
        }

        if (docType === "post") {
            const changedSlug = body.slug?.current;
            revalidateTag(CACHE_TAGS.post, "max");

            // Warm after the response: warming scales with post count and
            // would otherwise push the webhook toward Sanity's delivery
            // timeout. after() keeps the function alive post-response.
            after(async () => {
                try {
                    const result = await warmBlogCache();
                    console.log(
                        `[Revalidate] Warmed ${result.pages.warmed.length} pages ` +
                            `(${result.pages.failed.length} failed)`,
                    );
                } catch (err) {
                    console.error("[Revalidate] Cache warming failed:", err);
                }
            });

            return NextResponse.json({
                revalidated: true,
                message: `Revalidated post${changedSlug ? ` (${changedSlug})` : ""}`,
                warming: "scheduled",
                now: Date.now(),
            });
        }

        if (docType === "profile") {
            revalidateTag(CACHE_TAGS.profile, "max");

            // Tag invalidation is stale-while-revalidate. Visiting the core
            // routes starts regeneration without waiting for a real reader.
            after(async () => {
                try {
                    const result = await warmProfileCache();
                    console.log(
                        `[Revalidate] Warmed ${result.pages.warmed.length} profile pages ` +
                            `(${result.pages.failed.length} failed)`,
                    );
                } catch (err) {
                    console.error(
                        "[Revalidate] Profile cache warming failed:",
                        err,
                    );
                }
            });

            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "${CACHE_TAGS.profile}"`,
                warming: "scheduled",
                now: Date.now(),
            });
        }

        if (docType === "project") {
            revalidateTag(CACHE_TAGS.project, "max");

            // Mission pages, the lists that show projects and the posts that
            // link to them (lib/route-tags.ts).
            after(async () => {
                try {
                    const result = await warmProjectCache();
                    console.log(
                        `[Revalidate] Warmed ${result.pages.warmed.length} project pages ` +
                            `(${result.pages.failed.length} failed)`,
                    );
                } catch (err) {
                    console.error(
                        "[Revalidate] Project cache warming failed:",
                        err,
                    );
                }
            });

            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "${CACHE_TAGS.project}"`,
                warming: "scheduled",
                now: Date.now(),
            });
        }

        // A type no page shows: delivered, and nothing to do.
        return NextResponse.json({ revalidated: false, ignored: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Revalidate] Error:", message);
        return NextResponse.json(
            { revalidated: false, error: "revalidate-failed" },
            { status: 500 },
        );
    }
}
