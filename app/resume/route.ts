import { NextResponse } from "next/server";
import { getIntro } from "@/lib/sanity-client";

export async function GET() {
    const intro = await getIntro();
    const resumeUrl = (intro as any)?.resumeUrl;

    if (resumeUrl) {
        // Appending ?dl=<filename> to Sanity CDN URLs triggers a file download
        return NextResponse.redirect(`${resumeUrl}?dl=Adithya_Rajendran_Resume.pdf`);
    }

    return new NextResponse("Resume not found", { status: 404 });
}
