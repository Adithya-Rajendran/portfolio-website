import type { NextRequest } from "next/server";
import { connection, NextResponse } from "next/server";
import { getProfile } from "@/lib/sanity-client";
import { resolveResumeAssetUrl } from "@/lib/resume";

/**
 * The CV's PDF to read in the browser: a redirect to the profile's current
 * file, or back to /resume when there is none.
 *
 * The redirect is computed per request from the cached profile
 * (`getProfile`, tagged `profile`), so it refreshes with the profile tag.
 * `connection()` keeps the build from prerendering it: a handler that reads
 * only cached data is prerendered, and its redirect stayed the build's until
 * the next deploy. It answers no HTML, so no page becomes request-bound.
 */
export async function GET(request: NextRequest) {
    await connection();
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
