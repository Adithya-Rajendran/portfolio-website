import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, FileText } from "lucide-react";
import ResumeShareAction from "@/components/resume/resume-share-action";
import { siteConfig } from "@/lib/config";
import { resolveResumeAssetUrl } from "@/lib/resume";
import { getProfile } from "@/lib/sanity-client";

const canonicalUrl = `${siteConfig.url}/resume`;

export const metadata: Metadata = {
    title: "Résumé",
    description: `View ${siteConfig.author}'s current PDF résumé directly in your browser.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
        title: `Résumé | ${siteConfig.author}`,
        description: "Read the current PDF résumé directly in your browser.",
        url: canonicalUrl,
        type: "profile",
    },
};

const actionClassName =
    "os-press inline-flex min-h-11 items-center justify-center gap-2 rounded-row border border-slate-300/80 bg-white/55 px-4 font-term text-xs font-bold text-slate-700 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))] dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-200";

export default async function ResumePage() {
    const profile = await getProfile();
    const viewUrl = resolveResumeAssetUrl(profile?.resumeUrl, "view");

    if (!viewUrl) {
        return (
            <main
                id="main-content"
                tabIndex={-1}
                className="mx-auto grid min-h-[calc(100svh-var(--site-header-height))] w-full max-w-3xl place-items-center px-5 py-12 sm:px-8"
            >
                <section className="os-card-flat w-full rounded-card p-6 text-center sm:p-10">
                    <span className="mx-auto grid size-12 place-items-center rounded-row border border-accent-soft bg-accent-soft text-accent">
                        <FileText className="size-5" aria-hidden />
                    </span>
                    <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
                        Résumé unavailable
                    </h1>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                        The PDF is temporarily unavailable. My work history and
                        experience are still available in the portfolio.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                        <Link
                            href="/portfolio"
                            className="os-press inline-flex min-h-11 items-center justify-center rounded-row bg-accent px-5 font-term text-xs font-bold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))]"
                        >
                            View portfolio
                        </Link>
                        <Link
                            href="/portfolio#contact"
                            className={actionClassName}
                        >
                            Say hello
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    const embeddedUrl = new URL(viewUrl);
    embeddedUrl.hash = "view=FitH&toolbar=1&navpanes=0";

    return (
        <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto flex min-h-[calc(100svh-var(--site-header-height))] w-full max-w-[100rem] flex-col px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
        >
            <section
                aria-labelledby="resume-heading"
                className="mb-3 flex flex-col gap-4 rounded-card border border-slate-300/70 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.035] sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
            >
                <div className="min-w-0">
                    <p className="font-term text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
                        Résumé / PDF
                    </p>
                    <h1
                        id="resume-heading"
                        className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl"
                    >
                        {siteConfig.author}
                    </h1>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        View the current résumé below or open it full screen.
                    </p>
                </div>

                <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
                    <a
                        href="/resume/view"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="os-press col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-row bg-accent px-4 font-term text-xs font-bold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgb(var(--c1))] sm:col-span-1"
                    >
                        <ExternalLink className="size-4" aria-hidden />
                        Open full screen
                    </a>
                    <a
                        href="/resume/download"
                        aria-label="Download résumé PDF"
                        className={actionClassName}
                    >
                        <Download className="size-4" aria-hidden />
                        Download
                    </a>
                    <ResumeShareAction canonicalUrl={canonicalUrl} />
                </div>
            </section>

            <section
                aria-label="PDF résumé viewer"
                className="min-h-0 flex-1 overflow-hidden rounded-card border border-slate-300/80 bg-slate-200 shadow-sm dark:border-white/10 dark:bg-slate-900"
            >
                <iframe
                    src={embeddedUrl.toString()}
                    title={`${siteConfig.author} résumé PDF`}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    className="block h-[max(38rem,calc(100svh-17rem))] w-full bg-slate-200 sm:h-[max(46rem,calc(100svh-13rem))] dark:bg-slate-900"
                />
            </section>

            <p className="mt-3 text-center font-term text-[0.68rem] leading-5 text-slate-500 dark:text-slate-400">
                If the embedded viewer is limited on your device, use Open full
                screen above. Downloading is optional.
            </p>
        </main>
    );
}
