import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectEssay from "@/components/portfolio/project-essay";
import {
    getAllProjectSlugs,
    getProjectBySlug,
    type ProjectListItem,
} from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";
import { siteConfig } from "@/lib/config";
import { TerminalRoute } from "@/components/terminal/terminal-route";

const statusLabel: Record<ProjectListItem["status"], string> = {
    active: "Active",
    completed: "Completed",
    paused: "Paused",
    archived: "Archived",
};

function yearRange(start?: string | null, end?: string | null) {
    if (!start && !end) return null;
    const startYear = start?.slice(0, 4);
    const endYear = end?.slice(0, 4);
    if (!startYear) return endYear;
    if (!endYear || startYear === endYear) return startYear;
    return `${startYear}–${endYear}`;
}

export async function generateStaticParams() {
    const slugs = await getAllProjectSlugs();
    return (slugs.length ? slugs : ["placeholder"]).map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) return;

    const coverUrl = project.cover?.asset
        ? urlForImage(project.cover)
              .width(1200)
              .height(630)
              .fit("crop")
              .auto("format")
              .url()
        : null;

    return {
        title: project.title,
        description: project.summary,
        alternates: { canonical: `${siteConfig.url}/portfolio/${slug}` },
        openGraph: {
            title: project.title,
            description: project.summary,
            url: `${siteConfig.url}/portfolio/${slug}`,
            ...(coverUrl ? { images: [{ url: coverUrl }] } : {}),
        },
    };
}

export default async function ProjectPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();

    const coverUrl = project.cover?.asset
        ? urlForImage(project.cover).width(1600).fit("max").auto("format").url()
        : null;
    const dates = yearRange(project.startDate, project.endDate);

    return (
        <main id="main-content" tabIndex={-1}>
            <TerminalRoute path="~/portfolio" command="cat project.md">
                <article>
                    <header className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8 sm:pb-16">
                        <Link
                            href="/portfolio#projects"
                            className="os-press inline-flex min-h-11 items-center gap-2 rounded-row font-term text-xs font-semibold text-slate-600 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-300"
                        >
                            <ArrowLeft className="size-4" aria-hidden />
                            Portfolio
                        </Link>
                        <div className="mt-8">
                            <div className="flex flex-wrap gap-3 font-term text-xs uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                <span className="text-accent">
                                    {statusLabel[project.status]}
                                </span>
                                {dates && <span>{dates}</span>}
                            </div>
                            <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-slate-950 text-balance dark:text-white sm:text-6xl lg:text-7xl">
                                {project.title}
                            </h1>
                            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
                                {project.summary}
                            </p>

                            {project.technologies?.length ? (
                                <ul
                                    className="mt-7 flex flex-wrap gap-2"
                                    aria-label="Technologies"
                                >
                                    {project.technologies.map((technology) => (
                                        <li
                                            key={technology}
                                            className="rounded-full border border-slate-200/80 px-3 py-1.5 font-term text-[0.7rem] text-slate-600 dark:border-white/10 dark:text-slate-300"
                                        >
                                            {technology}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    </header>

                    {coverUrl && (
                        <figure className="mx-auto mb-14 w-full max-w-6xl px-5 sm:px-8">
                            <Image
                                src={coverUrl}
                                alt={project.cover?.alt || ""}
                                width={1600}
                                height={960}
                                sizes="(max-width: 1200px) 100vw, 1152px"
                                className="h-auto w-full rounded-card border border-slate-200/80 object-cover dark:border-white/10"
                                priority
                            />
                            {project.cover?.caption && (
                                <figcaption className="mt-3 text-center text-sm italic text-slate-500 dark:text-slate-400">
                                    {project.cover.caption}
                                </figcaption>
                            )}
                        </figure>
                    )}

                    {project.highlights?.length ? (
                        <aside className="mx-auto mb-14 max-w-[45.5rem] border-y border-slate-300/70 px-5 py-7 dark:border-white/10 sm:px-8">
                            <h2 className="font-term text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                                Highlights
                            </h2>
                            <ul className="mt-4 space-y-3">
                                {project.highlights.map((highlight) => (
                                    <li
                                        key={highlight}
                                        className="relative pl-5 text-sm leading-7 text-slate-700 before:absolute before:left-0 before:top-[0.7rem] before:size-1.5 before:rounded-full before:bg-accent dark:text-slate-300"
                                    >
                                        {highlight}
                                    </li>
                                ))}
                            </ul>
                        </aside>
                    ) : null}

                    <ProjectEssay project={project} />

                    {project.links?.length ? (
                        <footer className="mx-auto mb-24 max-w-[45.5rem] px-5 sm:px-8">
                            <h2 className="font-display text-2xl font-semibold text-slate-950 dark:text-white">
                                Links
                            </h2>
                            <ul className="mt-4 border-t border-slate-300/70 dark:border-white/10">
                                {project.links.map((link) => (
                                    <li
                                        key={link._key}
                                        className="border-b border-slate-300/70 dark:border-white/10"
                                    >
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group flex min-h-14 items-center justify-between gap-4 font-term text-sm font-semibold text-slate-700 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[rgb(var(--c1))] dark:text-slate-200"
                                        >
                                            {link.label}
                                            <ArrowUpRight
                                                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                                aria-hidden
                                            />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </footer>
                    ) : null}
                </article>
            </TerminalRoute>
        </main>
    );
}
