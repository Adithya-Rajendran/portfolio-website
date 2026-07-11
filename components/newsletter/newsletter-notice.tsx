import Link from "next/link";

/** A truthful placeholder until there is an actual newsletter to subscribe to. */
export default function NewsletterNotice() {
    return (
        <aside
            aria-label="Newsletter"
            className="border-y border-slate-400/25 py-6 dark:border-white/10"
        >
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                <span className="font-display font-semibold text-slate-900 dark:text-white">
                    Newsletter — coming soon.
                </span>{" "}
                <Link
                    href="/feed.xml"
                    className="font-term text-sm text-accent underline decoration-1 underline-offset-4 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                >
                    RSS is available now.
                </Link>
            </p>
        </aside>
    );
}
