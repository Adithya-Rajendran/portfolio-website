import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { parseBody } from "next-sanity/webhook";

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

        const portfolioTypes = ["experience", "project", "certification", "skillCategory", "about", "intro"];
        const docType = body?._type;

        if (docType === "post") {
            revalidateTag("post", "hours");
            return NextResponse.json({
                revalidated: true,
                message: `Revalidated tag "post"${body?.slug?.current ? ` (triggered by: ${body.slug.current})` : ""}`,
                now: Date.now(),
            });
        }

        if (docType && portfolioTypes.includes(docType)) {
            revalidateTag("portfolio", "days");
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
