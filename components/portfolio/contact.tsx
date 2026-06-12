"use client";

import { useActionState, useEffect } from "react";
import SectionHeader from "@/components/section-header";
import { useSectionReveal } from "@/lib/hooks";
import {
    sendEmailAction,
    INITIAL_CONTACT_FORM_STATE,
} from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { useToast } from "@/components/ui/use-toast";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { cn } from "@/lib/utils";

export default function Contact() {
    const { ref, inView } = useSectionReveal("Contact");
    const [state, formAction] = useActionState(
        sendEmailAction,
        INITIAL_CONTACT_FORM_STATE,
    );
    const { toast } = useToast();

    useEffect(() => {
        if (state.status === "success") {
            toast({ description: "Email sent successfully!" });
        }
        // Errors render as a persistent inline alert below the form —
        // a toast would auto-dismiss the only record of what went wrong.
    }, [state, toast]);

    const hasError = state.status === "error";

    const inputClasses =
        "w-full h-12 px-4 rounded-row bg-white/70 text-slate-900 border border-slate-200/70 placeholder:text-slate-500 focus:border-accent focus:ring-2 ring-accent transition outline-none backdrop-blur-md dark:bg-white/[0.04] dark:text-slate-100 dark:border-white/10 dark:placeholder:text-slate-400";

    return (
        <section
            id="contact"
            ref={ref}
            className={cn(
                "scroll-mt-28 motion-safe:transition-opacity motion-safe:duration-1000",
                !inView && "motion-safe:opacity-0",
            )}
        >
            <SectionHeader
                eyebrow="Contact"
                title="Let's talk"
                description="Whether it's a project, an opportunity, or just to say hi."
                align="center"
            />

            <div className="os-card mx-auto max-w-xl p-6 sm:p-8">
                <form action={formAction} className="flex flex-col gap-3">
                    <label htmlFor="contact-sender-email" className="sr-only">
                        Your email address
                    </label>
                    <input
                        id="contact-sender-email"
                        className={inputClasses}
                        name="senderEmail"
                        type="email"
                        required
                        maxLength={500}
                        placeholder="you@example.com"
                        aria-invalid={hasError || undefined}
                        aria-describedby={
                            hasError ? "contact-error" : undefined
                        }
                        defaultValue={
                            hasError ? state.values.senderEmail : undefined
                        }
                    />
                    <label htmlFor="contact-message" className="sr-only">
                        Your message
                    </label>
                    <textarea
                        id="contact-message"
                        className={cn(inputClasses, "h-44 py-3 resize-none")}
                        name="message"
                        placeholder="What's on your mind?"
                        required
                        maxLength={MESSAGE_MAX_LENGTH}
                        aria-invalid={hasError || undefined}
                        aria-describedby={
                            hasError ? "contact-error" : undefined
                        }
                        defaultValue={
                            hasError ? state.values.message : undefined
                        }
                    />
                    {hasError && (
                        <p
                            id="contact-error"
                            role="alert"
                            className="text-sm text-rose-700 dark:text-rose-300"
                        >
                            {state.message}
                        </p>
                    )}
                    <div className="mt-2 flex justify-center">
                        <SubmitBtn />
                    </div>
                </form>
            </div>
        </section>
    );
}
