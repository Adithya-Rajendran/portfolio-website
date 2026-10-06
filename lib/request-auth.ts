import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * The API routes' checks of a caller's secret (the cron's bearer, the
 * Sanity webhook's signature), each in constant time: a comparison that
 * stopped at the first differing byte would let a caller time its way to
 * the secret.
 */

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Whether `given` is `expected`. Both are hashed first, so the buffers
 * `timingSafeEqual` compares are the same length and the time taken says
 * nothing about where they differ, or about the secret's length.
 */
export function sameSecret(given: string, expected: string): boolean {
    return timingSafeEqual(digest(given), digest(expected));
}

/** The header Sanity signs a webhook delivery in (@sanity/webhook). */
export const SANITY_SIGNATURE_HEADER = "sanity-webhook-signature";

const SIGNATURE = /^t=(\d+)[, ]+v1=([^, ]+)$/;

/**
 * Sanity's signature for a delivery: `t=<ms>,v1=<sig>`, where `sig` is the
 * unpadded base64url HMAC-SHA256 of `<ms>.<body>` under the shared secret
 * (@sanity/webhook's format).
 */
export function sanitySignature(
    body: string,
    timestamp: number,
    secret: string,
): string {
    const hmac = createHmac("sha256", secret)
        .update(`${timestamp}.${body}`)
        .digest("base64url");
    return `t=${timestamp},v1=${hmac}`;
}

/**
 * Whether a delivery's body is signed with the shared secret, its HMAC
 * compared in constant time (`sameSecret`). A missing or malformed header,
 * or an empty body, is not signed.
 */
export function isSignedBySanity(
    body: string,
    header: string | null,
    secret: string,
): boolean {
    const match = SIGNATURE.exec(header?.trim() ?? "");
    if (!match || !body) return false;
    const expected = sanitySignature(body, Number(match[1]), secret.trim());
    return sameSecret(match[2], SIGNATURE.exec(expected)![2]);
}
