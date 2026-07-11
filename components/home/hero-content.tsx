import Link from "next/link";
import Image from "next/image";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
import { Download } from "lucide-react";
import TerminalSection from "@/components/terminal/terminal-section";
import { siteConfig } from "@/lib/config";
import heroImg from "@/public/hero.webp";

interface HeroContentProps {
    subtitle?: string | null;
    description?: string | null;
    available?: boolean | null;
}

const bracketBtn =
    "font-term text-sm font-bold rounded-row px-4 py-2.5 border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c1))]";

/** Corner crop-marks for the portrait frame. */
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

/**
 * Terminal hero: `$ whoami` types out, then the answer reveals — mono
 * display name, the role as a source comment, prose description (Inter —
 * mono is chrome, not body), bracket-command actions, and the portrait
 * between corner crop-marks.
 */
export default function HeroContent({
    subtitle,
    description,
    available,
}: HeroContentProps) {
    return (
        <TerminalSection
            command="whoami"
            className="relative w-full max-w-6xl mx-auto px-6 sm:px-8 pt-2 sm:pt-6"
            promptClassName="mb-8"
            bodyClassName="grid items-center gap-10 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_17rem]"
        >
            <div>
                <h1 className="font-term text-[2.6rem] sm:text-6xl lg:text-[4.25rem] font-bold tracking-[-0.04em] leading-[1.04] text-slate-900 dark:text-white">
                    Adithya
                    <br />
                    Rajendran
                </h1>
                <p className="mt-5 font-term text-sm sm:text-[0.95rem] leading-relaxed text-accent">
                    # {subtitle || siteConfig.role}
                </p>
                <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                    {description ||
                        "Building resilient infrastructure, breaking it apart for fun, and writing about cybersecurity, homelabs, and the systems behind every clean abstraction."}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link
                        href="/portfolio"
                        className={`${bracketBtn} border-accent bg-accent-soft text-accent hover:bg-accent hover:text-white dark:hover:text-slate-900`}
                    >
                        [ ./portfolio ]
                    </Link>
                    <Link
                        href="/blogs"
                        className={`${bracketBtn} border-accent-soft text-accent hover:bg-accent-soft`}
                    >
                        [ ./blog ]
                    </Link>
                    <Link
                        href="/about"
                        className={`${bracketBtn} border-accent-soft text-accent hover:bg-accent-soft`}
                    >
                        [ ./about ]
                    </Link>
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {available && (
                        <p className="font-term text-xs text-emerald-600 dark:text-emerald-400">
                            <span aria-hidden>●</span> available for
                            opportunities
                        </p>
                    )}
                    <a
                        href={siteConfig.profiles.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="LinkedIn profile"
                        className="inline-flex items-center gap-1.5 font-term text-xs text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        <FaLinkedin aria-hidden className="w-3.5 h-3.5" />
                        linkedin
                    </a>
                    <a
                        href={siteConfig.profiles.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub profile"
                        className="inline-flex items-center gap-1.5 font-term text-xs text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        <FaGithub aria-hidden className="w-3.5 h-3.5" />
                        github
                    </a>
                    <a
                        href="/resume"
                        className="inline-flex items-center gap-1.5 font-term text-xs text-slate-600 hover:text-accent dark:text-slate-400 transition-colors"
                    >
                        <Download aria-hidden className="w-3.5 h-3.5" />
                        resume
                    </a>
                </div>
            </div>

            <div className="relative mx-auto w-52 sm:w-60 lg:w-full max-w-[17rem] p-3.5">
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
                    sizes="(max-width: 1024px) 240px, 272px"
                    className="w-full h-auto saturate-[0.9]"
                />
            </div>
        </TerminalSection>
    );
}
