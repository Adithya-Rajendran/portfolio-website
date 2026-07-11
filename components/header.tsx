"use client";

import { portfolioLinks } from "@/lib/data";
import Link from "next/link";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { useActiveSectionContext } from "@/context/active-section-context";

/**
 * Contextual portfolio navigation. The global site header owns route-level
 * navigation; this bar stays below it and lets visitors move through the
 * long work page without losing their place.
 */
export default function Header({ showProjects }: { showProjects: boolean }) {
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();
    const listRef = useRef<HTMLUListElement>(null);
    const activeLinkRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        const list = listRef.current;
        const link = activeLinkRef.current;
        if (!list || !link) return;

        const listBounds = list.getBoundingClientRect();
        const linkBounds = link.getBoundingClientRect();
        const outsideView =
            linkBounds.left < listBounds.left ||
            linkBounds.right > listBounds.right;

        if (outsideView) {
            link.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
            });
        }
    }, [activeSection]);

    const links = portfolioLinks(showProjects);

    return (
        <nav
            aria-label="Portfolio sections"
            className="os-subnav sticky top-16 z-[900] h-12 border-x-0"
        >
            <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
                <span className="shrink-0 font-term text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-accent sm:text-xs">
                    Portfolio
                </span>
                <span
                    aria-hidden
                    className="h-4 w-px shrink-0 bg-slate-300/80 dark:bg-white/10"
                />

                <ul
                    ref={listRef}
                    className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth pr-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black,black_calc(100%-22px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-22px),transparent)] font-term text-[0.72rem] font-medium text-slate-600 dark:text-slate-300 sm:justify-center sm:pr-0 sm:text-[0.78rem] sm:[mask-image:none] sm:[-webkit-mask-image:none]"
                >
                    {links.map((link) => {
                        const isActive = activeSection === link.name;
                        return (
                            <li className="relative shrink-0" key={link.hash}>
                                <Link
                                    ref={isActive ? activeLinkRef : undefined}
                                    className={clsx(
                                        "os-press inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full px-2.5 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))] sm:px-3",
                                        isActive &&
                                            "border border-accent-soft bg-accent-soft text-accent",
                                    )}
                                    href={link.hash}
                                    aria-current={
                                        isActive ? "location" : undefined
                                    }
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
                    className="hidden shrink-0 whitespace-nowrap font-term text-[0.68rem] text-slate-500 dark:text-slate-500 lg:block"
                >
                    On this page
                </span>
            </div>
        </nav>
    );
}
