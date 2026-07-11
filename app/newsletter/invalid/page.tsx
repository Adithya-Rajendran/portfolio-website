import type { Metadata } from "next";
import { MailWarning } from "lucide-react";
import { StatusCard } from "@/components/status-card";
import { PromptLine } from "@/components/terminal/terminal-section";
import NewsletterSignupForm from "@/components/newsletter/signup-form";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
    title: "Link expired",
    description: "This confirmation link is invalid or has expired.",
    robots: { index: false, follow: false },
    alternates: {
        canonical: `${siteConfig.url}/newsletter/invalid`,
    },
};

/** Landing page for an expired/tampered/missing confirmation token. */
export default function NewsletterInvalid() {
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
                    icon={MailWarning}
                    color="c3"
                    heading="That link didn't work"
                    headingAs="h1"
                >
                    The confirmation link is invalid or has expired — they only
                    last 48 hours. Enter your email below and we&apos;ll send
                    you a fresh one.
                </StatusCard>
                <div className="mt-6">
                    <NewsletterSignupForm variant="inline" />
                </div>
            </section>
        </main>
    );
}
