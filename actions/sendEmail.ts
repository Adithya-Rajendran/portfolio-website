// actions/sendEmail.ts
"use server";

import { Resend } from "resend";
import { z } from "zod";
import dns from "dns/promises";
import { getErrorMessage, sanitizeHtml } from "@/lib/utils";
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

function isRateLimited(ip: string): boolean {
    const now = Date.now();
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

async function hasValidMxRecords(email: string): Promise<boolean> {
    const domain = email.split("@")[1];
    if (!domain) return false;

    try {
        const records = await dns.resolveMx(domain);
        return records.length > 0;
    } catch {
        return false;
    }
}

export const sendEmail = async (formData: FormData) => {
    const rawData = {
        senderEmail: formData.get("senderEmail"),
        message: formData.get("message"),
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
        const data = await resend.emails.send({
            from: "Contact Form <contact-form@email.adithya-rajendran.com>",
            to: contactFormToEmail,
            subject: "Contact Form for My Website",
            replyTo: senderEmail,
            react: ContactFormEmail({
                message: sanitizeHtml(message),
                senderEmail: sanitizeHtml(senderEmail),
            }),
        });

        return { data };
    } catch (error: unknown) {
        return {
            error: getErrorMessage(error),
        };
    }
};
