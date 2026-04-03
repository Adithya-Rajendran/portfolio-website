"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Briefcase, PenLine } from "lucide-react";

export default function NavCards() {
    return (
        <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-[64rem] pb-28"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Link
                    href="/portfolio"
                    className="group relative rounded-xl border border-emerald-200 bg-white p-8 sm:p-10 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100 hover:border-emerald-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-emerald-500/30 dark:hover:shadow-emerald-500/5"
                >
                    <div className="relative">
                        <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                            Portfolio
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Experience, projects, certifications, and skills in
                            cloud engineering and cybersecurity.
                        </p>
                        <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium group-hover:gap-3 transition-all">
                            Explore
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </Link>

                <Link
                    href="/blogs"
                    className="group relative rounded-xl border border-teal-200 bg-white p-8 sm:p-10 transition-all duration-300 hover:shadow-lg hover:shadow-teal-100 hover:border-teal-400 dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] dark:hover:border-cyan-500/30 dark:hover:shadow-cyan-500/5"
                >
                    <div className="relative">
                        <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20">
                            <PenLine className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                            Blogs
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Insights and write-ups on cybersecurity, homelabs,
                            and technology explorations.
                        </p>
                        <span className="inline-flex items-center gap-2 text-teal-600 dark:text-cyan-400 font-medium group-hover:gap-3 transition-all">
                            Read
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </span>
                    </div>
                </Link>
            </div>
        </motion.section>
    );
}
