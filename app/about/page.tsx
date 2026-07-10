import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
    ArrowUpRight,
    BadgeCheck,
    Box,
    FileText,
    MapPin,
    Send,
    ShieldCheck,
} from "lucide-react";
import { FaGithub, FaLinkedin, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { createPortableTextStyles } from "@/lib/portable-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfilePageJsonLd } from "@/components/json-ld";
import NewsletterSignupForm from "@/components/newsletter/signup-form";
import { urlForImage } from "@/lib/sanity-image";
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
        <div className="mx-auto max-w-6xl px-6 sm:px-8 pt-16 animate-pulse">
            <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
                <div className="space-y-6">
                    <Skeleton className="h-12 w-72 rounded" />
                    <Skeleton className="h-5 w-96 max-w-full rounded" />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                </div>
                <Skeleton className="h-80 w-full rounded-3xl" />
            </div>
        </div>
    );
}

/** Icon + label per known profile host; generic shield for the rest. */
function profileMeta(url: string): {
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
} {
    const host = (() => {
        try {
            return new URL(url).hostname.replace(/^(www|app)\./, "");
        } catch {
            return url;
        }
    })();
    if (host.includes("linkedin"))
        return { label: "LinkedIn", Icon: FaLinkedin };
    if (host.includes("github")) return { label: "GitHub", Icon: FaGithub };
    if (host.includes("credly")) return { label: "Credly", Icon: BadgeCheck };
    if (host.includes("hackthebox"))
        return { label: "Hack The Box", Icon: Box };
    if (host.includes("tryhackme"))
        return { label: "TryHackMe", Icon: ShieldCheck };
    if (host === "x.com" || host.includes("twitter"))
        return { label: "X", Icon: FaXTwitter };
    if (host.includes("youtube")) return { label: "YouTube", Icon: FaYoutube };
    return { label: host, Icon: ArrowUpRight };
}

/**
 * Editorial identity page: asymmetric hero with portrait, open-layout
 * bio prose beside a sticky facts rail, credential badge tiles, and the
 * newsletter CTA. Everything renders from one data section — the hero's
 * identity line is live from the intro singleton.
 */
async function AboutContent() {
    const [about, intro, certifications] = await Promise.all([
        getAbout(),
        getIntro(),
        getAllCertifications(),
    ]);

    const roleLine = intro?.role || intro?.subtitle || siteConfig.role;
    const positioning = intro?.heroDescription;
    const focus = intro?.knowsAbout?.length
        ? intro.knowsAbout
        : siteConfig.knowsAbout;
    const affiliation = intro?.affiliation?.name;

    return (
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
            {/* ---- Hero: name + positioning left, portrait right ---- */}
            <section className="grid items-center gap-10 lg:gap-16 lg:grid-cols-[1fr_minmax(0,22rem)] pt-6 sm:pt-12 pb-16 sm:pb-20">
                <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-accent mb-4">
                        About
                    </p>
                    <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
                        {siteConfig.author}
                    </h1>
                    <p className="mt-4 text-lg sm:text-xl text-accent-gradient font-medium">
                        {roleLine}
                    </p>
                    {positioning && (
                        <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                            {positioning}
                        </p>
                    )}
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                        <Button asChild>
                            <Link href="/portfolio#contact">
                                Contact me
                                <Send
                                    aria-hidden
                                    className="ml-1 w-3.5 h-3.5 opacity-80"
                                />
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <a href="/resume">
                                Resume
                                <FileText
                                    aria-hidden
                                    className="ml-1 w-3.5 h-3.5 opacity-80"
                                />
                            </a>
                        </Button>
                        <div className="flex items-center gap-2 sm:ml-2">
                            {socialProfiles.map((url) => {
                                const { label, Icon } = profileMeta(url);
                                return (
                                    <a
                                        key={url}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={label}
                                        title={label}
                                        className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200/70 bg-white/60 text-slate-500 hover:border-accent-soft hover:text-accent dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 transition-colors backdrop-blur-md"
                                    >
                                        <Icon className="w-4 h-4" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Portrait — layered accent glow behind a glass frame */}
                <div className="relative mx-auto w-64 sm:w-72 lg:w-full max-w-[22rem]">
                    <div
                        aria-hidden
                        className="absolute -inset-4 rounded-[2.5rem] bg-accent-gradient opacity-20 blur-2xl"
                    />
                    <div className="relative overflow-hidden rounded-[2rem] os-card-flat p-2">
                        <Image
                            src="/hero.webp"
                            alt={`Portrait of ${siteConfig.author}`}
                            width={480}
                            height={480}
                            priority
                            className="w-full h-auto rounded-[1.6rem] object-cover"
                        />
                    </div>
                </div>
            </section>

            {/* ---- Bio prose + sticky facts rail ---- */}
            <section className="grid gap-12 lg:gap-16 lg:grid-cols-[minmax(0,1fr)_18rem] pb-16 sm:pb-20">
                <article aria-label="Bio">
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white relative mb-7">
                        <span className="absolute -left-4 top-1 bottom-1 w-1 bg-accent-gradient-vertical rounded-full hidden sm:block" />
                        The longer version
                    </h2>
                    <div className="text-[1.0625rem] sm:text-lg leading-relaxed text-slate-700 dark:text-slate-300 space-y-5">
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
                </article>

                <aside className="lg:sticky lg:top-28 self-start space-y-6">
                    <div className="os-card p-6">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
                            Currently
                        </h3>
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 font-medium">
                            {affiliation ? `${roleLine}` : roleLine}
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin
                                aria-hidden
                                className="w-3.5 h-3.5 text-accent opacity-80"
                            />
                            Remote · United States
                        </div>
                    </div>

                    <div className="os-card p-6">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
                            Focus
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {focus.map((topic) => (
                                <span
                                    key={topic}
                                    className="rounded-pill bg-accent-soft border border-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                                >
                                    {topic}
                                </span>
                            ))}
                        </div>
                    </div>
                </aside>
            </section>

            {/* ---- Credentials: real badge tiles ---- */}
            {certifications.length > 0 && (
                <section aria-label="Credentials" className="pb-16 sm:pb-20">
                    <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white relative mb-8">
                        <span className="absolute -left-4 top-1 bottom-1 w-1 bg-accent-gradient-vertical rounded-full hidden sm:block" />
                        Credentials
                    </h2>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {certifications.map((cert) => {
                            const badgeUrl = cert.badge
                                ? urlForImage(cert.badge)
                                      .width(160)
                                      .height(160)
                                      .fit("max")
                                      .auto("format")
                                      .url()
                                : null;
                            return (
                                <div
                                    key={cert._id}
                                    className="os-card os-hover p-6 flex items-center gap-5"
                                >
                                    {badgeUrl && (
                                        <Image
                                            src={badgeUrl}
                                            alt=""
                                            width={80}
                                            height={80}
                                            className="w-20 h-20 shrink-0 object-contain"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-display font-semibold text-slate-900 dark:text-white leading-snug">
                                            {cert.title}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                            {cert.org}
                                        </p>
                                        {cert.verifyUrl && (
                                            <a
                                                href={cert.verifyUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80 transition-opacity"
                                            >
                                                Verify
                                                <ArrowUpRight
                                                    aria-hidden
                                                    className="w-3 h-3"
                                                />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ---- Newsletter ---- */}
            <div className="max-w-3xl mx-auto pb-4">
                <NewsletterSignupForm variant="inline" />
            </div>
        </div>
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
