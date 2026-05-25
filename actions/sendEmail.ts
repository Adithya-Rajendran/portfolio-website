// actions/sendEmail.ts
"use server";

import { Resend } from "resend";
import { z } from "zod";
import dns from "dns/promises";
import ContactFormEmail from "@/email/contact-form-email";
import { headers } from "next/headers";

if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
}
if (!process.env.CONTACT_FORM_TO_EMAIL?.includes("@")) {
    throw new Error("CONTACT_FORM_TO_EMAIL is not configured");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const contactFormToEmail = process.env.CONTACT_FORM_TO_EMAIL;

/**
 * Simple in-memory rate limiter. Survives across requests within a single
 * serverless invocation. On Vercel, each function instance keeps its own
 * map — on cold starts the map resets, but for a portfolio contact form
 * this provides sufficient protection without external dependencies.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Opportunistic eviction: every ~50 lookups, sweep expired entries from
// both rate-limit maps so a single long-lived serverless instance can't
// accumulate unbounded keys.
let lookupsSinceSweep = 0;
function maybeSweep(now: number) {
    if (++lookupsSinceSweep < 50) return;
    lookupsSinceSweep = 0;
    for (const [k, v] of rateLimitMap)
        if (now > v.resetAt) rateLimitMap.delete(k);
    for (const [k, v] of invalidDomainMap)
        if (now > v.resetAt) invalidDomainMap.delete(k);
}

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    maybeSweep(now);
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
}

/** Track invalid domain attempts (also in-memory) */
const invalidDomainMap = new Map<string, { count: number; resetAt: number }>();
const INVALID_DOMAIN_MAX = 5;
const INVALID_DOMAIN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

function trackInvalidDomain(ip: string): boolean {
    const now = Date.now();
    const entry = invalidDomainMap.get(ip);

    if (!entry || now > entry.resetAt) {
        invalidDomainMap.set(ip, {
            count: 1,
            resetAt: now + INVALID_DOMAIN_WINDOW_MS,
        });
        return false;
    }

    entry.count++;
    return entry.count > INVALID_DOMAIN_MAX;
}

function isBlockedForInvalidDomains(ip: string): boolean {
    const now = Date.now();
    const entry = invalidDomainMap.get(ip);
    if (!entry || now > entry.resetAt) return false;
    return entry.count >= INVALID_DOMAIN_MAX;
}

const emailSchema = z.object({
    senderEmail: z
        .email("Invalid sender email")
        .regex(/^[\w.+@-]+$/, "Email contains invalid characters"),
    message: z.string().min(1, "Message cannot be empty").max(1000),
});

// RFC 1035 caps a domain name at 253 characters. Validate length and a
// conservative character set before issuing a DNS query so the resolver
// isn't a free oracle for arbitrary attacker-supplied strings.
const DOMAIN_PATTERN =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

async function hasValidMxRecords(email: string): Promise<boolean> {
    const domain = email.split("@")[1];
    if (!domain || domain.length > 253 || !DOMAIN_PATTERN.test(domain)) {
        return false;
    }

    try {
        const records = await dns.resolveMx(domain);
        return records.length > 0;
    } catch {
        return false;
    }
}

export type ContactFormState =
    | { status: "idle" }
    | { status: "success" }
    | { status: "error"; message: string };

export const INITIAL_CONTACT_FORM_STATE: ContactFormState = { status: "idle" };

/**
 * useActionState-compatible wrapper around sendEmail. The form in
 * `components/portfolio/contact.tsx` uses this as its server action so
 * React 19 wires up pending state and the result without manual glue.
 */
export async function sendEmailAction(
    _prevState: ContactFormState,
    formData: FormData,
): Promise<ContactFormState> {
    const result = await sendEmail(formData);
    if (result.error) {
        return {
            status: "error",
            message:
                typeof result.error === "string"
                    ? result.error
                    : "Error sending the message! Please try again.",
        };
    }
    return { status: "success" };
}

export const sendEmail = async (formData: FormData) => {
    // FormData.get() can return File | string | null; coerce to string so
    // a file upload field with the same name can't bypass the zod schema.
    const rawData = {
        senderEmail: String(formData.get("senderEmail") ?? ""),
        message: String(formData.get("message") ?? ""),
    };

    const validatedData = emailSchema.safeParse(rawData);

    if (!validatedData.success) {
        return { error: validatedData.error.issues[0].message };
    }

    const { senderEmail, message } = validatedData.data;

    const headersList = await headers();
    // Vercel's proxy appends the real client IP to x-forwarded-for, so the
    // last entry is the trusted one. Earlier entries can be spoofed by the
    // client and must not be used for rate-limiting decisions.
    const xff = headersList.get("x-forwarded-for") ?? "";
    const ip = xff.split(",").pop()?.trim() || "127.0.0.1";

    if (isBlockedForInvalidDomains(ip)) {
        return {
            error: "You have been temporarily blocked for submitting too many invalid emails. Please try again later.",
        };
    }

    const validDomain = await hasValidMxRecords(senderEmail);
    if (!validDomain) {
        trackInvalidDomain(ip);
        return {
            error: "The email domain does not appear to exist. Please check your email address.",
        };
    }

    if (isRateLimited(ip)) {
        return {
            error: "You have exceeded the maximum number of emails at this given time. Please try again later.",
        };
    }

    try {
        // React Email renders {message} / {senderEmail} as text nodes, which
        // React already HTML-escapes. Passing pre-escaped values double-encoded
        // them, so the recipient saw literal "&lt;" instead of "<".
        const data = await resend.emails.send({
            from: "Contact Form <contact-form@email.adithya-rajendran.com>",
            to: contactFormToEmail,
            subject: "Contact Form for My Website",
            replyTo: senderEmail,
            react: ContactFormEmail({ message, senderEmail }),
        });

        return { data };
    } catch (error: unknown) {
        // Log the real error server-side for debugging; return a generic
        // message so we don't leak Resend internals (rate-limit details,
        // API tokens in stack traces, etc.) to the client.
        console.error("[sendEmail] Resend error:", error);
        return {
            error: "Failed to send the email. Please try again later.",
        };
    }
};
