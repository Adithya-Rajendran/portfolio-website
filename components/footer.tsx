"use client";

import React from "react";
import Link from "next/link";
import { BsGithub, BsLinkedin } from "react-icons/bs";

export default function Footer() {
    return (
        <footer className="border-t border-white/8 mt-20">
            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-10">
                    {/* Navigation */}
                    <nav className="flex flex-wrap gap-x-8 gap-y-2">
                        <Link
                            href="/"
                            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            Home
                        </Link>
                        <Link
                            href="/portfolio"
                            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            Portfolio
                        </Link>
                        <Link
                            href="/blogs"
                            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            Blog
                        </Link>
                        <Link
                            href="/portfolio#contact"
                            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            Contact
                        </Link>
                    </nav>

                    {/* Social links */}
                    <div className="flex items-center gap-4">
                        <a
                            href="https://www.linkedin.com/in/adithya-rajendran"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-emerald-400 transition-colors"
                            aria-label="LinkedIn profile"
                        >
                            <BsLinkedin className="text-lg" />
                        </a>
                        <a
                            href="https://github.com/Adithya-Rajendran"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-emerald-400 transition-colors"
                            aria-label="GitHub profile"
                        >
                            <BsGithub className="text-lg" />
                        </a>
                    </div>
                </div>

                {/* Bottom line */}
                <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <small className="text-xs text-slate-500">
                        &copy; {new Date().getFullYear()} Adithya Rajendran. All
                        rights reserved.
                    </small>
                    <p className="text-xs text-slate-600">
                        Built with Next.js, TypeScript, and Tailwind CSS.
                        Deployed on Vercel.
                    </p>
                </div>
            </div>
        </footer>
    );
}
