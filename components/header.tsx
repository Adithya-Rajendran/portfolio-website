"use client";

import React from "react";
import { motion } from "motion/react";
import { links } from "@/lib/data";
import Link from "next/link";
import clsx from "clsx";
import { useActiveSectionContext } from "@/context/active-section-context";

export default function Header() {
    const { activeSection, setActiveSection, setTimeOfLastClick } =
        useActiveSectionContext();

    return (
        <header className="z-[999] relative">
            <motion.div
                className="glass-nav fixed top-0 left-1/2 h-[4.5rem] w-full rounded-none sm:top-5 sm:h-[3.4rem] sm:w-[44rem] sm:rounded-full"
                initial={{ y: -100, x: "-50%", opacity: 0 }}
                animate={{ y: 0, x: "-50%", opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            ></motion.div>

            <nav
                aria-label="Main navigation"
                className="flex fixed top-[0.15rem] left-1/2 h-12 -translate-x-1/2 py-2 sm:top-[1.45rem] sm:h-[initial] sm:py-0"
            >
                <ul className="flex w-[22rem] flex-wrap items-center justify-center gap-y-1 text-[0.875rem] font-medium text-slate-600 sm:w-[initial] sm:flex-nowrap sm:gap-4 dark:text-slate-300">
                    {links.map((link) => (
                        <motion.li
                            className="h-3/4 flex items-center justify-center relative"
                            key={link.hash}
                            initial={{ y: -100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                        >
                            <Link
                                className={clsx(
                                    "flex w-full items-center justify-center px-3 py-2 hover:text-accent transition-colors",
                                    {
                                        "text-accent": activeSection === link.name,
                                    },
                                )}
                                href={link.hash}
                                aria-current={
                                    activeSection === link.name
                                        ? "page"
                                        : undefined
                                }
                                onClick={() => {
                                    setActiveSection(link.name);
                                    setTimeOfLastClick(Date.now());
                                }}
                            >
                                {link.name}

                                {link.name === activeSection && (
                                    <motion.span
                                        className="bg-accent-gradient-soft border-accent-soft border rounded-full absolute inset-0 -z-10"
                                        layoutId="activeSection"
                                        transition={{
                                            type: "spring",
                                            stiffness: 380,
                                            damping: 30,
                                        }}
                                    ></motion.span>
                                )}
                            </Link>
                        </motion.li>
                    ))}
                </ul>
            </nav>
        </header>
    );
}
