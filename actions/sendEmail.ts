// actions/sendEmail.ts
"use server";

import { Resend } from "resend";
import { z } from "zod";
import { headers } from "next/headers";
import { checkBotId } from "botid/server";
import { checkRateLimit } from "@vercel/firewall";
import ContactFormEmail from "@/email/contact-form-email";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import {
    CONTACT_TOPICS,
    DEFAULT_CONTACT_TOPIC,
    contactRoutes,
    contactSubject,
    type ContactFields,
    type ContactFormState,
    type ContactTopic,
} from "@/lib/contact";
import { contactCopy } from "@/lib/copy";
import {
    EMAIL_CHARSET_PATTERN,
    hasValidMxRecords,
} from "@/lib/email-validation";
import { getProfile } from "@/lib/sanity-client";

/**
 * Email config is read lazily inside sendEmail() — module-level throws
 * would crash `next build` (and the whole /portfolio page) in
 * environments where email isn't configured.
 */
function getEmailConfig(): { apiKey: string; toEmail: string } | null {
    const apiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.CONTACT_FORM_TO_EMAIL;
    if (!apiKey || !toEmail?.includes("@")) {
        return null;
    }
    return { apiKey, toEmail };
}

/**
 * What the sender reads, in the form's words (lib/copy.ts): a field
 * problem under its field, anything else under Send as a send that did
 * not go. Plain words, no exclamation mark, nothing about the server.
 */
const { errors, failures } = contactCopy.form;

const emailSchema = z.object({
    senderEmail: z
        .email(errors.emailInvalid)
        .regex(EMAIL_CHARSET_PATTERN, errors.emailInvalid),
    message: z
        .string()
        .min(1, errors.messageMissing)
        .max(MESSAGE_MAX_LENGTH, errors.messageLong(MESSAGE_MAX_LENGTH)),
    // The contact route the sender picked; none chosen is a hello. It only
    // sorts the subject line, so an unknown value is refused, not guessed;
    // a known topic whose route is hidden is sent as a hello (sentTopic).
    topic: z
        .enum(CONTACT_TOPICS, "Choose one of the listed topics.")
        .default(DEFAULT_CONTACT_TOPIC),
});

/**
 * useActionState-compatible wrapper around sendEmail. The contact form
 * (`components/contact/contact-form.tsx`, on /contact) dispatches it, so
 * React 19 wires up pending state and the result; a send that never
 * reaches this function (the network, a new deploy) the form catches
 * itself. Its state type and initial value live in lib/contact.ts: a
 * "use server" module may export only async functions, and anything else
 * it exports reaches the client as a server reference, not as the value.
 */
export async function sendEmailAction(
    _prevState: ContactFormState,
    formData: FormData,
): Promise<ContactFormState> {
    const result = await sendEmail(formData);
    if (result.error !== undefined) {
        return result.field
            ? { status: "invalid", field: result.field, message: result.error }
            : { status: "error", message: result.error };
    }
    return { status: "success" };
}

/** A field the sender can fix, else a send that did not go. */
type Refusal = { error: string; field?: keyof ContactFields };
/** Resend accepted the message. */
type Sent = { error?: undefined; data: { id: string }; topic: ContactTopic };

function fieldOf(
    path: readonly PropertyKey[],
): keyof ContactFields | undefined {
    const [field] = path;
    return field === "senderEmail" || field === "message" ? field : undefined;
}

/**
 * The topic a message is sent under: the one picked, while the page shows
 * its route. A crafted POST can name any topic in CONTACT_TOPICS, so one
 * whose route is hidden (Consulting while it is off, Research without an
 * invitation) goes out as a hello. The profile read is the pages' own
 * cached one; if it fails, the message still goes, as a hello.
 */
