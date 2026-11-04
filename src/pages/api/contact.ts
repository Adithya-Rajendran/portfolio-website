import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import {
    CONTACT_TOPICS,
    DEFAULT_CONTACT_TOPIC,
    EMAIL_PATTERN,
    contactRoutes,
    contactSubject,
} from "../../../lib/contact";
import {
    EMAIL_MAX_LENGTH,
    MESSAGE_MAX_LENGTH,
} from "../../../lib/contact-constants";
import { asciiAddress, mayReceiveMail } from "../../lib/mail-dns";
import { getProfile } from "../../lib/sanity";
const schema = z.object({
    senderEmail: z
        .string()
        .trim()
        .min(1)
        .max(EMAIL_MAX_LENGTH)
        .regex(EMAIL_PATTERN),
    message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
    topic: z.enum(CONTACT_TOPICS).default(DEFAULT_CONTACT_TOPIC),
});
const reply = (status: number, message: string) =>
    new Response(
        `<!doctype html><html lang="en"><meta charset="utf-8"><title>Contact</title><main><h1>Contact</h1><p>${message}</p><p><a href="/contact">Return to contact</a></p></main></html>`,
        {
            status,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
export const POST: APIRoute = async ({ request, url }) => {
    const config = env as unknown as Record<string, any>;
    if (request.headers.get("origin") !== url.origin)
        return reply(403, "The request could not be verified.");
    if (
        !/^application\/x-www-form-urlencoded(?:;|$)/i.test(
            request.headers.get("content-type") || "",
        )
    )
        return reply(415, "The request could not be read.");
    const reader = request.body?.getReader();
    if (!reader) return reply(400, "The request could not be read.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) {
            await reader.cancel();
            return reply(413, "The request is too large.");
        }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    const form = new URLSearchParams(new TextDecoder().decode(bytes));
    const input = schema.safeParse({
        senderEmail: form.get("senderEmail"),
        message: form.get("message"),
        topic: form.get("topic") || undefined,
    });
    if (!input.success)
        return reply(400, "Check your email and message and try again.");
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip || !config.CONTACT_RATE_LIMIT)
        return reply(
            503,
            "The message could not be sent. Please try again later.",
        );
    try {
        if (!(await config.CONTACT_RATE_LIMIT.limit({ key: ip })).success)
            return reply(429, "Too many requests. Please try again later.");
    } catch {
        return reply(
            503,
            "The message could not be sent. Please try again later.",
        );
    }
    const token = form.get("cf-turnstile-response");
    const hosts = (config.TURNSTILE_HOSTNAMES || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    if (
        !token ||
        token.length > 2048 ||
        !config.TURNSTILE_SECRET ||
        !hosts.length
    )
        return reply(403, "Verification failed. Please try again.");
    try {
        const result = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                body: new URLSearchParams({
                    secret: config.TURNSTILE_SECRET,
                    response: token,
                    remoteip: ip,
                }),
                signal: AbortSignal.timeout(10000),
            },
        );
        if (!result.ok) throw new Error();
        const verification = (await result.json()) as {
            success: boolean;
            hostname: string;
            action: string;
        };
        if (
            !verification.success ||
            verification.action !== "contact" ||
            !hosts.includes(verification.hostname)
        )
            return reply(403, "Verification failed. Please try again.");
    } catch {
        return reply(403, "Verification failed. Please try again.");
    }
    const sender = asciiAddress(input.data.senderEmail);
    if (!sender || !(await mayReceiveMail(sender)))
        return reply(400, "Check your email address and try again.");
    if (
        !config.RESEND_API_KEY ||
        !config.CONTACT_FORM_TO_EMAIL ||
        !config.CONTACT_FROM_EMAIL
    )
        return reply(
            503,
            "The message could not be sent. Please try again later.",
        );
    let topic = input.data.topic;
    try {
        if (!contactRoutes(await getProfile()).some((r) => r.topic === topic))
            topic = DEFAULT_CONTACT_TOPIC;
    } catch {
        topic = DEFAULT_CONTACT_TOPIC;
    }
    try {
        const result = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: config.CONTACT_FROM_EMAIL,
                to: [config.CONTACT_FORM_TO_EMAIL],
                reply_to: sender,
                subject: contactSubject(topic),
                text: `From: ${sender}\nTopic: ${topic}\n\n${input.data.message}`,
            }),
            signal: AbortSignal.timeout(10000),
        });
        if (!result.ok)
            return reply(
                502,
                "The message could not be sent. Please try again later.",
            );
        const accepted = (await result.json()) as { id?: unknown };
        if (typeof accepted.id !== "string" || !accepted.id)
            return reply(
                502,
                "The message could not be sent. Please try again later.",
            );
    } catch {
        return reply(
            502,
            "The message could not be sent. Please try again later.",
        );
    }
    return new Response(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>Message sent</title><main><h1>Message sent</h1><p>Thank you for getting in touch.</p><a href="/">Return home</a></main><script>sessionStorage.removeItem("contact:senderEmail");sessionStorage.removeItem("contact:message");</script></html>',
        {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
};
