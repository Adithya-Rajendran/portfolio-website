import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProjectListItem } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

const statusLabel: Record<ProjectListItem["status"], string> = {
    active: "Active",
    completed: "Completed",
    paused: "Paused",
    archived: "Archived",
};

export default function Project({ project }: { project: ProjectListItem }) {
    const coverUrl = project.cover?.asset
        ? urlForImage(project.cover)
              .width(1200)
              .height(720)
              .fit("crop")
              .auto("format")
              .url()
        : null;

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-card border border-slate-200/80 bg-white/55 dark:border-white/10 dark:bg-white/[0.035]">
            {coverUrl && (
                <div className="relative aspect-[5/3] overflow-hidden bg-slate-200/70 dark:bg-slate-900/70">
                    <Image
                        src={coverUrl}
                        alt={project.cover?.alt || ""}
                        fill
                        sizes="(max-width: 640px) calc(100vw - 2.5rem), (max-width: 1280px) 50vw, 600px"
                        className="object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.015]"
                    />
                </div>
            )}
            <div className="flex flex-1 flex-col p-6 sm:p-7">
                <div className="flex flex-wrap items-center gap-3 font-term text-[0.68rem] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                    <span className="text-accent">
                        {statusLabel[project.status]}
                    </span>
                    {project.startDate && (
                        <span>{project.startDate.slice(0, 4)}</span>
                    )}
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white">
                    {project.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {project.summary}
                </p>
                {project.technologies?.length ? (
                    <ul
                        className="mt-5 flex flex-wrap gap-2"
                        aria-label="Technologies"
                    >
                        {project.technologies.slice(0, 6).map((technology) => (
                            <li
                                key={technology}
                                className="rounded-full border border-slate-200/80 px-2.5 py-1 font-term text-[0.65rem] text-slate-500 dark:border-white/10 dark:text-slate-400"
                            >
                                {technology}
                            </li>
                        ))}
                    </ul>
                ) : null}
                <Link
                    href={`/portfolio/${project.slug}`}
                    className="os-press mt-6 inline-flex min-h-11 w-fit items-center gap-2 rounded-row font-term text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--c1))]"
                >
                    Read the project
                    <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                    />
                </Link>
            </div>
        </article>
    );
}
