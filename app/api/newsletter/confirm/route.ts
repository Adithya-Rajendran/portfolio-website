import { NextRequest, NextResponse } from "next/server";
import {
    addContact,
    getConfirmBaseUrl,
    getNewsletterConfig,
    verifyConfirmToken,
} from "@/lib/newsletter";

/**
 * Double-opt-in confirmation endpoint. The signup action emails a link
 * to this route; a valid HMAC token is the only thing that adds an
 * address to the audience. GET-with-side-effect is the standard
 * newsletter pattern — a scanner "clicking" merely completes a
 * subscription the recipient explicitly requested.
 */
export async function GET(request: NextRequest) {
    // Redirect using the same env-derived origin the emailed link was
    // minted from (prod domain / preview URL / localhost) — never the
    // request's Host header, which the client controls.
    const baseUrl = getConfirmBaseUrl();
    const confirmedUrl = new URL("/newsletter/confirmed", baseUrl);
    const invalidUrl = new URL("/newsletter/invalid", baseUrl);

    const config = getNewsletterConfig();
    const token = request.nextUrl.searchParams.get("token");
    if (!config || !token) {
        return NextResponse.redirect(invalidUrl);
    }

    const verified = verifyConfirmToken(token, config.confirmSecret);
    if (!verified) {
        return NextResponse.redirect(invalidUrl);
    }

    const { ok } = await addContact(verified.email);
    return NextResponse.redirect(ok ? confirmedUrl : invalidUrl);
}
