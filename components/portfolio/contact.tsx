"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowUpRight, Send } from "lucide-react";
import CareerSectionHeading from "@/components/portfolio/section-heading";
import { useSectionInView } from "@/lib/hooks";
import {
    sendEmailAction,
    INITIAL_CONTACT_FORM_STATE,
} from "@/actions/sendEmail";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { siteConfig } from "@/lib/config";

function ContactSubmit() {
    const { pending } = useFormStatus();
    return (
        <button
            className="journal-button"
            type="submit"
            disabled={pending}
            aria-busy={pending}
        >
            {pending ? "Sending…" : "Send message"}
            <Send size={16} aria-hidden />
        </button>
    );
}

export default function Contact() {
    const { ref } = useSectionInView("Contact");
    const [state, formAction] = useActionState(
        sendEmailAction,
        INITIAL_CONTACT_FORM_STATE,
    );
    const hasError = state.status === "error";
    return (
        <section
            id="contact"
            ref={ref}
            className="career-section career-contact"
        >
            <CareerSectionHeading
                title="Let’s talk."
                description="An idea, a question, or an opportunity. I’d like to hear from you."
            />
            <div>
                <form action={formAction} className="career-contact-form">
                    <div>
                        <label htmlFor="contact-sender-email">Your email</label>
                        <input
                            id="contact-sender-email"
                            name="senderEmail"
                            type="email"
                            autoComplete="email"
                            required
                            maxLength={500}
                            placeholder="you@example.com"
                            aria-describedby={
                                hasError ? "contact-error" : undefined
                            }
                            defaultValue={
                                hasError ? state.values.senderEmail : undefined
                            }
                        />
                    </div>
                    <div>
                        <label htmlFor="contact-message">Message</label>
                        <textarea
                            id="contact-message"
                            name="message"
                            rows={6}
                            placeholder="What’s on your mind?"
                            required
                            maxLength={MESSAGE_MAX_LENGTH}
                            aria-describedby={
                                hasError ? "contact-error" : undefined
                            }
                            defaultValue={
                                hasError ? state.values.message : undefined
                            }
                        />
                    </div>
                    {hasError && (
                        <p
                            id="contact-error"
                            role="alert"
                            className="career-form-error"
                        >
                            {state.message}
                        </p>
                    )}
                    {state.status === "success" && (
                        <p role="status" className="career-form-success">
                            Message sent. Thanks for getting in touch.
                        </p>
                    )}
                    <ContactSubmit />
                </form>
                <div className="career-contact-channels">
                    <span>Or find me elsewhere</span>
                    <a
                        href={siteConfig.profiles.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        LinkedIn
                        <ArrowUpRight size={14} aria-hidden />
                    </a>
                    <a
                        href={siteConfig.profiles.github}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        GitHub
                        <ArrowUpRight size={14} aria-hidden />
                    </a>
                    <a href="/feed.xml">
                        RSS
                        <ArrowUpRight size={14} aria-hidden />
                    </a>
                </div>
            </div>
        </section>
    );
}
