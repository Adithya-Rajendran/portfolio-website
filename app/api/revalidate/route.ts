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

        const docType = body?._type;

        if (docType === "post") {
            const changedSlug = body?.slug?.current;
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
            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "${CACHE_TAGS.profile}"`,
                now: Date.now(),
            });
        }

        if (docType === "project") {
            revalidateTag(CACHE_TAGS.project, "max");
            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "${CACHE_TAGS.project}"`,
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
