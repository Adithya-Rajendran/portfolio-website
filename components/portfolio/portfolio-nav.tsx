"use client";

import { portfolioLinks } from "@/lib/data";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useActiveSectionContext } from "@/context/active-section-context";
import {
    CONTEXT_NAV_ITEM_CLASSES,
    CONTEXT_NAV_LABEL_CLASSES,
    ContextNav,
} from "@/components/context-nav";
import { cn } from "@/lib/utils";

/**
 * Contextual portfolio navigation. The global site header owns route-level
 * navigation; this bar stays below it and lets visitors move through the
 * long work page without losing their place.
 */
export default function PortfolioNav({
    showProjects,
}: {
    showProjects: boolean;
}) {
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
        <ContextNav
            ariaLabel="Portfolio sections"
            collapseIdentityOnMobile
            identity={
                <span className={CONTEXT_NAV_LABEL_CLASSES}>Portfolio</span>
            }
        >
            <ul
                ref={listRef}
                className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth pr-5 text-slate-600 [scrollbar-width:none] [mask-image:linear-gradient(to_right,black,black_calc(100%-22px),transparent)] [-webkit-mask-image:linear-gradient(to_right,black,black_calc(100%-22px),transparent)] dark:text-slate-300 sm:pr-0 sm:[mask-image:none] sm:[-webkit-mask-image:none] [&::-webkit-scrollbar]:hidden"
            >
                {links.map((link) => {
                    const isActive = activeSection === link.name;
                    return (
                        <li className="relative shrink-0" key={link.hash}>
                            <Link
                                ref={isActive ? activeLinkRef : undefined}
                                className={cn(
                                    CONTEXT_NAV_ITEM_CLASSES,
                                    isActive &&
                                        "border border-accent-soft bg-accent-soft text-accent",
                                )}
                                href={link.hash}
                                aria-current={isActive ? "location" : undefined}
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
        </ContextNav>
    );
}
