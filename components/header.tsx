"use client";

import { links } from "@/lib/data";
import Link from "next/link";
import clsx from "clsx";
import { useActiveSectionContext } from "@/context/active-section-context";

export default function Header() {
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();

    return (
        <header className="fixed top-0 sm:top-5 inset-x-0 z-[999] flex justify-center pointer-events-none">
            <div className="animate-header-enter relative pointer-events-auto w-full h-[4.5rem] sm:w-[46rem] sm:h-[3.5rem]">
                {/* Background pill — fills the same box as the nav */}
                <div
                    aria-hidden
                    className="os-nav absolute inset-0 rounded-none sm:rounded-full"
                />

                {/* Nav links — flex-centered within the same box */}
                <nav
                    aria-label="Main navigation"
                    className="relative h-full flex items-center justify-center px-2 sm:px-4"
                >
                    <ul className="flex w-full flex-wrap items-center justify-center gap-y-1 text-[0.875rem] font-medium text-slate-600 sm:flex-nowrap sm:gap-1 dark:text-slate-300">
                        {links.map((link) => {
                            const isActive = activeSection === link.name;
                            return (
                                <li className="relative" key={link.hash}>
                                    <Link
                                        className={clsx(
                                            "os-press inline-flex items-center justify-center px-3.5 h-9 rounded-full transition-colors hover:text-accent",
                                            isActive &&
                                                "text-accent bg-accent-soft border border-accent-soft",
                                        )}
                                        href={link.hash}
                                        aria-current={
                                            isActive ? "page" : undefined
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
                </nav>
            </div>
        </header>
    );
}
