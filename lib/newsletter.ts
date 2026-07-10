import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { siteConfig } from "@/lib/config";
import { EMAIL_CHARSET_PATTERN } from "@/lib/email-validation";
import NewsletterConfirmEmail from "@/email/newsletter-confirm-email";

/**
 * Provider boundary for the newsletter. Every Resend Audiences call and
 * the double-opt-in token scheme live here so swapping providers later
 * touches exactly this file (plus env vars).
 *
 * Double opt-in is stateless: the signup action emails a confirmation
 * link carrying an HMAC-signed token; only when the recipient follows it
 * does the confirm route add the address to the audience. Unconfirmed
 * addresses are never stored anywhere.
 */

/** How long a confirmation link stays valid. */
export const CONFIRM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Config is read lazily (mirrors getEmailConfig in actions/sendEmail.ts) —
 * module-level throws would crash `next build` where newsletter env isn't
 * configured, including CI's Sanity-fallback build.
 */
export function getNewsletterConfig(): {
    apiKey: string;
    audienceId: string;
    confirmSecret: string;
} | null {
    const apiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    const confirmSecret = process.env.NEWSLETTER_CONFIRM_SECRET;
    if (!apiKey || !audienceId || !confirmSecret) {
        return null;
    }
    return { apiKey, audienceId, confirmSecret };
}

/**
 * The site URL confirmation links point at. Production links must use the
 * canonical domain, but preview deployments need links that come back to
 * the preview itself (the canonical domain doesn't run preview code).
 */
export function getConfirmBaseUrl(): string {
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
        const previewHost = process.env.VERCEL_URL;
        if (previewHost) return `https://${previewHost}`;
    }
    if (process.env.NODE_ENV === "development") {
        return `http://localhost:${process.env.PORT ?? 3000}`;
    }
    return siteConfig.url;
}

function hmac(payload: string, secret: string): Buffer {
    return createHmac("sha256", secret).update(payload).digest();
}

/**
 * Token = base64url("email|expiryEpochMs") + "." + base64url(HMAC-SHA256).
 * The email charset allowlist (no "|") makes the payload unambiguous.
 * `now` is injectable so expiry is unit-testable without clock mocks.
 */
export function createConfirmToken(
    email: string,
    secret: string,
    now: number = Date.now(),
): string {
    if (!EMAIL_CHARSET_PATTERN.test(email)) {
        throw new Error("createConfirmToken: email failed charset validation");
    }
    const payload = `${email}|${now + CONFIRM_TOKEN_TTL_MS}`;
    const signature = hmac(payload, secret);
    return `${Buffer.from(payload).toString("base64url")}.${signature.toString("base64url")}`;
}

/** Returns the confirmed email, or null for any invalid/expired token. */
export function verifyConfirmToken(
    token: string,
    secret: string,
    now: number = Date.now(),
): { email: string } | null {
    const [payloadPart, signaturePart, ...rest] = token.split(".");
    if (!payloadPart || !signaturePart || rest.length > 0) return null;

    let payload: string;
    let providedSignature: Buffer;
    try {
        payload = Buffer.from(payloadPart, "base64url").toString("utf8");
        providedSignature = Buffer.from(signaturePart, "base64url");
    } catch {
        return null;
    }

    const expectedSignature = hmac(payload, secret);
    if (
        providedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(providedSignature, expectedSignature)
    ) {
        return null;
    }

    const separatorIndex = payload.lastIndexOf("|");
    if (separatorIndex === -1) return null;
    const email = payload.slice(0, separatorIndex);
    const expiry = Number(payload.slice(separatorIndex + 1));

    if (!Number.isFinite(expiry) || expiry < now) return null;
    if (!email.includes("@") || !EMAIL_CHARSET_PATTERN.test(email)) {
        return null;
    }

    return { email };
}

/**
 * Send the double-opt-in confirmation email. Counts against the Resend
 * transactional quota, not the audience.
 */
export async function sendConfirmEmail(
    email: string,
    token: string,
): Promise<{ ok: boolean }> {
    const config = getNewsletterConfig();
    if (!config) return { ok: false };

    const confirmUrl = `${getConfirmBaseUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;

    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
        from: "Adithya Rajendran <newsletter@email.adithya-rajendran.com>",
        to: email,
        subject: "Confirm your subscription",
        react: NewsletterConfirmEmail({ confirmUrl }),
    });

    if (error) {
        console.error("[newsletter] Failed to send confirmation:", error);
        return { ok: false };
    }
    return { ok: true };
}

/**
 * Add a confirmed address to the audience. "Already exists" counts as
 * success so confirmation links are idempotent and repeat clicks don't
 * become a subscription-status oracle.
 */
export async function addContact(email: string): Promise<{ ok: boolean }> {
    const config = getNewsletterConfig();
    if (!config) return { ok: false };

    try {
        const resend = new Resend(config.apiKey);
        const { error } = await resend.contacts.create({
            audienceId: config.audienceId,
            email,
            unsubscribed: false,
        });

        // Resend has no dedicated error code for duplicate contacts, so
        // match the message — but only the exact phrase: a loose pattern
        // like /exists/ would also match "audience does not exist" and
        // silently drop a confirmed subscriber.
        if (error && !/already exists/i.test(error.message)) {
            console.error("[newsletter] Failed to add contact:", error);
            return { ok: false };
        }
        return { ok: true };
    } catch (error) {
        console.error("[newsletter] Failed to add contact:", error);
        return { ok: false };
    }
}
