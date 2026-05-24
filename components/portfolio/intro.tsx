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
    subtitle?: string | null;
}

export default function Intro({ body, subtitle }: IntroProps) {
    return (
        <section id="home" className="scroll-mt-[100rem]">
            <PageHero
                eyebrow="Portfolio"
                title={
                    <>
                        Adithya{" "}
                        <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 dark:from-indigo-300 dark:via-violet-300 dark:to-sky-300 bg-clip-text text-transparent">
                            Rajendran
                        </span>
                    </>
                }
                tagline={subtitle ?? undefined}
                description={
                    body ? (
                        <PortableText
                            value={body}
                            components={portableTextComponents}
                        />
                    ) : null
                }
                actions={
                    <>
                        <Link
                            href="/portfolio#contact"
                            className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-500/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:from-indigo-500 dark:to-violet-500"
                        >
                            Contact me
                            <ArrowRight className="w-4 h-4 opacity-80 transition group-hover:translate-x-0.5" />
                        </Link>
                        <a
                            href="/resume"
                            className="group inline-flex items-center gap-2 rounded-full glass glow-hover px-6 py-3 text-sm font-medium text-slate-800 dark:text-slate-200"
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
                                className="glass glow-hover inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 dark:text-slate-300"
                            >
                                <FaLinkedin className="w-4 h-4" />
                            </a>
                            <a
                                href="https://github.com/Adithya-Rajendran"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="GitHub"
                                className="glass glow-hover inline-flex items-center justify-center w-11 h-11 rounded-full text-slate-600 dark:text-slate-300"
                            >
                                <FaGithub className="w-4 h-4" />
                            </a>
                        </div>
                    </>
                }
            >
                {/* Portrait sits between eyebrow and title */}
                <div className="flex justify-center mb-8">
                    <div className="relative">
                        <div
                            aria-hidden="true"
                            className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-400 opacity-70 blur-md"
                        />
                        <Image
                            src={heroImg}
                            alt="Portrait of Adithya Rajendran"
                            width={104}
                            height={104}
                            quality={95}
                            priority
                            fetchPriority="high"
                            loading="eager"
                            sizes="104px"
                            className="relative h-26 w-26 rounded-full object-cover ring-2 ring-white dark:ring-[#0a0c1a]"
                        />
                    </div>
                </div>
            </PageHero>
        </section>
    );
}
