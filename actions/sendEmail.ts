// actions/sendEmail.ts
"use server";

import { Resend } from "resend";
import { z } from "zod";
import dns from "dns/promises";
import { headers } from "next/headers";
import { checkBotId } from "botid/server";
import { checkRateLimit } from "@vercel/firewall";
import ContactFormEmail from "@/email/contact-form-email";

if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
}
if (!process.env.CONTACT_FORM_TO_EMAIL?.includes("@")) {
    throw new Error("CONTACT_FORM_TO_EMAIL is not configured");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const contactFormToEmail = process.env.CONTACT_FORM_TO_EMAIL;

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
    // Vercel BotID — invisible CAPTCHA. The client SDK in app/layout.tsx
    // protects /portfolio POST; this verifies the challenge response on
    // the server before doing any expensive work.
    const { isBot } = await checkBotId();
    if (isBot) {
        return {
            error: "Verification failed. Please refresh the page and try again.",
        };
    }

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

    // Vercel WAF rate limit. The rule with ID "contact-form" must be
    // configured in the Vercel dashboard (Firewall → Rate Limit). The
    // SDK extracts the client IP from x-forwarded-for via the request
    // headers and counts against the rule's bucket.
    const headersList = await headers();
    const synthRequest = new Request("http://localhost", {
        headers: headersList,
    });
    const { rateLimited } = await checkRateLimit("contact-form", {
        request: synthRequest,
    });
    if (rateLimited) {
        return {
            error: "You have exceeded the maximum number of emails at this given time. Please try again later.",
        };
    }

    const validDomain = await hasValidMxRecords(senderEmail);
    if (!validDomain) {
        return {
            error: "The email domain does not appear to exist. Please check your email address.",
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
