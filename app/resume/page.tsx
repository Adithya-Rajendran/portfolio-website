import type { Metadata } from "next";
import Link from "next/link";
import {
    ArrowUpRight,
    Award,
    BriefcaseBusiness,
    Download,
    FileText,
    GraduationCap,
    MapPin,
} from "lucide-react";
import ResumeShareAction from "@/components/resume/resume-share-action";
import { credentialLifecycle } from "@/lib/content-rules";
import { resolveResumeAssetUrl } from "@/lib/resume";
import {
    getProfile,
    type CredentialListItem,
    type TimelineEntry,
} from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

const canonicalUrl = `${siteConfig.url}/resume`;

export const metadata: Metadata = {
    title: "Résumé",
    description: `Experience, skills, credentials, and a downloadable résumé from ${siteConfig.author}.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
        title: `Résumé | ${siteConfig.author}`,
        description:
            "A mobile-friendly professional profile with a viewable and downloadable PDF résumé.",
        url: canonicalUrl,
        type: "profile",
    },
};

function formatMonth(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsed);
}

function dateRange(entry: TimelineEntry) {
    const start = formatMonth(entry.startDate);
    const end = formatMonth(entry.endDate);
    if (entry.kind === "education" && start && start === end) return end;
    return [start, end || (entry.kind === "work" ? "Present" : null)]
        .filter(Boolean)
        .join(" — ");
}

function SectionHeading({
    icon: Icon,
    id,
    title,
}: {
    icon: typeof BriefcaseBusiness;
    id: string;
    title: string;
}) {
    return (
        <div className="flex items-center gap-3 border-b border-slate-300/70 pb-4 dark:border-white/10">
            <span className="grid size-9 place-items-center rounded-row border border-accent-soft bg-accent-soft text-accent">
                <Icon className="size-4" aria-hidden />
            </span>
            <h2
                id={id}
                className="font-display text-2xl font-semibold tracking-[-0.035em] text-slate-950 dark:text-white"
            >
                {title}
            </h2>
        </div>
    );
}

function TimelineList({ entries }: { entries: TimelineEntry[] }) {
    return (
        <ol>
            {entries.map((entry) => {
                const highlights = entry.highlights ?? [];
                const visibleHighlights = highlights.slice(0, 4);
                const remainingHighlights = highlights.slice(4);

                return (
                    <li
                        key={entry._key}
                        className="border-b border-slate-300/70 py-7 last:border-b-0 dark:border-white/10 sm:py-8"
                    >
                        <article className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-8">
                            <p className="font-term text-[0.7rem] tabular-nums leading-5 text-slate-500 dark:text-slate-400">
                                {dateRange(entry)}
                            </p>
                            <div className="min-w-0">
                                <h3 className="font-display text-xl font-semibold tracking-[-0.025em] text-slate-950 dark:text-white sm:text-2xl">
                                    {entry.title}
                                </h3>
                                <p className="mt-1 font-term text-xs leading-5 text-accent">
                                    {[entry.organization, entry.location]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                                {entry.summary && (
                                    <p className="mt-4 text-[0.95rem] leading-7 text-slate-600 dark:text-slate-300">
                                        {entry.summary}
                                    </p>
                                )}
                                {visibleHighlights.length > 0 && (
                                    <ul className="mt-4 grid gap-2.5">
                                        {visibleHighlights.map((highlight) => (
                                            <li
                                                key={highlight}
                                                className="relative pl-4 text-sm leading-6 text-slate-600 before:absolute before:left-0 before:top-[0.65rem] before:size-1 before:rounded-full before:bg-accent dark:text-slate-300"
                                            >
                                                {highlight}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {remainingHighlights.length > 0 && (
                                    <details className="group mt-4">
                                        <summary className="os-press w-fit cursor-pointer rounded-row font-term text-xs font-semibold text-accent marker:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))]">
                                            <span className="ml-1 group-open:hidden">
                                                Show{" "}
                                                {remainingHighlights.length}{" "}
                                                more
                                            </span>
                                            <span className="ml-1 hidden group-open:inline">
                                                Show less
                                            </span>
                                        </summary>
                                        <ul className="mt-3 grid gap-2.5">
                                            {remainingHighlights.map(
                                                (highlight) => (
                                                    <li
                                                        key={highlight}
                                                        className="relative pl-4 text-sm leading-6 text-slate-600 before:absolute before:left-0 before:top-[0.65rem] before:size-1 before:rounded-full before:bg-accent dark:text-slate-300"
                                                    >
                                                        {highlight}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        </article>
                    </li>
                );
            })}
        </ol>
    );
}

function credentialStatus(credential: CredentialListItem) {
    const status =
        credential.lifecycleStatus || credentialLifecycle(credential);
    if (status === "lifetime") return "Lifetime";
    if (status === "expired") return "Expired";
    return "Active";
}

export default async function ResumePage() {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const headline = profile?.headline || siteConfig.role;
    const introduction =
        profile?.introduction ||
        "I work on infrastructure and security, build things to understand them, and write about what I learn.";
    const location = profile?.location || siteConfig.location;
    const timeline = profile?.timeline ?? [];
    const work = timeline.filter((entry) => entry.kind === "work");
    const education = timeline.filter((entry) => entry.kind === "education");
    const skills = profile?.skillGroups ?? [];
    const credentials = profile?.credentials ?? [];
    const profileLinks = (profile?.socialLinks ?? []).slice(0, 5);
    const hasPdf = Boolean(resolveResumeAssetUrl(profile?.resumeUrl, "view"));

    return (
        <main id="main-content" tabIndex={-1} className="pb-16 sm:pb-24">
            <section className="mx-auto w-full max-w-6xl px-5 pb-12 pt-6 sm:px-8 sm:pb-16 sm:pt-14 lg:px-10 lg:pt-18">
                <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-16">
                    <div className="min-w-0">
                        <p className="font-term text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent [overflow-wrap:anywhere]">
                            Résumé / professional profile
                        </p>
                        <h1 className="mt-3 font-display text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 [overflow-wrap:anywhere] dark:text-white sm:text-6xl">
                            {name}
                        </h1>
                        <p className="mt-4 font-term text-sm leading-6 text-accent sm:text-base">
                            # {headline}
                        </p>
                        <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg sm:leading-8">
                            {introduction}
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-[1.15fr_1fr_0.9fr]">
                            {hasPdf ? (
                                <>
                                    <a
                                        href="/resume/view"
                                        className="os-press col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-row bg-accent px-4 font-term text-xs font-bold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))] sm:col-span-1"
                                    >
                                        <FileText
                                            className="size-4"
                                            aria-hidden
                                        />
                                        View PDF
                                    </a>
                                    <a
                                        href="/resume/download"
                                        aria-label="Download résumé PDF"
                                        className="os-press inline-flex min-h-11 items-center justify-center gap-2 rounded-row border border-slate-300/80 bg-white/55 px-4 font-term text-xs font-bold text-slate-700 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))] dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-200"
                                    >
                                        <Download
                                            className="size-4"
                                            aria-hidden
                                        />
                                        Download
                                    </a>
                                </>
                            ) : (
                                <Link
                                    href="/portfolio"
                                    className="os-press col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-row bg-accent px-4 font-term text-xs font-bold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))]"
                                >
                                    View portfolio
                                    <ArrowUpRight
                                        className="size-4"
                                        aria-hidden
                                    />
                                </Link>
                            )}
                            <ResumeShareAction
                                canonicalUrl={canonicalUrl}
                                className={hasPdf ? "" : "col-span-2"}
                            />
                        </div>

                        {!hasPdf && (
                            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                The PDF is temporarily unavailable. The profile
                                below remains shareable.
                            </p>
                        )}

                        <p className="mt-4 font-term text-[0.68rem] leading-5 text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                            Shareable link:{" "}
                            {canonicalUrl.replace(/^https?:\/\//, "")}
                        </p>
                    </div>

                    <aside className="os-card-flat rounded-card p-5 sm:p-6">
                        <div className="flex items-start gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            <MapPin
                                className="mt-1 size-4 shrink-0 text-accent"
                                aria-hidden
                            />
                            <span>{location}</span>
                        </div>
                        <Link
                            href="/portfolio#contact"
                            className="group mt-5 flex min-h-11 items-center border-y border-slate-300/70 font-term text-xs font-semibold text-slate-700 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:border-white/10 dark:text-slate-200"
                        >
                            Say hello
                            <ArrowUpRight
                                className="ml-auto size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                aria-hidden
                            />
                        </Link>
                        {profileLinks.length > 0 && (
                            <ul className="mt-3 grid">
                                {profileLinks.map((link) => (
                                    <li key={link._key}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex min-h-11 items-center font-term text-xs text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-300"
                                        >
                                            {link.label}
                                            <ArrowUpRight
                                                className="ml-auto size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                                aria-hidden
                                            />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </aside>
                </div>
            </section>

            <div className="mx-auto grid w-full max-w-6xl gap-14 px-5 sm:gap-18 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-16 lg:px-10">
                <div className="min-w-0 space-y-14 sm:space-y-18">
                    {work.length > 0 && (
                        <section aria-labelledby="resume-experience">
                            <SectionHeading
                                id="resume-experience"
                                icon={BriefcaseBusiness}
                                title="Experience"
                            />
                            <TimelineList entries={work} />
                        </section>
                    )}

                    {education.length > 0 && (
                        <section aria-labelledby="resume-education">
                            <SectionHeading
                                id="resume-education"
                                icon={GraduationCap}
                                title="Education"
                            />
                            <TimelineList entries={education} />
                        </section>
                    )}
                </div>

                <aside className="space-y-12 lg:sticky lg:top-24">
                    {skills.length > 0 && (
                        <section aria-labelledby="resume-skills">
                            <SectionHeading
                                id="resume-skills"
                                icon={FileText}
                                title="Skills"
                            />
                            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                                {skills.map((group) => (
                                    <div key={group._key}>
                                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                                            {group.title}
                                        </h3>
                                        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
                                            {group.skills.map((skill) => (
                                                <li
                                                    key={skill}
                                                    className="font-term text-[0.68rem] leading-5 text-slate-600 dark:text-slate-300"
                                                >
                                                    <span
                                                        aria-hidden
                                                        className="text-accent"
                                                    >
                                                        /
                                                    </span>{" "}
                                                    {skill}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {credentials.length > 0 && (
                        <section aria-labelledby="resume-credentials">
                            <SectionHeading
                                id="resume-credentials"
                                icon={Award}
                                title="Credentials"
                            />
                            <ul className="mt-3 divide-y divide-slate-300/70 dark:divide-white/10">
                                {credentials.map((credential) => {
                                    const content = (
                                        <>
                                            <span className="font-display text-sm font-semibold leading-5 text-slate-900 dark:text-white">
                                                {credential.title}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                {credential.issuer} ·{" "}
                                                {credentialStatus(credential)}
                                            </span>
                                        </>
                                    );

                                    return (
                                        <li
                                            key={credential._key}
                                            className="py-4 first:pt-2"
                                        >
                                            {credential.verificationUrl ? (
                                                <a
                                                    href={
                                                        credential.verificationUrl
                                                    }
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group flex min-h-11 items-center gap-3 rounded-row focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))]"
                                                >
                                                    <span className="min-w-0 flex-1">
                                                        {content}
                                                    </span>
                                                    <ArrowUpRight
                                                        className="size-4 shrink-0 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                                        aria-hidden
                                                    />
                                                </a>
                                            ) : (
                                                <div className="min-h-11 py-1">
                                                    {content}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </aside>
            </div>
        </main>
    );
}
