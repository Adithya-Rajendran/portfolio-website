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
        <main
            id="main-content"
            tabIndex={-1}
            className="journal-page journal-container career-page career-case-study"
        >
            <article>
                <header className="career-case-heading">
                    <Link href="/portfolio#projects" className="journal-link">
                        <ArrowLeft size={16} aria-hidden />
                        Back to work
                    </Link>
                    <div className="career-meta">
                        <span>{statusLabel[project.status]}</span>
                        {dates && <span>{dates}</span>}
                    </div>
                    <h1 className="journal-title">{project.title}</h1>
                    <p className="journal-description">{project.summary}</p>
                    {project.technologies?.length ? (
                        <ul className="career-tags" aria-label="Technologies">
                            {project.technologies.map((technology) => (
                                <li key={technology}>{technology}</li>
                            ))}
                        </ul>
                    ) : null}
                </header>
                {coverUrl && (
                    <figure className="career-case-cover">
                        <Image
                            src={coverUrl}
                            alt={project.cover?.alt || ""}
                            width={project.cover?.dimensions?.width || 1600}
                            height={project.cover?.dimensions?.height || 960}
                            sizes="(max-width: 1200px) calc(100vw - 46px), 1116px"
                            className="career-case-image"
                            priority
                        />
                        {project.cover?.caption && (
                            <figcaption>{project.cover.caption}</figcaption>
                        )}
                    </figure>
                )}
                {project.highlights?.length ? (
                    <aside className="career-case-highlights">
                        <h2>At a glance</h2>
                        <ul className="career-highlights">
                            {project.highlights.map((highlight) => (
                                <li key={highlight}>{highlight}</li>
                            ))}
                        </ul>
                    </aside>
                ) : null}
                <ProjectEssay project={project} />
                {project.links?.length ? (
                    <footer className="career-case-links">
                        <h2>Explore further</h2>
                        <ul>
                            {project.links.map((link) => (
                                <li key={link._key}>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="career-channel"
                                    >
                                        {link.label}
                                        <ArrowUpRight size={16} aria-hidden />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </footer>
                ) : null}
            </article>
        </main>
    );
}
