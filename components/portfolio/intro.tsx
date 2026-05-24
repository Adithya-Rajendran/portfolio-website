import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import heroImg from "@/public/hero.webp";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import PageHero from "@/components/page-hero";

const portableTextComponents = createPortableTextStyles("intro");

interface IntroProps {
    body?: PortableTextBlock[] | null;
}

export default function Intro({ body }: IntroProps) {
    return (
        <section id="home" className="scroll-mt-[100rem]">
            <PageHero
                eyebrow="Portfolio"
                title={
                    body ? (
                        <PortableText
                            value={body}
                            components={portableTextComponents}
                        />
                    ) : (
                        <>Hi, I&apos;m Adithya Rajendran.</>
                    )
                }
                actions={
                    <>
                        <Link
                            href="/portfolio#contact"
                            className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                        >
                            Contact me
                            <ArrowRight className="w-4 h-4 opacity-80 transition group-hover:translate-x-0.5" />
                        </Link>
                        <a
                            href="/resume"
                            className="group inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white px-6 py-3 text-sm font-medium text-slate-800 transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]"
                        >
                            Download CV
                            <Download className="w-4 h-4 opacity-70 transition group-hover:translate-y-0.5" />
                        </a>
                        <div className="flex items-center gap-2">
                            <a
                                href="https://www.linkedin.com/in/adithya-rajendran/"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="LinkedIn"
                                className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-emerald-200/70 bg-white text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-emerald-400"
                            >
                                <FaLinkedin className="w-4 h-4" />
                            </a>
                            <a
                                href="https://github.com/Adithya-Rajendran"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="GitHub"
                                className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-emerald-200/70 bg-white text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:text-emerald-400"
                            >
                                <FaGithub className="w-4 h-4" />
                            </a>
                        </div>
                    </>
                }
            >
                {/* Portrait sits between eyebrow and title */}
                <div className="flex justify-center mb-6">
                    <Image
                        src={heroImg}
                        alt="My portrait"
                        width={112}
                        height={112}
                        quality={95}
                        priority
                        fetchPriority="high"
                        loading="eager"
                        sizes="112px"
                        className="h-28 w-28 rounded-full object-cover ring-4 ring-emerald-300/50 dark:ring-emerald-500/30 shadow-xl shadow-emerald-200/30 dark:shadow-emerald-500/10"
                    />
                </div>
            </PageHero>
        </section>
    );
}
