import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatProjectYears, projectStatusLabel } from "@/lib/project-content";
import type { ProjectListItem } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

export default function Project({ project }: { project: ProjectListItem }) {
    const coverUrl = project.cover?.asset
        ? urlForImage(project.cover)
              .width(1200)
              .height(720)
              .fit("crop")
              .auto("format")
              .url()
        : null;
    const years = formatProjectYears(project);
    return (
        <article className="career-project">
            {coverUrl && (
                <div className="career-project-image">
                    <Image
                        src={coverUrl}
                        alt={project.cover?.alt || ""}
                        fill
                        sizes="(max-width: 760px) calc(100vw - 46px), 430px"
                        className="object-cover"
                    />
                </div>
            )}
            <div className="career-meta">
                <span>{projectStatusLabel(project.status)}</span>
                {years && <span>{years}</span>}
            </div>
            <h3>
                <Link href={`/portfolio/${project.slug}`}>{project.title}</Link>
            </h3>
            <p className="career-summary">{project.summary}</p>
            {project.technologies?.length ? (
                <ul className="career-tags" aria-label="Technologies">
                    {project.technologies.slice(0, 6).map((technology) => (
                        <li key={technology}>{technology}</li>
                    ))}
                </ul>
            ) : null}
            <Link
                className="journal-link"
                href={`/portfolio/${project.slug}`}
                aria-label={`Read ${project.title}`}
            >
                Read the project <ArrowUpRight size={16} aria-hidden />
            </Link>
        </article>
    );
}
