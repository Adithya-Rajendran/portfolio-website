import { revalidateTag } from "next/cache";
import { after, type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";
import { warmBlogCache } from "@/actions/warmCache";
import { CACHE_TAGS } from "@/lib/cache-tags";

// Secret shared between Sanity webhook and this API route
const revalidateSecret = process.env.SANITY_REVALIDATE_SECRET;

export async function POST(req: NextRequest) {
    try {
        // If no secret is configured, stealthily drop the request
        if (!revalidateSecret) {
            return new NextResponse(null, { status: 404 });
        }

        const { isValidSignature, body } = await parseBody<{
            _type: string;
            slug?: { current?: string };
        }>(req, revalidateSecret);

        if (!isValidSignature) {
            return new NextResponse(null, { status: 404 });
        }

        const portfolioTypes = [
            "experience",
            "project",
            "certification",
            "skillCategory",
            "about",
            "intro",
        ];
        const docType = body?._type;

        if (docType === "post") {
            const changedSlug = body?.slug?.current;

            // Listing queries (getAllPosts, slug indexes) are tagged
            // "post-list" — always invalidate so the new/edited post
            // appears in the index.
            revalidateTag(CACHE_TAGS.postList, { expire: 0 });

            // Individual post queries are tagged "post:<slug>" — invalidate
            // only the changed slug so other posts keep serving from cache.
            if (changedSlug) {
                revalidateTag(CACHE_TAGS.post(changedSlug), { expire: 0 });
            }

            // Warm after the response: warming scales with post count and
            // would otherwise push the webhook toward Sanity's delivery
            // timeout. after() keeps the function alive post-response.
            after(async () => {
                try {
                    const result = await warmBlogCache();
                    console.log(
                        `[Revalidate] Warmed ${result.pages.warmed.length} pages ` +
                            `(${result.pages.failed.length} failed), ` +
                            `${result.images.warmed} images (${result.images.failed} failed)`,
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

        if (docType && portfolioTypes.includes(docType)) {
            revalidateTag(CACHE_TAGS.portfolio, { expire: 0 });
            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "portfolio" (triggered by: ${docType})`,
                now: Date.now(),
            });
        }

        return new NextResponse(null, { status: 404 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Revalidate] Error:", message);
        return new NextResponse(null, { status: 404 });
    }
}
