import type { Metadata } from "next";
import {
    ArrowUpRight,
    BadgeCheck,
    Box,
    Download,
    MapPin,
    ShieldCheck,
} from "lucide-react";
import { FaGithub, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { ProfilePageJsonLd } from "@/components/json-ld";
import { getProfile } from "@/lib/sanity-client";
import { siteConfig, socialProfiles } from "@/lib/config";
import TerminalSection from "@/components/terminal/terminal-section";

export const metadata: Metadata = {
    title: "About",
    description: `About ${siteConfig.author}: what I do, where I am, and where to find me online.`,
    alternates: {
        canonical: `${siteConfig.url}/about`,
    },
    openGraph: {
        title: `About | ${siteConfig.author}`,
        description: `A little more about ${siteConfig.author}.`,
        url: `${siteConfig.url}/about`,
    },
};

interface ProfileLink {
    _key: string;
    label: string;
    url: string;
}

function linkIcon(url: string) {
    const host = (() => {
        try {
            return new URL(url).hostname.replace(/^(www|app)\./, "");
        } catch {
            return url;
        }
    })();

    if (host.includes("linkedin")) return FaLinkedin;
    if (host.includes("github")) return FaGithub;
    if (host.includes("credly")) return BadgeCheck;
    if (host.includes("hackthebox")) return Box;
    if (host.includes("tryhackme")) return ShieldCheck;
    if (host === "x.com" || host.includes("twitter")) return FaXTwitter;
    if (host.includes("youtube")) return FaYoutube;
    return ArrowUpRight;
}

function fallbackLinks(): ProfileLink[] {
    return socialProfiles.map((url) => {
        const host = new URL(url).hostname.replace(/^(www|app)\./, "");
        const label = host.includes("linkedin")
            ? "LinkedIn"
            : host.includes("github")
              ? "GitHub"
              : host.includes("credly")
                ? "Credly"
                : host.includes("hackthebox")
                  ? "Hack The Box"
                  : host.includes("tryhackme")
                    ? "TryHackMe"
                    : host;

        return { _key: url, label, url };
    });
}

export default async function AboutPage() {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const location = profile?.location || siteConfig.location;
    const links = profile?.socialLinks?.length
        ? (profile.socialLinks as ProfileLink[])
        : fallbackLinks();

    return (
        <main id="main-content" tabIndex={-1}>
            <ProfilePageJsonLd />
            <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
                <TerminalSection
                    as="div"
                    path="~/about"
                    command="cat about.txt"
                    promptVariant="compact"
                    animatePrompt
                    promptClassName="route-prompt mb-5"
                >
                    <header className="max-w-4xl">
                        <h1 className="font-display text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                            {name}
                        </h1>
                        <p className="mt-6 max-w-3xl font-display text-xl font-medium leading-snug text-slate-700 dark:text-slate-200 sm:text-2xl">
                            {profile?.headline || siteConfig.role}
                        </p>
                        {profile?.introduction && (
                            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg">
                                {profile.introduction}
                            </p>
                        )}
                    </header>

                    <div className="mt-14 grid gap-12 border-t border-slate-300/70 pt-12 dark:border-white/10 sm:mt-16 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20">
                        <article
                            aria-labelledby="bio-heading"
                            className="max-w-3xl"
                        >
                            <h2
                                id="bio-heading"
                                className="font-display text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white sm:text-3xl"
                            >
                                A little more
                            </h2>
                            <div className="mt-7 whitespace-pre-line text-[1.0625rem] leading-8 text-slate-700 dark:text-slate-300 sm:text-lg">
                                {profile?.bio ||
                                    "I like difficult infrastructure problems, clear explanations, and learning enough about a subject to take it apart. This site is a place for the work, notes, and interests I want to keep on the open web."}
                            </div>
                        </article>

                        <aside className="self-start lg:sticky lg:top-24">
                            <div className="border-t border-slate-300/70 dark:border-white/10">
                                {location && (
                                    <div className="flex items-center gap-3 border-b border-slate-300/70 py-4 font-term text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
                                        <MapPin
                                            className="size-4 text-accent"
                                            aria-hidden
                                        />
                                        {location}
                                    </div>
                                )}
                                <a
                                    href="/resume"
                                    className="group flex min-h-14 items-center gap-3 border-b border-slate-300/70 py-3 font-term text-sm font-semibold text-slate-700 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:text-slate-200"
                                >
                                    <Download className="size-4" aria-hidden />
                                    Résumé
                                    <ArrowUpRight
                                        className="ml-auto size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                        aria-hidden
                                    />
                                </a>
                            </div>

                            <h2 className="mt-10 font-term text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                Elsewhere
                            </h2>
                            <ul className="mt-3 border-t border-slate-300/70 dark:border-white/10">
                                {links.map((link) => {
                                    const Icon = linkIcon(link.url);
                                    return (
                                        <li
                                            key={link._key}
                                            className="border-b border-slate-300/70 dark:border-white/10"
                                        >
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex min-h-14 items-center gap-3 py-3 font-term text-sm font-semibold text-slate-700 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-200"
                                            >
                                                <Icon
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                                {link.label}
                                                <ArrowUpRight
                                                    className="ml-auto size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                                    aria-hidden
                                                />
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        </aside>
                    </div>
                </TerminalSection>
            </div>
        </main>
    );
}
