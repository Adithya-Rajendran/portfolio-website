"use client";

import { links } from "@/lib/data";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { useActiveSectionContext } from "@/context/active-section-context";

/**
 * Portfolio top bar — shares the blog nav's anatomy: a slim full-width
 * os-nav strip with a `cd ~` back-link on the left, the five in-page
 * section anchors in the middle (scroll-spy highlights the active one),
 * and a decorative `~/portfolio` shell path on the right. On mobile the
 * section links become a single horizontally scrollable row.
 */
export default function Header() {
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();

    return (
        <nav
            aria-label="Main navigation"
            className="os-nav animate-header-enter fixed top-0 left-0 right-0 z-[999] h-[3.5rem] flex items-center gap-2.5 sm:gap-4 px-3 sm:px-6 rounded-none border-x-0 border-t-0"
        >
            <Link
                href="/"
                aria-label="Back to home"
                className="flex items-center gap-2 font-term text-sm font-bold text-accent hover:opacity-80 transition-opacity whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]"
            >
                <ArrowLeft aria-hidden className="w-4 h-4" />
                cd ~
            </Link>

            <ul className="flex min-w-0 flex-1 items-center justify-start sm:justify-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:[mask-image:linear-gradient(to_right,black,black_calc(100%-24px),transparent)] max-sm:[-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-24px),transparent)] font-term text-[0.75rem] sm:text-[0.8rem] font-medium lowercase text-slate-600 dark:text-slate-300">
                {links.map((link) => {
                    const isActive = activeSection === link.name;
                    return (
                        <li className="relative shrink-0" key={link.hash}>
                            <Link
                                className={clsx(
                                    "os-press inline-flex items-center justify-center whitespace-nowrap px-2.5 sm:px-3 h-8 rounded-full transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]",
                                    isActive &&
                                        "text-accent bg-accent-soft border border-accent-soft",
                                )}
                                href={link.hash}
                                aria-current={isActive ? "page" : undefined}
                                onClick={() => {
                                    setActiveSection(link.name);
                                    setTimeOfLastClick(Date.now());
                                }}
                            >
                                {link.name}
                            </Link>
                        </li>
                    );
                })}
            </ul>

            <span
                aria-hidden
                className="hidden sm:block whitespace-nowrap font-term text-xs text-slate-600 dark:text-slate-400"
            >
                ~/portfolio
            </span>
        </nav>
    );
}
