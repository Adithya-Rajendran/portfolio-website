"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { BsArrowRight, BsGithub, BsLinkedin } from "react-icons/bs";
import { HiDownload } from "react-icons/hi";
import { Button } from "@/components/ui/button";

import heroImg from "@/public/hero.webp";

interface HeroContentProps {
    subtitle?: string | null;
}

export default function HeroContent({ subtitle }: HeroContentProps) {
    return (
        <section className="flex flex-col items-center justify-center min-h-[85vh] text-center relative w-full">
            <div className="absolute inset-0 -z-10 bg-grid-pattern opacity-50 dark:opacity-100" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
            >
                <div className="relative w-28 h-28 mx-auto">
                    <Image
                        src={heroImg}
                        alt="Adithya Rajendran"
                        width={112}
                        height={112}
                        quality={95}
                        priority
                        sizes="112px"
                        className="rounded-full object-cover w-28 h-28 border-2 border-emerald-400 shadow-lg shadow-emerald-300/30 dark:border-emerald-500/30 dark:shadow-emerald-500/10"
                    />
                    <div className="absolute inset-0 rounded-full ring-2 ring-emerald-300 ring-offset-2 ring-offset-[#f0fdf4] dark:ring-emerald-400/20 dark:ring-offset-[#0a0f1a]" />
                </div>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-5xl sm:text-7xl font-bold mb-6 tracking-tight"
            >
                <span className="bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-700 dark:from-emerald-400 dark:via-cyan-300 dark:to-emerald-400 bg-clip-text text-transparent animate-gradient-text">
                    Adithya Rajendran
                </span>
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 max-w-[36rem] mx-auto mb-10 leading-relaxed"
            >
                {subtitle ||
                    "Cloud Field Engineer / Cybersecurity Enthusiast / Builder"}
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-wrap items-center justify-center gap-3"
            >
                <Button asChild size="lg" className="gap-2">
                    <Link href="/portfolio">
                        View Portfolio
                        <BsArrowRight className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/blogs">Read Blog</Link>
                </Button>

                <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/portfolio#contact">Contact Me</Link>
                </Button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="flex items-center gap-4 mt-8"
            >
                <a
                    href="https://www.linkedin.com/in/adithya-rajendran"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                    aria-label="LinkedIn profile"
                >
                    <BsLinkedin className="text-xl" />
                </a>
                <a
                    href="https://github.com/Adithya-Rajendran"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                    aria-label="GitHub profile"
                >
                    <BsGithub className="text-xl" />
                </a>
                <a
                    href="/resume"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                >
                    <HiDownload className="text-base" />
                    Resume
                </a>
            </motion.div>
        </section>
    );
}
