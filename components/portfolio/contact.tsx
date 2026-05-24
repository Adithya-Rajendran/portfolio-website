"use client";

import React from "react";
import SectionHeader from "@/components/section-header";
import { useSectionInView } from "@/lib/hooks";
import { useInView } from "react-intersection-observer";
import { sendEmail } from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export default function Contact() {
    const { ref: sectionRef } = useSectionInView("Contact");
    const { ref: visibilityRef, inView } = useInView({
        threshold: 0.15,
        triggerOnce: true,
    });
    const setRefs = React.useCallback(
        (node: HTMLElement | null) => {
            sectionRef(node);
            visibilityRef(node);
        },
        [sectionRef, visibilityRef],
    );
    const { toast } = useToast();

    const inputClasses =
        "w-full h-12 px-4 rounded-xl bg-white/70 text-slate-900 border border-slate-200/70 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition outline-none backdrop-blur-md dark:bg-white/[0.04] dark:text-slate-100 dark:border-white/10 dark:placeholder:text-slate-500 dark:focus:border-indigo-400/60";

    return (
        <section
            id="contact"
            ref={setRefs}
            className={cn(
                "scroll-mt-28 transition-opacity duration-1000",
                inView ? "opacity-100" : "opacity-0",
            )}
        >
            <SectionHeader
                eyebrow="Contact"
                title="Let's talk"
                description="Whether it's a project, an opportunity, or just to say hi."
                align="center"
            />

            <div className="glass mx-auto max-w-xl rounded-2xl p-6 sm:p-8">
                <form
                    className="flex flex-col gap-3"
                    action={async (formData) => {
                        const { error } = await sendEmail(formData);

                        if (error) {
                            toast({
                                description:
                                    typeof error === "string"
                                        ? error
                                        : "Error sending the message! Please try again.",
                                variant: "destructive",
                            });
                            return;
                        }

                        toast({ description: "Email sent successfully!" });
                    }}
                >
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
                        maxLength={5000}
                    />
                    <div className="mt-2 flex justify-center">
                        <SubmitBtn />
                    </div>
                </form>
            </div>
        </section>
    );
}