async function sentTopic(topic: ContactTopic): Promise<ContactTopic> {
    if (topic === DEFAULT_CONTACT_TOPIC) return topic;
    try {
        const shown = contactRoutes(await getProfile()).map(
            (route) => route.topic,
        );
        return shown.includes(topic) ? topic : DEFAULT_CONTACT_TOPIC;
    } catch (error: unknown) {
        console.error(
            "[sendEmail] Could not read the profile to check the topic:",
            error,
        );
        return DEFAULT_CONTACT_TOPIC;
    }
}

export const sendEmail = async (
    formData: FormData,
): Promise<Refusal | Sent> => {
    const config = getEmailConfig();
    if (!config) {
        console.error(
            "[sendEmail] RESEND_API_KEY and/or CONTACT_FORM_TO_EMAIL is not configured.",
        );
        return { error: failures.unsent };
    }

    // Vercel BotID — invisible CAPTCHA. The client SDK in app/layout.tsx
    // protects every POST (Server Actions post to the page that runs them:
    // /contact and /portfolio); this verifies the challenge response on
    // the server before doing any expensive work.
    const { isBot } = await checkBotId();
    if (isBot) {
        return { error: failures.unverified };
    }

    // FormData.get() can return File | string | null; coerce to string so
    // a file upload field with the same name can't bypass the zod schema.
    // No topic chosen (the radios are optional) is left undefined, so the
    // schema's default applies.
    const rawTopic = formData.get("topic");
    const rawData = {
        senderEmail: String(formData.get("senderEmail") ?? ""),
        message: String(formData.get("message") ?? ""),
        topic:
            rawTopic === null || rawTopic === "" ? undefined : String(rawTopic),
    };

    const validatedData = emailSchema.safeParse(rawData);

    if (!validatedData.success) {
        const [issue] = validatedData.error.issues;
        const field = fieldOf(issue.path);
        return { error: issue.message, ...(field ? { field } : {}) };
    }

    const { senderEmail, message } = validatedData.data;

    // Vercel WAF rate limit. The rule with ID "contact-form" must be
    // configured in the Vercel dashboard (Firewall → Rate Limit) — the
    // SDK only invokes the rule, it doesn't define it. Available on Pro
    // and Enterprise plans; on Hobby the SDK returns `error: 'not-found'`
    // with `rateLimited: false`, so the form still works but is
    // unprotected at this layer.
    const headersList = await headers();
    const { rateLimited, error: rateLimitError } = await checkRateLimit(
        "contact-form",
        { headers: headersList },
    );
    if (rateLimitError === "not-found") {
        console.warn(
            '[sendEmail] WAF rule "contact-form" not configured in Vercel dashboard — rate limiting is disabled.',
        );
    }
    if (rateLimited) {
        return { error: failures.tooMany };
    }

    const validDomain = await hasValidMxRecords(senderEmail);
    if (!validDomain) {
        return { error: errors.emailDomain, field: "senderEmail" };
    }

    const topic = await sentTopic(validatedData.data.topic);

    try {
        // Instantiated lazily so importing this module never requires the
        // API key to be present.
        const resend = new Resend(config.apiKey);

        // React Email renders {message} / {senderEmail} as text nodes, which
        // React already HTML-escapes. Passing pre-escaped values double-encoded
        // them, so the recipient saw literal "&lt;" instead of "<".
        const { data, error } = await resend.emails.send({
            from: "Contact Form <contact-form@email.adithya-rajendran.com>",
            to: config.toEmail,
            subject: contactSubject(topic),
            replyTo: senderEmail,
            react: ContactFormEmail({ message, senderEmail, topic }),
        });

        // Resend reports a refused send (an unverified domain, the quota,
        // a revoked key) as a returned error, not a throw. Anything but an
        // accepted message must not read as "Message sent".
        if (error || !data) {
            console.error("[sendEmail] Resend refused the message:", error);
            return { error: failures.unsent };
        }

        return { data, topic };
    } catch (error: unknown) {
        // Log the real error server-side for debugging; return a generic
        // message so we don't leak Resend internals (rate-limit details,
        // API tokens in stack traces, etc.) to the client.
        console.error("[sendEmail] Resend error:", error);
        return { error: failures.unsent };
    }
};
