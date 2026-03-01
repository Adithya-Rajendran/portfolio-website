"use client";

import React from "react";
import SectionHeading from "../section-heading";
import { motion } from "motion/react";
import { useSectionInView } from "@/lib/hooks";
import { sendEmail } from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { useToast } from "@/components/ui/use-toast";

export default function Contact() {
    const { ref } = useSectionInView("Contact");
    const { toast } = useToast();

    return (
        <motion.section
            id="contact"
            ref={ref}
            className="mb-20 sm:mb-28 w-[min(100%,38rem)] text-center"
            initial={{
                opacity: 0,
            }}
            whileInView={{
                opacity: 1,
            }}
            transition={{
                duration: 1,
            }}
            viewport={{
                once: true,
            }}
        >
            <SectionHeading>Contact me</SectionHeading>

            <p className="text-slate-500 -mt-6 dark:text-slate-400">
                Please contact me directly at{" "}
                <a
                    className="underline text-emerald-700 dark:text-emerald-400"
                    href="mailto:work@adithya-rajendran.com"
                >
                    work@adithya-rajendran.com
                </a>{" "}
                or through this form.
            </p>

            <form
                className="mt-10 flex flex-col dark:text-black"
                action={async (formData) => {
                    const { error } = await sendEmail(formData);

                    if (error) {
                        toast({
                            description:
                                "Error sending the message! Please try again.",
                            variant: "destructive",
                        });
                        return;
                    }

                    toast({ description: "Email sent successfully!" });
                }}
            >
                <input
                    className="h-14 px-4 rounded-lg bg-white border border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 transition-all outline-none dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
                    name="senderEmail"
                    type="email"
                    required
                    maxLength={500}
                    placeholder="Your email"
                />
                <textarea
                    className="h-52 my-3 rounded-lg p-4 bg-white border border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 transition-all outline-none dark:bg-white/5 dark:text-slate-200 dark:border-white/10 dark:focus:border-emerald-500/50 dark:focus:ring-emerald-500/20"
                    name="message"
                    placeholder="Your message"
                    required
                    maxLength={5000}
                />
                <SubmitBtn />
            </form>
        </motion.section>
    );
}
