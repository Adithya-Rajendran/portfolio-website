import { ChevronDown } from "lucide-react";
import type { PostHeading } from "./utils";

/**
 * Collapsible "On this page" navigation for viewports below lg, where
 * the desktop sidebar ToC (table-of-contents.tsx) never renders. Native
 * <details>/<summary> — server-rendered, zero JS. Consumes the same
 * extractHeadings output as the sidebar, so anchor ids always match.
 */
export default function MobileToc({ headings }: { headings: PostHeading[] }) {
    if (headings.length === 0) return null;

    return (
        <nav
            aria-label="On this page"
            className="lg:hidden mx-auto max-w-[42.5rem] px-6 sm:px-8 pb-8"
        >
            <details className="group rounded-card border border-slate-400/25 dark:border-white/10 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-term text-[0.7rem] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                    On this page
                    <ChevronDown
                        aria-hidden
                        className="w-4 h-4 transition-transform group-open:rotate-180"
                    />
                </summary>
                <ul className="mt-4 space-y-2.5 text-sm border-t border-slate-400/25 dark:border-white/10 pt-4">
                    {headings.map((heading) => (
                        <li
                            key={heading.key}
                            className={heading.level === 2 ? "" : "pl-4"}
                        >
                            <a
                                href={`#${heading.id}`}
                                className="block text-slate-600 dark:text-slate-300 hover:text-accent transition-colors leading-snug"
                            >
                                {heading.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </details>
        </nav>
    );
}
