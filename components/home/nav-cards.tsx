import Link from "next/link";
import TerminalSection, {
    PromptLine,
} from "@/components/terminal/terminal-section";
import NewsletterSignupForm from "@/components/newsletter/signup-form";

const destinations = [
    {
        href: "/portfolio",
        command: "cd /portfolio",
        note: "experience, projects, and the systems behind them",
    },
    {
        href: "/blogs",
        command: "cd /blog",
        note: "deep-dives on self-hosted ai, kubernetes, and security",
    },
    {
        href: "/portfolio#contact",
        command: "mail adithya",
        note: "open roles, collaborations, or comparing notes",
    },
];

/**
 * The home page's closing block: navigation as commands, the newsletter
 * as an embedded opaque panel (honest cadence copy, RSS beside the
 * form — never glass under a subscribe form), and a parked prompt as
 * the page's last line.
 */
export default function NavCards() {
    return (
        <TerminalSection
            path="~"
            command="ls -d */"
            label="Explore"
            className="w-full max-w-6xl mx-auto px-6 sm:px-8 pb-10 sm:pb-12"
        >
            <div className="border-t border-slate-400/25 dark:border-white/10">
                {destinations.map(({ href, command, note }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex flex-wrap sm:flex-nowrap items-baseline gap-x-6 gap-y-1 py-6 sm:py-7 border-b border-slate-400/25 dark:border-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
                    >
                        <span className="font-term text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                            <span aria-hidden className="text-accent">
                                ${" "}
                            </span>
                            {command}
                        </span>
                        <span className="w-full sm:w-auto sm:flex-1 font-term text-[0.8rem] text-slate-500 dark:text-slate-400">
                            # {note}
                        </span>
                        <span
                            aria-hidden
                            className="hidden sm:block font-term text-xl text-accent transition-transform group-hover:translate-x-1"
                        >
                            →
                        </span>
                    </Link>
                ))}
            </div>

            {/* Newsletter — deliberately opaque (no glass under a form) */}
            <div className="mt-14 rounded-card border border-slate-400/30 dark:border-white/10 bg-white dark:bg-[#0b0d10] p-7 sm:p-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
                <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                        One deep dive, every two weeks.
                    </h2>
                    <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-400">
                        Self-hosted AI infrastructure, homelab Kubernetes, and
                        security compliance — written up properly. No ads, no
                        sponsors, ever. Unsubscribe in one click.
                    </p>
                </div>
                <div>
                    <NewsletterSignupForm variant="bare" />
                    <p className="mt-3 font-term text-[0.7rem] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                        prefer feeds?{" "}
                        <a
                            href="/feed.xml"
                            className="text-accent hover:opacity-80 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
                        >
                            rss ↗
                        </a>
                    </p>
                </div>
            </div>

            <PromptLine command="" cursor className="mt-12" />
        </TerminalSection>
    );
}
