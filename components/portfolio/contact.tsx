"use client";

import { useActionState, useEffect } from "react";
import TerminalSection from "@/components/terminal/terminal-section";
import { useSectionInView } from "@/lib/hooks";
import {
    sendEmailAction,
    INITIAL_CONTACT_FORM_STATE,
} from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { useToast } from "@/components/ui/use-toast";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { inputClasses } from "@/components/ui/input-classes";
import { cn } from "@/lib/utils";

export default function Contact() {
    const { ref } = useSectionInView("Contact");
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

    return (
        <section id="contact" ref={ref} className="scroll-mt-28">
            <TerminalSection
                as="div"
                command="mail adithya"
                path="~/portfolio"
                label="Contact"
                promptClassName="mb-8"
            >
                <p className="max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-400 text-pretty">
                    Whether it&apos;s a project, an opportunity, or just to say
                    hi — it lands in my inbox.
                </p>

                {/* Deliberately opaque — never glass under a form. */}
                <div className="mt-8 max-w-xl rounded-card border border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#0b0d10] p-6 sm:p-8">
                    <form action={formAction} className="flex flex-col gap-3">
                        <label
                            htmlFor="contact-sender-email"
                            className="font-term text-xs text-slate-500 dark:text-slate-400"
                        >
                            from:
                        </label>
                        <input
                            id="contact-sender-email"
                            className={cn(inputClasses, "h-12")}
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
                        <label
                            htmlFor="contact-message"
                            className="mt-1 font-term text-xs text-slate-500 dark:text-slate-400"
                        >
                            message:
                        </label>
                        <textarea
                            id="contact-message"
                            className={cn(
                                inputClasses,
                                "h-44 py-3 resize-none",
                            )}
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
                        <div className="mt-2 flex justify-start">
                            <SubmitBtn />
                        </div>
                    </form>
                </div>
            </TerminalSection>
        </section>
    );
}
