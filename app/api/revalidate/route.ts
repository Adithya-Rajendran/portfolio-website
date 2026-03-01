import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

// Secret shared between Sanity webhook and this API route
const revalidateSecret = process.env.SANITY_REVALIDATE_SECRET;

export async function POST(req: NextRequest) {
    try {
        // If a secret is configured, verify the request signature
        if (revalidateSecret) {
            const { isValidSignature, body } = await parseBody<{
                _type: string;
                slug?: { current?: string };
            }>(req, revalidateSecret);

            if (!isValidSignature) {
                return NextResponse.json(
                    { message: "Invalid signature", revalidated: false },
                    { status: 401 },
                );
            }

            if (body?._type !== "post") {
                return NextResponse.json({
                    message: `Skipped revalidation — type "${body?._type}" is not "post"`,
                    revalidated: false,
                });
            }

            // Purge all caches tagged with "post"
            revalidateTag("post");

            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "post"${body?.slug?.current ? ` (triggered by: ${body.slug.current})` : ""}`,
                now: Date.now(),
            });
        }

        // Fallback: no secret configured — still require a basic check
        const body = await req.json().catch(() => null);

        if (!body || body._type !== "post") {
            return NextResponse.json({
                message: "Missing body or non-post type",
                revalidated: false,
            });
        }

        revalidateTag("post");

        return NextResponse.json({
            revalidated: true,
            message: `Revalidated tag "post" (no secret configured — consider adding SANITY_REVALIDATE_SECRET)`,
            now: Date.now(),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[Revalidate] Error:", message);
        return NextResponse.json(
            { message, revalidated: false },
            { status: 500 },
        );
    }
}
