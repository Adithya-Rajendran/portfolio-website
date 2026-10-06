import { createHmac } from "node:crypto";
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

    it("decides every header as Sanity's own toolkit does", async () => {
        const now = 1_759_790_000_000;
        const hmac = (t: number | string, key = SECRET) =>
            createHmac("sha256", key)
                .update(`${t}.${body}`)
                .digest("base64url");
        const good = sanitySignature(body, now, SECRET);
        // A timestamp whose HMAC has a "+" or "/" in standard base64, so
        // that form differs from the base64url Sanity writes.
        const std = (t: number) =>
            createHmac("sha256", SECRET)
                .update(`${t}.${body}`)
                .digest("base64")
                .replace(/=+$/, "");
        let stdAt = now;
        while (!/[+/]/.test(std(stdAt))) stdAt += 1;
        /** next-sanity's parseBody, which verifies with @sanity/webhook. */
        const upstream = async (header: string, secret: string) => {
            const req = new NextRequest("https://example.com/api/revalidate", {
                method: "POST",
                headers: { [SANITY_SIGNATURE_HEADER]: header },
                body,
            });
            return (await parseBody(req, secret, false)).isValidSignature;
        };

        for (const [name, header, secret, signed] of [
            ["the header Sanity writes", good, SECRET, true],
            ["the secret with spaces around it", good, ` ${SECRET} `, true],
            // A secret of spaces alone trims to an empty key, whose HMAC
            // anybody can make: @sanity/webhook refuses an empty secret.
            [
                "an empty key's HMAC",
                `t=${now},v1=${hmac(now, "")}`,
                "   ",
                false,
            ],
            [
                "a space for the comma",
                `t=${now} v1=${hmac(now)}`,
                SECRET,
                false,
            ],
            ["a comma and a space", `t=${now}, v1=${hmac(now)}`, SECRET, false],
            ["a leading zero", `t=0${now},v1=${hmac(now)}`, SECRET, false],
            [
                "a timestamp before 2021",
                `t=1000,v1=${hmac(1000)}`,
                SECRET,
                false,
            ],
            [
                "a timestamp past what a number holds",
                `t=123456789012345678901,v1=${hmac(Number("123456789012345678901"))}`,
                SECRET,
                false,
            ],
            ["a padded HMAC", `${good}=`, SECRET, false],
            ["standard base64", `t=${stdAt},v1=${std(stdAt)}`, SECRET, false],
        ] as const) {
            expect(await upstream(header, secret), name).toBe(signed);
            expect(isSignedBySanity(body, header, secret), name).toBe(signed);
        }
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

    it("refuses every header under a secret that is empty once trimmed", () => {
        const now = Date.now();
        for (const secret of ["", "   ", "\n\t"]) {
            expect(
                isSignedBySanity(body, sanitySignature(body, now, ""), secret),
                JSON.stringify(secret),
            ).toBe(false);
        }
    });
});
