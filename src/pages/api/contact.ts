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
// All messages and labels passed to this shell are fixed strings from this module.
const page = (
    title: string,
    message: string,
    href: string,
    label: string,
    clearDraft = false,
    nonce = "",
) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Adithya Rajendran</title><style>@font-face{font-family:Jost;src:url(/fonts/Jost-Regular.ttf)}*{box-sizing:border-box}body{margin:0;background:#101719;color:#f2e9d7;font:1rem/1.6 Jost,system-ui,sans-serif}header,main{width:min(100% - 2.5rem,72rem);margin:auto}header{padding:1.5rem 0;border-bottom:1px solid #59635b}header a{color:inherit;text-decoration:none;font-weight:700}main{padding:clamp(4rem,12vh,8rem) 0}h1{font-size:clamp(3rem,7vw,5rem);line-height:1.05;letter-spacing:-.04em;margin:.4em 0}p{max-width:44ch}a{color:#f0b87c;text-underline-offset:.25em}a:focus-visible{outline:3px solid #f4c487;outline-offset:4px}.eyebrow{color:#b7d2ae;font-size:.8rem;letter-spacing:.12em;text-transform:uppercase}</style></head><body><header><a href="/">Adithya Rajendran</a></header><main><p class="eyebrow">Contact</p><h1>${title}</h1><p>${message}</p><p><a href="${href}">${label} ↗</a></p></main>${clearDraft ? `<script nonce="${nonce}">sessionStorage.removeItem("contact:senderEmail");sessionStorage.removeItem("contact:message");</script>` : ""}</body></html>`;
const reply = (
    status: number,
    message: string,
    headers: Record<string, string> = {},
) =>
    new Response(page("Contact", message, "/contact", "Return to contact"), {
        status,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers,
        },
    });
export const POST: APIRoute = async ({ request, url, locals }) => {
    const config = env as unknown as Record<string, any>;
    if (request.headers.get("origin") !== url.origin)
        return reply(403, "The request could not be verified.");
    if (
        !/^application\/x-www-form-urlencoded(?:;|$)/i.test(
            request.headers.get("content-type") || "",
        )
    )
        return reply(415, "The request could not be read.");
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip || !config.CONTACT_RATE_LIMIT)
        return reply(
            503,
            "The message could not be sent. Please try again later.",
        );
    try {
        if (!(await config.CONTACT_RATE_LIMIT.limit({ key: ip })).success)
            return reply(429, "Too many requests. Please try again later.", {
                "Retry-After": "60",
            });
    } catch {
        return reply(
            503,
            "The message could not be sent. Please try again later.",
        );
    }
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
        page(
            "Message sent",
            "Thank you for getting in touch.",
            "/",
            "Return home",
            true,
            locals?.cspNonce,
        ),
        {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store",
            },
        },
    );
};
