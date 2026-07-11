"use client";

import { useActionState, useEffect } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { Rss } from "lucide-react";
import TerminalSection from "@/components/terminal/terminal-section";
import { useSectionInView } from "@/lib/hooks";
import {
    sendEmailAction,
    INITIAL_CONTACT_FORM_STATE,
} from "@/actions/sendEmail";
import SubmitBtn from "../submit-btn";
import { useToast } from "@/components/ui/use-toast";
import { MESSAGE_MAX_LENGTH } from "@/lib/contact-constants";
import { siteConfig } from "@/lib/config";
import { FEED_PATH } from "@/lib/feed";

const channelLinkClasses =
    "flex items-center gap-2.5 py-3 font-term text-sm text-slate-600 dark:text-slate-400 hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]";

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

                <div className="mt-8 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
                    {/* Deliberately opaque — never glass under a form. */}
                    <div className="rounded-card border border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#0b0d10] p-6 sm:p-8">
                        <form action={formAction}>
                            <div className="flex items-baseline gap-3 border-b border-slate-400/25 dark:border-white/10 py-3">
                                <span className="font-term text-xs text-slate-600 dark:text-slate-400 w-14 shrink-0">
                                    to:
                                </span>
                                <span
                                    aria-hidden
                                    className="font-term text-sm font-bold text-accent"
                                >
                                    adithya@homelab
                                </span>
                            </div>

                            <div className="flex items-baseline gap-3 border-b border-slate-400/25 dark:border-white/10 focus-within:border-[rgb(var(--c1))] transition-colors">
                                <label
                                    htmlFor="contact-sender-email"
                                    className="font-term text-xs text-slate-600 dark:text-slate-400 w-14 shrink-0"
                                >
                                    from:
                                </label>
                                <input
                                    id="contact-sender-email"
                                    className="w-full bg-transparent font-term text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 border-0 outline-none focus-visible:outline-none py-3"
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
                                        hasError
                                            ? state.values.senderEmail
                                            : undefined
                                    }
                                />
                            </div>

                            <label
                                htmlFor="contact-message"
                                className="block font-term text-xs text-slate-600 dark:text-slate-400 pt-4 pb-2"
                            >
                                message:
                            </label>
                            <textarea
                                id="contact-message"
                                className="w-full h-44 resize-none bg-transparent font-term text-sm leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-500 outline-none py-2 rounded-row border border-slate-400/25 dark:border-white/10 focus:border-[rgb(var(--c1))] transition-colors px-3"
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
                                    className="mt-3 text-sm text-rose-700 dark:text-rose-300"
                                >
                                    {state.message}
                                </p>
                            )}

                            <div className="mt-5 flex items-center justify-between gap-4">
                                <SubmitBtn />
                            </div>
                        </form>
                    </div>

                    <aside>
                        <p
                            aria-hidden
                            className="font-term text-xs text-slate-600 dark:text-slate-400 mb-3"
                        >
                            # other channels
                        </p>
                        <h3 className="sr-only">Other channels</h3>
                        <ul>
                            <li className="border-t border-b border-slate-400/25 dark:border-white/10">
                                <a
                                    href={siteConfig.profiles.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="LinkedIn profile"
                                    className={channelLinkClasses}
                                >
                                    <FaLinkedin
                                        aria-hidden
                                        className="w-4 h-4"
                                    />
                                    linkedin
                                    <span
                                        aria-hidden
                                        className="ml-auto font-term"
                                    >
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
                                    github
                                    <span
                                        aria-hidden
                                        className="ml-auto font-term"
                                    >
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
                                    rss
                                    <span
                                        aria-hidden
                                        className="ml-auto font-term"
                                    >
                                        ↗
                                    </span>
                                </a>
                            </li>
                        </ul>
                        <p className="mt-4 font-term text-xs text-slate-600 dark:text-slate-400">
                            # usually replies within a day or two
                        </p>
                    </aside>
                </div>
            </TerminalSection>
        </section>
    );
}
