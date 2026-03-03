"use server";

import { Resend } from "resend";
import { z } from "zod";
import { getErrorMessage, sanitizeHtml } from "@/lib/utils";
import ContactFormEmail from "@/email/contact-form-email";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
    senderEmail: z.email("Invalid sender email"),
    message: z.string().min(1, "Message cannot be empty").max(1000),
});

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

    try {
        // Resend natively supports React Email components via the 'react' property
        const data = await resend.emails.send({
            from: "Contact Form <onboarding@resend.dev>", // Note: Update this once you verify your custom domain in Resend
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