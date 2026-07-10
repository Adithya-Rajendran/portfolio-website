import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { StatusCard } from "@/components/status-card";
import { PromptLine } from "@/components/terminal/terminal-section";

export const metadata: Metadata = {
    title: "Subscription confirmed",
    description: "Your newsletter subscription is confirmed.",
    robots: { index: false, follow: false },
};

/** Landing page for a successful double-opt-in confirmation. */
export default function NewsletterConfirmed() {
    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="pb-24 sm:pb-32 px-6 sm:px-8"
        >
            <section className="mx-auto max-w-2xl mt-10 sm:mt-16">
                <PromptLine
                    command="subscribe --confirm"
                    path="~/newsletter"
                    className="mb-6"
                />
                <StatusCard
                    icon={MailCheck}
                    heading="You're subscribed"
                    headingAs="h1"
                    actions={
                        <Link
                            href="/blogs"
                            className="font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity"
                        >
                            [ ./blog ]
                        </Link>
                    }
                >
                    Thanks for confirming. New deep-dives on infrastructure,
                    Kubernetes, and security will land in your inbox roughly
                    every two weeks. Every email has an unsubscribe link.
                </StatusCard>
            </section>
        </main>
    );
}
