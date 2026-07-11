import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/sanity-client";
import { resolveResumeAssetUrl } from "@/lib/resume";

export async function GET(request: NextRequest) {
    const profile = await getProfile();
    const target = resolveResumeAssetUrl(profile?.resumeUrl, "view");

    if (!target) {
        return NextResponse.redirect(new URL("/resume", request.url), {
            status: 303,
            headers: { "Cache-Control": "private, no-store" },
        });
    }

    return NextResponse.redirect(target, {
        status: 307,
        headers: { "Cache-Control": "private, no-store" },
    });
}
