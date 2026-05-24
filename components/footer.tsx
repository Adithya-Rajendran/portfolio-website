"use client";

import Link from "next/link";
import { FaGithub, FaLinkedin } from "react-icons/fa6";

export default function Footer() {
    return (
        <footer className="mt-24 sm:mt-32 border-t border-emerald-200/40 dark:border-white/8">
            <div className="mx-auto max-w-6xl px-6 sm:px-8 py-12 sm:py-14">
                <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
                    <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
                        {[
                            { href: "/", label: "Home" },
                            { href: "/portfolio", label: "Portfolio" },
                            { href: "/blogs", label: "Blog" },
                            { href: "/portfolio#contact", label: "Contact" },
                        ].map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        <a
                            href="https://www.linkedin.com/in/adithya-rajendran"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="LinkedIn profile"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-emerald-200/60 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                        >
                            <FaLinkedin className="w-4 h-4" />
                        </a>
                        <a
                            href="https://github.com/Adithya-Rajendran"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub profile"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-emerald-200/60 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                        >
                            <FaGithub className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-emerald-200/30 dark:border-white/5 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                    <small className="text-xs text-slate-500 dark:text-slate-500">
                        © {new Date().getFullYear()} Adithya Rajendran. All
                        rights reserved.
                    </small>
                    <p className="text-xs text-slate-500 dark:text-slate-600">
                        Built with Next.js · TypeScript · Tailwind
                    </p>
                </div>
            </div>
        </footer>
    );
}
