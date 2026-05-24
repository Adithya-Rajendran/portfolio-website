import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Download, Sparkles } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { Button } from "@/components/ui/button";

import heroImg from "@/public/hero.webp";

interface HeroContentProps {
    subtitle?: string | null;
}

/**
 * Home hero — asymmetric grid:
 *   left:  identity + headline + CTAs + socials
 *   right: floating glass profile card with status pill
 *
 * On mobile, the profile card stacks above the identity copy.
 */
export default function HeroContent({ subtitle }: HeroContentProps) {
    return (
        <section className="relative w-full pt-6 pb-20 sm:pt-12 sm:pb-28">
            <div className="mx-auto max-w-6xl px-2 sm:px-6">
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
                    {/* ── Identity / headline / CTAs ── */}
                    <div className="text-center lg:text-left">
                        {/* Status pill */}
                        <div className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs font-medium text-slate-700 animate-fade-in dark:text-slate-200">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            Available for cloud & security work
                        </div>

                        <h1 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02] animate-slide-up [animation-delay:120ms]">
                            <span className="text-slate-900 dark:text-white">
                                Hi, I&apos;m{" "}
                            </span>
                            <br className="hidden sm:block" />
                            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 dark:from-indigo-300 dark:via-violet-300 dark:to-sky-300 bg-clip-text text-transparent animate-gradient-text">
                                Adithya Rajendran
                            </span>
                        </h1>

                        <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0 animate-slide-up [animation-delay:240ms]">
                            {subtitle ||
                                "Cloud Field Engineer building resilient infrastructure, breaking it apart for fun, and writing about it."}
                        </p>

                        <div className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-3 animate-slide-up [animation-delay:360ms]">
                            <Button asChild size="lg" className="group gap-2">
                                <Link href="/portfolio">
                                    View Portfolio
                                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </Link>
                            </Button>

                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="gap-2"
                            >
                                <Link href="/blogs">
                                    Read the Blog
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-7 flex items-center justify-center lg:justify-start gap-5 animate-fade-in [animation-delay:520ms]">
                            <a
                                href="https://www.linkedin.com/in/adithya-rajendran"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors"
                                aria-label="LinkedIn profile"
                            >
                                <FaLinkedin className="w-5 h-5" />
                            </a>
                            <a
                                href="https://github.com/Adithya-Rajendran"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors"
                                aria-label="GitHub profile"
                            >
                                <FaGithub className="w-5 h-5" />
                            </a>
                            <span
                                aria-hidden="true"
                                className="w-px h-4 bg-slate-300 dark:bg-white/10"
                            />
                            <a
                                href="/resume"
                                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Resume
                            </a>
                        </div>
                    </div>

                    {/* ── Floating glass profile card ── */}
                    <div className="relative mx-auto w-full max-w-sm lg:max-w-none animate-scale-fade-in [animation-delay:180ms]">
                        {/* Decorative gradient halo behind the card */}
                        <div
                            aria-hidden="true"
                            className="absolute -inset-6 -z-10 bg-gradient-to-br from-indigo-400/20 via-violet-400/20 to-sky-400/20 blur-3xl rounded-full"
                        />

                        <div className="glass-strong relative rounded-3xl p-6 sm:p-7">
                            {/* Top tag row */}
                            <div className="flex items-center justify-between mb-6">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Profile
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                    /home
                                </span>
                            </div>

                            <div className="flex items-center gap-5">
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div
                                        aria-hidden="true"
                                        className="absolute -inset-1 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-400 opacity-80 blur-sm"
                                    />
                                    <Image
                                        src={heroImg}
                                        alt="Adithya Rajendran"
                                        width={96}
                                        height={96}
                                        quality={95}
                                        priority
                                        fetchPriority="high"
                                        sizes="96px"
                                        loading="eager"
                                        className="relative rounded-full object-cover w-24 h-24 ring-2 ring-white dark:ring-[#0a0c1a]"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                                        Currently
                                    </p>
                                    <p className="font-display text-lg font-semibold text-slate-900 dark:text-white leading-tight">
                                        Cloud Field Engineer
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        @ Canonical
                                    </p>
                                </div>
                            </div>

                            <div className="my-6 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-white/10" />

                            <dl className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500">
                                        Focus
                                    </dt>
                                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">
                                        OpenStack · K8s
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500">
                                        Interests
                                    </dt>
                                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">
                                        Pentesting
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500">
                                        Stack
                                    </dt>
                                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">
                                        AWS · Linux
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-500">
                                        Based
                                    </dt>
                                    <dd className="mt-1 text-slate-800 dark:text-slate-200 font-medium">
                                        Remote · USA
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
