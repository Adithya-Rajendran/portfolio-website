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
            {/* Use CSS animation for initial slide-down to reduce JS blocking */}
            <div
                className="fixed top-0 left-1/2 -translate-x-1/2 h-[4.5rem] w-full rounded-none border border-emerald-200/60 bg-white/80 shadow-lg shadow-emerald-100/30 backdrop-blur-[0.5rem] sm:top-6 sm:h-[3.25rem] sm:w-[42rem] sm:rounded-full dark:bg-slate-900/80 dark:border-white/8 dark:shadow-emerald-500/5 animate-slide-down"
                style={{ contain: "layout" }}
            />

            <nav className="flex fixed top-[0.15rem] left-1/2 h-12 -translate-x-1/2 py-2 sm:top-[1.7rem] sm:h-[initial] sm:py-0">
                <ul className="flex w-[22rem] flex-wrap items-center justify-center gap-y-1 text-[0.9rem] font-medium text-slate-500 sm:w-[initial] sm:flex-nowrap sm:gap-5">
                    {links.map((link) => (
                        <li
                            className="h-3/4 flex items-center justify-center relative animate-slide-down"
                            key={link.hash}
                        >
                            <Link
                                className={clsx(
                                    "flex w-full items-center justify-center px-3 py-3 hover:text-emerald-700 transition dark:text-slate-500 dark:hover:text-emerald-400",
                                    {
                                        "text-emerald-800 dark:text-emerald-400":
                                            activeSection === link.name,
                                    }
                                )}
                                href={link.hash}
                                onClick={() => {
                                    setActiveSection(link.name);
                                    setTimeOfLastClick(Date.now());
                                }}
                            >
                                {link.name}

                                {link.name === activeSection && (
                                    <motion.span
                                        className="bg-emerald-100 rounded-full absolute inset-0 -z-10 dark:bg-emerald-500/10"
                                        layoutId="activeSection"
                                        transition={{
                                            type: "spring",
                                            stiffness: 380,
                                            damping: 30,
                                        }}
                                    />
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </header>
    );
}
