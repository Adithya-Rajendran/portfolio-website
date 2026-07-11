"use client";

import { useActionState } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { Rss } from "lucide-react";
import SectionHeading from "@/components/portfolio/section-heading";
import { useSectionInView } from "@/lib/hooks";
import {
    sendEmailAction,
    INITIAL_CONTACT_FORM_STATE,
} from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { siteConfig } from "@/lib/config";

// Keep this client component detached from lib/feed's server-only Portable
// Text rendering dependencies.
const FEED_PATH = "/feed.xml";

const channelLinkClasses =
    "flex items-center gap-2.5 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]";

export default function Contact() {
    const { ref } = useSectionInView("Contact");
    const [state, formAction] = useActionState(
        sendEmailAction,
        INITIAL_CONTACT_FORM_STATE,
    );
    const hasError = state.status === "error";

    return (
        <section id="contact" ref={ref} className="scroll-mt-32">
            <SectionHeading
                title="Contact"
                description="Say hello. A question, an opportunity, or a simple note all reach the same inbox."
            />

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
                {/* Deliberately opaque — never glass under a form. */}
                <div className="rounded-card border border-slate-200/80 bg-white/80 p-6 dark:border-white/10 dark:bg-[#0b0d10] sm:p-8">
                    <form action={formAction} className="space-y-5">
                        <div>
                            <label
                                htmlFor="contact-sender-email"
                                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                            >
                                Your email
                            </label>
                            <input
                                id="contact-sender-email"
                                className="min-h-12 w-full rounded-row border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-accent dark:border-white/12 dark:bg-white/[0.035] dark:text-white dark:placeholder:text-slate-500"
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
                                    hasError
                                        ? state.values.senderEmail
                                        : undefined
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="contact-message"
                                className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                            >
                                Message
                            </label>
                            <textarea
                                id="contact-message"
                                className="min-h-44 w-full resize-y rounded-row border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-accent dark:border-white/12 dark:bg-white/[0.035] dark:text-white dark:placeholder:text-slate-500"
                                name="message"
                                rows={7}
                                placeholder="What's on your mind?"
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
                                className="mt-3 text-sm text-rose-700 dark:text-rose-300"
                            >
                                {state.message}
                            </p>
                        )}

                        {state.status === "success" && (
                            <p
                                role="status"
                                className="mt-3 text-sm text-emerald-700 dark:text-emerald-300"
                            >
                                Message sent. Thanks for getting in touch.
                            </p>
                        )}

                        <SubmitBtn />
                    </form>
                </div>

                <aside>
                    <h3 className="mb-3 font-display text-lg font-semibold text-slate-900 dark:text-white">
                        Elsewhere
                    </h3>
                    <ul>
                        <li className="border-t border-b border-slate-400/25 dark:border-white/10">
                            <a
                                href={siteConfig.profiles.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="LinkedIn profile"
                                className={channelLinkClasses}
                            >
                                <FaLinkedin aria-hidden className="w-4 h-4" />
                                LinkedIn
                                <span aria-hidden className="ml-auto">
                                    ↗
                                </span>
                            </a>
                        </li>
                        <li className="border-b border-slate-400/25 dark:border-white/10">
                            <a
                                href={siteConfig.profiles.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="GitHub profile"
                                className={channelLinkClasses}
                            >
                                <FaGithub aria-hidden className="w-4 h-4" />
                                GitHub
                                <span aria-hidden className="ml-auto">
                                    ↗
                                </span>
                            </a>
                        </li>
                        <li className="border-b border-slate-400/25 dark:border-white/10">
                            <a
                                href={FEED_PATH}
                                aria-label="RSS feed"
                                className={channelLinkClasses}
                            >
                                <Rss aria-hidden className="w-4 h-4" />
                                RSS
                                <span aria-hidden className="ml-auto">
                                    ↗
                                </span>
                            </a>
                        </li>
                    </ul>
                    <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        I usually reply within a day or two.
                    </p>
                </aside>
            </div>
        </section>
    );
}
