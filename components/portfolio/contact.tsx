"use client";

import React from "react";
import SectionHeading from "../section-heading";
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

    return (
        <section
            id="contact"
            ref={setRefs}
            className={cn(
                "mb-20 sm:mb-28 w-[min(100%,38rem)] text-center",
                "motion-safe:transition-opacity motion-safe:duration-1000",
                inView ? "opacity-100" : "opacity-0",
            )}
        >
            <SectionHeading>Contact me</SectionHeading>

            <p className="text-slate-500 -mt-6 dark:text-slate-400">
                Please contact me through this form.
            </p>

            <form
                className="mt-10 flex flex-col dark:text-black"
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
                    className="h-14 px-4 rounded-lg bg-white border border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 transition-all outline-none dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
                    name="senderEmail"
                    type="email"
                    required
                    maxLength={500}
                    placeholder="Your email"
                />
                <label htmlFor="contact-message" className="sr-only">
                    Your message
                </label>
                <textarea
                    id="contact-message"
                    className="h-52 my-3 rounded-lg p-4 bg-white border border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 transition-all outline-none dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
                    name="message"
                    placeholder="Your message"
                    required
                    maxLength={5000}
                />
                <SubmitBtn />
            </form>
        </section>
    );
}
