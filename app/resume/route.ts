import { NextResponse } from "next/server";
import { getIntro } from "@/lib/sanity-client";

export async function GET() {
    const intro = await getIntro();
    const resumeUrl = intro?.resumeUrl;

    // Only redirect to Sanity-hosted PDFs to prevent the CMS field from being
    // weaponized into an open redirect.
    if (resumeUrl?.startsWith("https://cdn.sanity.io/")) {
        // Appending ?dl=<filename> to Sanity CDN URLs triggers a file download
        return NextResponse.redirect(
            `${resumeUrl}?dl=Adithya_Rajendran_Resume.pdf`,
        );
    }

    return new NextResponse("Resume not found", { status: 404 });
}
