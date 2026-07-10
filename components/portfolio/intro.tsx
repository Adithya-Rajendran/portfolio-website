import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import heroImg from "@/public/hero.webp";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import TerminalSection from "@/components/terminal/terminal-section";
import { siteConfig } from "@/lib/config";

const portableTextComponents = createPortableTextStyles("intro");

const bracketBtn =
    "font-term text-sm font-bold rounded-row px-4 py-2.5 border transition-colors";

/** Corner crop-marks for the portrait frame (mirrors the home hero). */
function CornerBrackets() {
    const corner = "absolute w-4 h-4 border-accent";
    return (
        <>
            <span
                aria-hidden
                className={`${corner} top-0 left-0 border-t-2 border-l-2`}
            />
            <span
                aria-hidden
                className={`${corner} top-0 right-0 border-t-2 border-r-2`}
            />
            <span
                aria-hidden
                className={`${corner} bottom-0 left-0 border-b-2 border-l-2`}
            />
            <span
                aria-hidden
                className={`${corner} bottom-0 right-0 border-b-2 border-r-2`}
            />
        </>
    );
}

interface IntroProps {
    body?: PortableTextBlock[] | null;
    subtitle?: string | null;
}

/**
 * Portfolio hero: `$ cat resume.txt` types out over ~/portfolio, then
 * the résumé-view reveals — display h1, identity as a source comment
 * (mono is chrome, the intro prose stays Inter), bracket-command CTAs,
 * and the portrait between corner crop-marks.
 */
export default function Intro({ body, subtitle }: IntroProps) {
    // scroll-mt-[100rem] forces this section to register as the top anchor for the scroll-spy.
    return (
        <section id="home" className="scroll-mt-[100rem]">
            <TerminalSection
                as="div"
                command="cat resume.txt"
                path="~/portfolio"
                storageId="portfolio-hero"
                className="relative w-full max-w-6xl mx-auto px-6 sm:px-8 pt-2 sm:pt-6"
                promptClassName="mb-8"
                bodyClassName="grid items-center gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_15rem]"
            >
                <div>
                    <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                        Portfolio
                    </h1>
                    <p className="mt-4 font-term text-sm sm:text-[0.95rem] leading-relaxed text-accent">
                        # {siteConfig.author} — {subtitle || siteConfig.role}
                    </p>
                    {body && (
                        <div className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                            <PortableText
                                value={body}
                                components={portableTextComponents}
                            />
                        </div>
                    )}

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Link
                            href="/portfolio#contact"
                            className={`${bracketBtn} border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white dark:hover:text-slate-900`}
                        >
                            [ mail adithya ]
                        </Link>
                        <a
                            href="/resume"
                            className={`${bracketBtn} border-accent-soft text-accent hover:bg-accent-soft`}
                        >
                            [ ./resume ]
                        </a>
                    </div>

                    <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
                        <a
                            href={siteConfig.profiles.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="LinkedIn profile"
                            className="inline-flex items-center gap-1.5 font-term text-xs text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                        >
                            <FaLinkedin aria-hidden className="w-3.5 h-3.5" />
                            linkedin
                        </a>
                        <a
                            href={siteConfig.profiles.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="GitHub profile"
                            className="inline-flex items-center gap-1.5 font-term text-xs text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                        >
                            <FaGithub aria-hidden className="w-3.5 h-3.5" />
                            github
                        </a>
                        <a
                            href="/resume"
                            className="inline-flex items-center gap-1.5 font-term text-xs text-slate-500 hover:text-accent dark:text-slate-400 transition-colors"
                        >
                            <Download aria-hidden className="w-3.5 h-3.5" />
                            resume
                        </a>
                    </div>
                </div>

                <div className="relative mx-auto w-44 sm:w-52 lg:w-full max-w-[15rem] p-3.5">
                    <CornerBrackets />
                    <Image
                        src={heroImg}
                        alt={`Portrait of ${siteConfig.author}`}
                        width={480}
                        height={480}
                        quality={80}
                        priority
                        fetchPriority="high"
                        loading="eager"
                        sizes="(max-width: 1024px) 208px, 240px"
                        className="w-full h-auto saturate-[0.9]"
                    />
                </div>
            </TerminalSection>
        </section>
    );
}
