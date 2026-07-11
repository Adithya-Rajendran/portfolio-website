import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Download } from "lucide-react";
import TerminalSection from "@/components/terminal/terminal-section";
import { siteConfig } from "@/lib/config";

interface SocialLink {
    _key: string;
    label: string;
    url: string;
}

interface HeroContentProps {
    name?: string | null;
    headline?: string | null;
    introduction?: string | null;
    portraitSrc: string;
    portraitAlt?: string | null;
    socialLinks?: SocialLink[] | null;
}

const bracketLink =
    "os-press inline-flex min-h-11 items-center rounded-row border px-4 py-2.5 font-term text-sm font-bold text-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))]";

function CornerMarks() {
    const base = "absolute size-4 border-accent";

    return (
        <>
            <span
                aria-hidden
                className={`${base} left-0 top-0 border-l-2 border-t-2`}
            />
            <span
                aria-hidden
                className={`${base} right-0 top-0 border-r-2 border-t-2`}
            />
            <span
                aria-hidden
                className={`${base} bottom-0 left-0 border-b-2 border-l-2`}
            />
            <span
                aria-hidden
                className={`${base} bottom-0 right-0 border-b-2 border-r-2`}
            />
        </>
    );
}

export default function HeroContent({
    name,
    headline,
    introduction,
    portraitSrc,
    portraitAlt,
    socialLinks,
}: HeroContentProps) {
    const displayName = name || siteConfig.author;
    const [firstName, ...rest] = displayName.split(" ");
    const lastName = rest.join(" ");
    const links = socialLinks?.length
        ? socialLinks
        : [
              {
                  _key: "linkedin",
                  label: "LinkedIn",
                  url: siteConfig.profiles.linkedin,
              },
              {
                  _key: "github",
                  label: "GitHub",
                  url: siteConfig.profiles.github,
              },
          ].filter((link) => Boolean(link.url));

    return (
        <TerminalSection
            command="whoami"
            animatePrompt
            className="mx-auto flex min-h-[calc(100svh-var(--site-header-height)-5rem)] w-full max-w-6xl flex-col justify-center px-5 py-12 sm:px-8 sm:py-16 lg:py-20"
            promptClassName="mb-8"
            bodyClassName="home-hero-reveal grid items-center gap-11 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-16"
        >
            <div>
                <h1 className="font-term text-[2.55rem] font-bold leading-[1.03] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl lg:text-[4.25rem]">
                    {firstName}
                    {lastName && (
                        <>
                            <br />
                            {lastName}
                        </>
                    )}
                </h1>
                <p className="mt-5 max-w-2xl font-term text-sm leading-7 text-accent sm:text-[0.95rem]">
                    # {headline || siteConfig.role}
                </p>
                <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg">
                    {introduction ||
                        "I work on infrastructure and security, build things to understand them, and write about whatever keeps my attention."}
                </p>

                <nav
                    aria-label="Explore this site"
                    className="mt-8 flex flex-wrap gap-3"
                >
                    <Link
                        href="/portfolio"
                        className={`${bracketLink} border-accent bg-accent-soft hover:bg-accent hover:text-on-accent`}
                    >
                        [ ./portfolio ]
                    </Link>
                    <Link
                        href="/blogs"
                        className={`${bracketLink} border-accent-soft hover:bg-accent-soft`}
                    >
                        [ ./blog ]
                    </Link>
                    <Link
                        href="/about"
                        className={`${bracketLink} border-accent-soft hover:bg-accent-soft`}
                    >
                        [ ./about ]
                    </Link>
                </nav>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 font-term text-xs text-slate-500 dark:text-slate-400">
                    {links.map((link) => (
                        <a
                            key={link._key}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                        >
                            {link.label.toLowerCase()}
                            <ArrowUpRight className="size-3" aria-hidden />
                        </a>
                    ))}
                    <Link
                        href="/resume"
                        className="inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                    >
                        <Download className="size-3.5" aria-hidden />
                        résumé
                    </Link>
                </div>
            </div>

            <figure className="relative mx-auto w-52 p-3.5 sm:w-60 lg:w-full lg:max-w-[17rem]">
                <CornerMarks />
                <div className="relative aspect-square overflow-hidden bg-slate-200/70 dark:bg-slate-900/70">
                    <Image
                        src={portraitSrc}
                        alt={portraitAlt || `Portrait of ${displayName}`}
                        fill
                        priority
                        fetchPriority="high"
                        sizes="(max-width: 1024px) 240px, 272px"
                        className="object-cover saturate-[0.88]"
                    />
                </div>
            </figure>
        </TerminalSection>
    );
}
