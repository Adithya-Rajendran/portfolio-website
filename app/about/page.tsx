import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { UserRound, BadgeCheck, ArrowUpRight } from "lucide-react";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import UnifiedHero from "@/components/unified-hero";
import { IconPill } from "@/components/ui/icon-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfilePageJsonLd } from "@/components/json-ld";
import NewsletterSignupForm from "@/components/newsletter/signup-form";
import { getAbout, getAllCertifications, getIntro } from "@/lib/sanity-client";
import { siteConfig, socialProfiles } from "@/lib/config";

const portableTextComponents = createPortableTextStyles("about");

export const metadata: Metadata = {
    title: "About",
    description: `Who is ${siteConfig.author}? Infrastructure engineer and writer — background, credentials, and how to get in touch.`,
    alternates: {
        canonical: `${siteConfig.url}/about`,
    },
    openGraph: {
        title: `About | ${siteConfig.author}`,
        description: `Who is ${siteConfig.author}? Background, credentials, and how to get in touch.`,
        url: `${siteConfig.url}/about`,
    },
};

function AboutSkeleton() {
    return (
        <div className="mx-auto max-w-3xl px-6 sm:px-8 pt-16 space-y-6 animate-pulse">
            <Skeleton className="h-10 w-64 mx-auto rounded" />
            <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
    );
}

/** Hostname label for a profile URL ("linkedin.com", "tryhackme.com"). */
function profileLabel(url: string): string {
    try {
        return new URL(url).hostname.replace(/^(www|app)\./, "");
    } catch {
        return url;
    }
}

/**
 * The whole page renders from one data section: the hero pulls the
 * live identity line from the intro singleton, so it can't sit in the
 * static shell.
 */
async function AboutContent() {
    const [about, intro, certifications] = await Promise.all([
        getAbout(),
        getIntro(),
        getAllCertifications(),
    ]);

    const roleLine = intro?.role || intro?.subtitle || siteConfig.role;

    return (
        <>
            <UnifiedHero
                eyebrow="About"
                title={siteConfig.author}
                description={roleLine}
            />

            <div className="mx-auto max-w-3xl px-6 sm:px-8 space-y-8">
                {/* Bio prose — same Sanity singleton the portfolio used */}
                <section aria-label="Bio" className="os-card p-7 sm:p-10">
                    <header className="flex items-center gap-4 mb-7 sm:mb-8">
                        <IconPill icon={UserRound} color="c1" size="md" />
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                                About
                            </p>
                            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                                A bit about me
                            </h2>
                        </div>
                    </header>
                    <div className="text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                        {about?.body ? (
                            <PortableText
                                value={about.body as PortableTextBlock[]}
                                components={portableTextComponents}
                            />
                        ) : (
                            <p className="text-slate-500 dark:text-slate-400">
                                About content coming soon.
                            </p>
                        )}
                    </div>
                </section>

                {/* Credentials — compact; the portfolio has the full view */}
                {certifications.length > 0 && (
                    <section
                        aria-label="Credentials"
                        className="os-card p-7 sm:p-10"
                    >
                        <header className="flex items-center gap-4 mb-6">
                            <IconPill icon={BadgeCheck} color="c2" size="md" />
                            <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
                                Credentials
                            </h2>
                        </header>
                        <ul className="space-y-3">
                            {certifications.map((cert) => (
                                <li
                                    key={cert._id}
                                    className="flex flex-wrap items-baseline gap-x-2 text-sm sm:text-base"
                                >
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {cert.title}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">
                                        — {cert.org}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-6">
                            <Link
                                href="/portfolio#certs"
                                className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:opacity-80 transition-opacity"
                            >
                                Full portfolio
                                <ArrowUpRight aria-hidden className="w-4 h-4" />
                            </Link>
                        </div>
                    </section>
                )}

                {/* Elsewhere — every sameAs profile, so humans and crawlers
                    see the same identity graph */}
                <section aria-label="Profiles" className="os-card p-7 sm:p-10">
                    <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight mb-5">
                        Elsewhere
                    </h2>
                    <div className="flex flex-wrap gap-2.5">
                        {socialProfiles.map((url) => (
                            <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-pill border border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-accent hover:border-accent-soft transition-colors backdrop-blur-md"
                            >
                                {profileLabel(url)}
                            </a>
                        ))}
                        <Link
                            href="/portfolio#contact"
                            className="rounded-pill border border-accent-soft bg-accent-soft px-3.5 py-1.5 text-sm font-medium text-accent hover:border-accent transition-colors"
                        >
                            Contact me
                        </Link>
                    </div>
                </section>

                <NewsletterSignupForm variant="inline" />
            </div>
        </>
    );
}

export default function AboutPage() {
    return (
        <main id="main-content" tabIndex={-1} className="pb-24 sm:pb-32">
            <ProfilePageJsonLd />
            <Suspense fallback={<AboutSkeleton />}>
                <AboutContent />
            </Suspense>
        </main>
    );
}
