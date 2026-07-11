import { NextResponse } from "next/server";
import { getProfile } from "@/lib/sanity-client";

export async function GET() {
    const profile = await getProfile();
    const resumeUrl = profile?.resumeUrl;

    if (resumeUrl) {
        try {
            const target = new URL(resumeUrl);
            // Keep the CMS field from becoming an open redirect. Sanity's file
            // CDN honors `dl` while retaining any asset query parameters.
            if (
                target.protocol === "https:" &&
                target.hostname === "cdn.sanity.io"
            ) {
                target.searchParams.set("dl", "Adithya_Rajendran_Resume.pdf");
                return NextResponse.redirect(target);
            }
        } catch {
            // A malformed CMS value degrades to the same quiet 404 as no file.
        }
    }

    return new NextResponse("Resume not found", { status: 404 });
}
