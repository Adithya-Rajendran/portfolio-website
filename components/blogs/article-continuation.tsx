import Link from "next/link";
import LogIndex from "@/components/blogs/log-index";
import { buttonClass } from "@/components/ui/button";
import { Icon, Patch } from "@/components/ui/icon";
import { Status, type StatusValue } from "@/components/ui/marks";
import Pager, { type PagerLink } from "@/components/ui/pager";
import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";
import { postCopy as copy } from "@/lib/copy";
import { formatMissionDesignation } from "@/lib/designations";
import type { LogEntry } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { formatProjectYears, projectStatusLabel } from "@/lib/project-content";
import { PROJECT_TYPES, type ProjectStatus } from "@/lib/project-fields";
import type { ExternalLink, ProjectListItem } from "@/lib/sanity-client";
import styles from "./post.module.css";

/**
 * After an entry (G1): the mission it belongs to (only when the owner
 * linked one), the entries filed just before and after it (the shared
 * `Pager`, only the sides that exist), other entries that share a tag
 * (only when there are any), and the author. Every block is
 * server-rendered links; empty blocks are left out. Ported from the
 * mockup's post.html `.post-end`.
 */

function statusValue(status: ProjectStatus): StatusValue {
    return status === "completed" ? "complete" : status;
}

function typeTitles(project: ProjectListItem): string {
    return (project.types ?? [])
        .map(
            (type) =>
                PROJECT_TYPES.find((option) => option.value === type)?.title ??
                type,
        )
        .join(" · ");
}

function MissionCard({ project }: { project: ProjectListItem }) {
    const years = formatProjectYears(project);
    const types = typeTitles(project);
    return (
        <article className={styles.msn}>
            <p className={styles.msnHead}>
                <span className={styles.msnCode}>
                    {formatMissionDesignation(project.designation)}
                </span>
                {types ? <span>{types}</span> : null}
                {project.status ? (
                    <Status value={statusValue(project.status)}>
                        {projectStatusLabel(project.status)}
                    </Status>
                ) : null}
                {years ? <span className="data">{years}</span> : null}
            </p>
            <h3 className={styles.msnTitle}>
                <Link className="stretch" href={`/portfolio/${project.slug}`}>
                    {project.title}
                </Link>
            </h3>
            {project.summary ? (
                <p className={styles.msnSummary}>{project.summary}</p>
            ) : null}
            <Icon name="arrow" className={styles.msnArrow} />
        </article>
    );
}

/** A neighbouring entry as a pager side: "Next entry · LOG 002". */
function pagerLink(
    entry: LogEntry | null,
    direction: "previous" | "next",
): PagerLink | null {
    if (!entry) return null;
    return {
        href: `/blog/${entry.slug}`,
        label: `${direction === "previous" ? copy.previous : copy.next} · ${entry.designation}`,
        title: entry.title,
        meta:
            [
                entry.publishedAt,
                entry.readMinutes ? `${entry.readMinutes} min` : null,
            ]
                .filter(Boolean)
                .join(" · ") || null,
    };
}

function Block({
    id,
    num,
    themed,
    plain,
    children,
}: {
    id: string;
    num: string;
    themed: string;
    plain: string;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.endSection}>
            <SectionTag num={num}>
                <h2 className="section-tag__h" id={id}>
                    <Pair themed={themed} plain={plain} />
                </h2>
            </SectionTag>
            {children}
        </div>
    );
}

export default function ArticleContinuation({
    missions,
    previous,
    next,
    related,
    author,
    className,
}: {
    missions: readonly ProjectListItem[];
    previous: LogEntry | null;
    next: LogEntry | null;
    related: readonly LogEntry[];
    author: {
        name: string;
        headline?: string | null;
        linkedIn?: ExternalLink | null;
    };
    className?: string;
}) {
    // § 01.1, 01.2 …: the blocks shown, numbered in order.
    const shown = [
        missions.length > 0 ? "mission" : null,
        previous || next ? "pager" : null,
        related.length > 0 ? "related" : null,
        "author",
    ].filter(Boolean);
    const num = (block: string) => `${copy.num}.${shown.indexOf(block) + 1}`;
    return (
        <section
            className={className}
            aria-label={copy.after}
            data-print="hide"
        >
            <div className={styles.end}>
                {missions.length > 0 ? (
                    <Block
                        id="entry-mission"
                        num={num("mission")}
                        themed={copy.missionThemed}
                        plain={copy.missionPlain(missions.length)}
                    >
                        <div className={styles.msns}>
                            {missions.map((project) => (
                                <MissionCard
                                    key={project._id}
                                    project={project}
                                />
                            ))}
                        </div>
                    </Block>
                ) : null}
                {previous || next ? (
                    <Block
                        id="entry-pager"
                        num={num("pager")}
                        themed={copy.pagerThemed}
                        plain={copy.pagerPlain}
                    >
                        <Pager
                            className={styles.pager}
                            label={copy.pagerPlain}
                            previous={pagerLink(previous, "previous")}
                            next={pagerLink(next, "next")}
                        />
                    </Block>
                ) : null}
                {related.length > 0 ? (
                    <Block
                        id="entry-related"
                        num={num("related")}
                        themed={copy.relatedThemed}
                        plain={copy.relatedPlain}
                    >
                        <LogIndex entries={related} level={3} />
                    </Block>
                ) : null}
                <Block
                    id="entry-author"
                    num={num("author")}
                    themed={copy.crewThemed}
                    plain={copy.crewPlain}
                >
                    <div className={styles.by}>
                        <Patch mark className={styles.byPatch} />
                        <div>
                            <p className={styles.byName}>
                                {copy.writtenBy}{" "}
                                <Link href={siteRoutes.about}>
                                    {author.name}
                                </Link>
                            </p>
                            {author.headline ? (
                                <p className={styles.byLine}>
                                    {author.headline}
                                </p>
                            ) : null}
                            <div className={`cluster ${styles.byLinks}`}>
                                <a
                                    className={buttonClass({ size: "sm" })}
                                    href={siteRoutes.feed}
                                >
                                    <Icon name="rss" />
                                    {copy.rss}
                                </a>
                                {author.linkedIn ? (
                                    <a
                                        className={buttonClass({ size: "sm" })}
                                        href={author.linkedIn.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {author.linkedIn.label}
                                        <Icon name="external" />
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </Block>
            </div>
        </section>
    );
}
