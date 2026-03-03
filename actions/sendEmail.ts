// actions/sendEmail.ts
"use server";

import { Resend } from "resend";
import { z } from "zod";
import { getErrorMessage, sanitizeHtml } from "@/lib/utils";
import ContactFormEmail from "@/email/contact-form-email";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const resend = new Resend(process.env.RESEND_API_KEY);

const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 h"),
});

const emailSchema = z.object({
    senderEmail: z.string()
        .email("Invalid sender email")
        .regex(/^[\w.+@-]+$/, "Email contains invalid characters"),
    message: z.string().min(1, "Message cannot be empty").max(1000),
});

export const sendEmail = async (formData: FormData) => {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1";

    const { success } = await ratelimit.limit(ip);

    if (!success) {
        return { error: "You can only send one email per hour. Please try again later." };
    }

    const rawData = {
        senderEmail: formData.get("senderEmail"),
        message: formData.get("message"),
    };

    const validatedData = emailSchema.safeParse(rawData);

    if (!validatedData.success) {
        return { error: validatedData.error.issues[0].message };
    }

    const { senderEmail, message } = validatedData.data;

    try {
        const data = await resend.emails.send({
            from: "Contact Form <contact-form@email.adithya-rajendran.com>",
            to: process.env.CONTACT_FORM_TO_EMAIL as string,
            subject: "Contact Form for My Website",
            replyTo: sanitizeHtml(senderEmail as string),
            react: ContactFormEmail({
                message: sanitizeHtml(message as string),
                senderEmail: sanitizeHtml(senderEmail as string)
            }),
        });

        return { data };
    } catch (error: unknown) {
        return {
            error: getErrorMessage(error),
        };
    }
};