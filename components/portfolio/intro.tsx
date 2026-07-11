import Link from "next/link";
import { ArrowDown, FileText } from "lucide-react";
import type { ProfileData } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export default function Intro({
    profile,
    hasProjects,
}: {
    profile: ProfileData | null;
    hasProjects: boolean;
}) {
    return (
        <section id="home" className="scroll-mt-[100rem]">
            <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
                <p className="font-term text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    Portfolio
                </p>
                <h1 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                    Work and experience.
                </h1>
                <p className="mt-6 max-w-2xl font-display text-xl font-medium leading-snug text-slate-700 dark:text-slate-200 sm:text-2xl">
                    {profile?.headline || siteConfig.role}
                </p>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 text-pretty dark:text-slate-300 sm:text-lg">
                    {profile?.introduction ||
                        "A straightforward record of the roles, projects, skills, and certifications that make up my professional work."}
                </p>

                <div className="mt-9 flex flex-wrap gap-3">
                    <Link
                        href={hasProjects ? "#projects" : "#experience"}
                        className="os-press inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 font-term text-sm font-bold text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                    >
                        {hasProjects ? "View projects" : "View experience"}
                        <ArrowDown className="size-4" aria-hidden />
                    </Link>
                    {profile?.resumeUrl && (
                        <a
                            href="/resume"
                            className="os-press inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300/80 bg-white/50 px-5 font-term text-sm font-bold text-slate-700 transition-colors hover:border-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))] dark:border-white/12 dark:bg-white/[0.035] dark:text-slate-200"
                        >
                            Résumé
                            <FileText className="size-4" aria-hidden />
                        </a>
                    )}
                </div>
            </div>
        </section>
    );
}
