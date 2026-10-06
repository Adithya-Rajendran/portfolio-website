import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";
import {
    SANITY_SIGNATURE_HEADER,
    isSignedBySanity,
    sameSecret,
    sanitySignature,
} from "@/lib/request-auth";

const SECRET = "test-webhook-secret";

describe("sameSecret", () => {
    it("matches only the exact secret, whatever the lengths", () => {
        expect(sameSecret("Bearer abc", "Bearer abc")).toBe(true);
        for (const given of ["", "Bearer ab", "Bearer abcd", "bearer abc"]) {
            expect(sameSecret(given, "Bearer abc"), given).toBe(false);
        }
    });
});

describe("the Sanity webhook's signature", () => {
    const body = JSON.stringify({ _type: "post", slug: { current: "a" } });

    it("is the one Sanity's own toolkit accepts", async () => {
        // next-sanity's parseBody verifies with @sanity/webhook: the format
        // this module writes must be the one Sanity signs in.
        const signature = sanitySignature(body, Date.now(), SECRET);
        const req = new NextRequest("https://example.com/api/revalidate", {
            method: "POST",
            headers: { [SANITY_SIGNATURE_HEADER]: signature },
            body,
        });
        const { isValidSignature } = await parseBody(req, SECRET, false);
        expect(isValidSignature).toBe(true);
        expect(isSignedBySanity(body, signature, SECRET)).toBe(true);
    });

    it("refuses another secret, another body, a changed HMAC or no header", () => {
        const now = Date.now();
        const signature = sanitySignature(body, now, SECRET);
        expect(
            isSignedBySanity(body, sanitySignature(body, now, "other"), SECRET),
        ).toBe(false);
        expect(isSignedBySanity(`${body} `, signature, SECRET)).toBe(false);
        expect(isSignedBySanity(body, `${signature}x`, SECRET)).toBe(false);
        expect(isSignedBySanity(body, null, SECRET)).toBe(false);
        expect(isSignedBySanity("", signature, SECRET)).toBe(false);
    });
});
