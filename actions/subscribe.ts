// actions/subscribe.ts
"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { checkBotId } from "botid/server";
import { checkRateLimit } from "@vercel/firewall";
import {
    EMAIL_CHARSET_PATTERN,
    hasValidMxRecords,
} from "@/lib/email-validation";
import {
    createConfirmToken,
    getNewsletterConfig,
    sendConfirmEmail,
} from "@/lib/newsletter";

const subscribeSchema = z.object({
    email: z
        .email("Please enter a valid email address.")
        .max(254, "Email address is too long.")
        .regex(EMAIL_CHARSET_PATTERN, "Email contains invalid characters"),
});

export type NewsletterFormState =
    | { status: "idle" }
    | { status: "success" }
    | {
          status: "error";
          message: string;
          /** Echo of the submitted email so the form can repopulate —
           *  React 19 resets uncontrolled inputs after the action runs. */
          values: { email: string };
      };

export const INITIAL_NEWSLETTER_FORM_STATE: NewsletterFormState = {
    status: "idle",
};

/**
 * useActionState-compatible wrapper around subscribe, mirroring
 * sendEmailAction in actions/sendEmail.ts.
 */
export async function subscribeAction(
    _prevState: NewsletterFormState,
    formData: FormData,
): Promise<NewsletterFormState> {
    const result = await subscribe(formData);
    if (result.error) {
        return {
            status: "error",
            message: result.error,
            values: {
                email: String(formData.get("email") ?? ""),
            },
        };
    }
    return { status: "success" };
}

/**
 * Newsletter signup with double opt-in. Same hardening pipeline as the
 * contact form (actions/sendEmail.ts): BotID → zod → WAF rate limit →
 * MX check → Resend. On success the address is emailed a signed
 * confirmation link; nothing is stored until it's clicked.
 */
export const subscribe = async (
    formData: FormData,
): Promise<{ error: string } | { error?: undefined; data: true }> => {
    const config = getNewsletterConfig();
    if (!config) {
        console.error(
            "[subscribe] RESEND_API_KEY, RESEND_AUDIENCE_ID and/or NEWSLETTER_CONFIRM_SECRET is not configured.",
        );
        return {
            error: "The newsletter is not configured on this server. Please try again later.",
        };
    }

    // Vercel BotID — invisible CAPTCHA. The client SDK in app/layout.tsx
    // protects POST on every page (the footer form is sitewide); this
    // verifies the challenge response before doing any expensive work.
    const { isBot } = await checkBotId();
    if (isBot) {
        return {
            error: "Verification failed. Please refresh the page and try again.",
        };
    }

    // FormData.get() can return File | string | null; coerce to string so
    // a file upload field with the same name can't bypass the zod schema.
    const rawData = {
        email: String(formData.get("email") ?? ""),
    };

    const validatedData = subscribeSchema.safeParse(rawData);

    if (!validatedData.success) {
        return { error: validatedData.error.issues[0].message };
    }

    const { email } = validatedData.data;

    // Vercel WAF rate limit — rule "newsletter-subscribe" must exist in
    // the Vercel dashboard (Firewall → Rate Limit); the SDK only invokes
    // it. On plans without the rule the SDK returns error: 'not-found'
    // and signups proceed unprotected at this layer.
    const headersList = await headers();
    const { rateLimited, error: rateLimitError } = await checkRateLimit(
        "newsletter-subscribe",
        { headers: headersList },
    );
    if (rateLimitError === "not-found") {
        console.warn(
            '[subscribe] WAF rule "newsletter-subscribe" not configured in Vercel dashboard — rate limiting is disabled.',
        );
    }
    if (rateLimited) {
        return {
            error: "Too many signup attempts right now. Please try again later.",
        };
    }

    const validDomain = await hasValidMxRecords(email);
    if (!validDomain) {
        return {
            error: "The email domain does not appear to exist. Please check your email address.",
        };
    }

    try {
        const token = createConfirmToken(email, config.confirmSecret);
        const { ok } = await sendConfirmEmail(email, token);
        if (!ok) {
            return {
                error: "Failed to send the confirmation email. Please try again later.",
            };
        }
        // Same response whether or not the address was already subscribed —
        // signup must not be a membership oracle.
        return { data: true };
    } catch (error: unknown) {
        // Log the real error server-side; return a generic message so we
        // don't leak Resend internals or the signing secret's existence.
        console.error("[subscribe] Newsletter signup error:", error);
        return {
            error: "Failed to process the signup. Please try again later.",
        };
    }
};
