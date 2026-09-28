import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LogIndex from "@/components/blogs/log-index";
import PostReader from "@/components/blogs/post-reader";
import { BreadcrumbJsonLd, MissionJsonLd } from "@/components/json-ld";
import MissionLine from "@/components/portfolio/mission-line";
import ProjectEssay from "@/components/portfolio/project-essay";
import Ask from "@/components/ui/ask";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import CrumbRow from "@/components/ui/crumb-row";
import DocSection from "@/components/ui/doc-section";
import { Icon } from "@/components/ui/icon";
import { Rev, Status } from "@/components/ui/marks";
import Metrics from "@/components/ui/metrics";
import Pager from "@/components/ui/pager";
import Plate from "@/components/ui/plate";
import RouteList from "@/components/ui/route-list";
import Specs from "@/components/ui/specs";
import TitleBlock, { type TitleBlockCell } from "@/components/ui/title-block";
import ViewerFigure, {
    ViewerCallouts,
} from "@/components/viewer/viewer-figure";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { contentsHeadings, extractHeadings } from "@/lib/headings";
import { logEntries } from "@/lib/log-index";
import {
    adjacentMissions,
    missionCallouts,
    missionEntries,
    toMission,
    type Mission,
} from "@/lib/missions";
import { contactHref, siteRoutes } from "@/lib/navigation";
import {
    getAllPosts,
    getAllProjects,
    getAllProjectSlugs,
    getPostsByProject,
    getProjectBySlug,
} from "@/lib/sanity-client";
import styles from "./mission.module.css";

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
    const url = `${siteConfig.url}/portfolio/${slug}`;
    return {
        title: project.title,
        description: project.summary,
        alternates: { canonical: url },
        openGraph: {
            title: project.title,
            description: project.summary,
            url,
        },
        twitter: {
            card: "summary_large_image",
            title: project.title,
            description: project.summary,
        },
    };
}

/** The drawing's title block (G6): the mission's record, set cells only. */
function recordCells(mission: Mission): TitleBlockCell[] {
    const r = copy.record;
    const first: TitleBlockCell[] = [
        {
            id: "mission",
            label: r.mission,
            value: (
                <>
                    <span className="data">{mission.designation}</span> ·{" "}
                    {mission.name}
                </>
            ),
            accent: true,
        },
        {
            id: "status",
            label: r.status,
            value: (
                <Status value={mission.statusValue}>
                    {mission.statusLabel}
                </Status>
            ),
            note: mission.statusNote,
            spanSm: 1,
        },
        ...(mission.types.length
            ? [
                  {
                      id: "type",
                      label: r.type,
                      value: mission.types.join(" · "),
                      spanSm: 1 as const,
                  },
              ]
            : []),
        ...(mission.dates
            ? [
                  {
                      id: "dates",
                      label: r.dates,
                      value: mission.dates,
                      data: true,
                  },
              ]
            : []),
    ];
    const second: TitleBlockCell[] = [
        ...(mission.role
            ? [{ id: "role", label: r.role, value: mission.role }]
            : []),
        ...(mission.technologies.length
            ? [
                  {
                      id: "stack",
                      label: r.stack,
                      value: mission.technologies.join(" · "),
                  },
              ]
            : []),
        ...(mission.revised
            ? [
                  {
                      id: "revision",
                      label: r.revision,
                      value: <Rev date={mission.revised} />,
                  },
              ]
            : []),
    ];
    // Each row fills the twelve columns: the mission and the stack take
    // what the short cells leave.
    const firstSpans = first.length === 4 ? [4, 2, 3, 3] : [5, 3, 4];
    first.forEach((cell, index) => {
        cell.span = first.length === 2 ? [7, 5][index] : firstSpans[index];
    });
    const fixed = second.filter((cell) => cell.id !== "stack");
    second.forEach((cell) => {
        cell.span =
            cell.id === "stack"
                ? 12 - fixed.length * 3
                : second.length === 1
                  ? 12
                  : second.some((item) => item.id === "stack")
                    ? 3
                    : 6;
    });
    return [...first, ...second];
}

/**
 * A mission file (G5, G6): the crumb, the head (line, name, title,
 * summary, the way to the write-up and its original entry, the stats)
 * beside the photograph, the title block, then the callouts, the brief,
 * the write-up, the results, the debrief, the links and the related
 * entries, each only when the owner has published it, and the way to get
 * in touch and to the neighbouring files. Server-rendered; PostReader
 * keeps in-page links inside this file while another is still mounted.
 */
export default async function ProjectPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    if (!project) notFound();
    const [projects, posts, citing] = await Promise.all([
        getAllProjects(),
        getAllPosts(),
        getPostsByProject(project._id),
    ]);

    const mission = toMission(project, siteConfig.url);
    const entries = logEntries(posts);
    const postIds = new Map(posts.map((post) => [post._id, post.slug]));
    const headings = extractHeadings(project);
    const { original, related } = missionEntries({
        entries,
        postIds,
        referencing: citing.map((post) => post.slug),
        links: project.links,
        body: project.body,
        hotspots: project.model?.hotspots,
        siteUrl: siteConfig.url,
    });
    const callouts = missionCallouts({
        hotspots: project.model?.hotspots,
        entries,
        postIds,
        essayHeadings: new Set(headings.map((heading) => heading.id)),
    });
    const { previous, next } = adjacentMissions(
        projects.map((item) => toMission(item, siteConfig.url)),
        slug,
    );

    const model = project.model?.poster?.asset ? project.model : null;
    const cover = project.cover?.asset ? project.cover : null;
    const hasPlate = Boolean(model || cover);
    const brief = [
        ["problem", project.brief?.problem],
        ["approach", project.brief?.approach],
        ["outcome", project.brief?.outcome],
    ].filter((row): row is [keyof typeof copy.brief, string] =>
        Boolean(row[1]?.trim()),
    );
    const results = (project.results ?? []).filter(
        (row) => row.metric?.trim() && row.value?.trim(),
    );
    const lessons = (project.lessons ?? []).filter((line) => line.trim());
    const nextSteps = (project.next ?? []).filter((line) => line.trim());
    const hasEssay = project.body?.length > 0;
    const contents = headings.length ? contentsHeadings(headings) : [];

    // Sections are numbered in the order they appear; an empty one is
    // absent, and so is its number.
    const present = [
        callouts.length ? "callouts" : null,
        brief.length ? "brief" : null,
        hasEssay ? "write-up" : null,
        results.length ? "results" : null,
        lessons.length || nextSteps.length ? "debrief" : null,
        mission.links.length ? "links" : null,
        related.length ? "related" : null,
    ].filter(Boolean);
    const num = (id: string) => `${copy.num}.${present.indexOf(id) + 1}`;

    return (
        <div data-page="mission" className={styles.page}>
            <BreadcrumbJsonLd
                items={[
                    { name: "Home", path: "/" },
                    { name: copy.themed, path: siteRoutes.portfolio },
                    { name: project.title, path: mission.href },
                ]}
            />
            <MissionJsonLd mission={mission} />

            <div className="shell">
                <CrumbRow
                    className={styles.crumb}
                    ornament="pulsar"
                    num={copy.num}
                    themed={copy.themed}
                    plain={copy.plain}
                    href={siteRoutes.portfolio}
                    name={mission.name}
                />

                <header
                    className={
                        hasPlate
                            ? styles.head
                            : `${styles.head} ${styles.headText}`
                    }
                >
                    <div className={styles.headCopy}>
                        <MissionLine mission={mission} />
                        <h1
                            className={styles.title}
                            style={
                                {
                                    "--chars": mission.nameChars,
                                } as CSSProperties
                            }
                        >
                            {mission.name}
                            <span className="sr-only">: </span>
                            <span className={styles.dek}>{mission.title}</span>
                        </h1>
                        {mission.summary ? (
                            <p className={styles.summary}>{mission.summary}</p>
                        ) : null}
                        {hasEssay || original ? (
                            <div className={`cluster ${styles.actions}`}>
                                {hasEssay ? (
                                    <a
                                        className={buttonClass({
                                            variant: "primary",
                                        })}
                                        href="#write-up"
                                    >
                                        {copy.readWriteUp}
                                        <Icon name="arrow-down" />
                                    </a>
                                ) : null}
                                {original ? (
                                    <ButtonLink
                                        href={`/blog/${original.slug}`}
                                        icon="arrow"
                                        iconAt="end"
                                    >
                                        {copy.originalEntry(
                                            original.designation,
                                        )}
                                    </ButtonLink>
                                ) : null}
                            </div>
                        ) : null}
                        <Metrics
                            className={styles.metrics}
                            items={mission.parameters}
                            columns={hasPlate ? 2 : 4}
                            size={hasPlate ? "lg" : "md"}
                        />
                    </div>
                    {hasPlate ? (
                        <div className={styles.headMedia}>
                            {model ? (
                                <ViewerFigure
                                    model={model}
                                    designation={mission.designation}
                                    priority
                                />
                            ) : (
                                <Plate
                                    image={cover}
                                    label="Pl. I"
                                    tag={mission.designation}
                                    caption={cover?.caption}
                                    sizes="(min-width: 60rem) 36vw, 100vw"
                                    priority
                                />
                            )}
                        </div>
                    ) : null}
                </header>

                <TitleBlock
                    className={styles.record}
                    cells={recordCells(mission)}
                />
            </div>

            {callouts.length ? (
                <DocSection
                    id="callouts"
                    num={num("callouts")}
                    themed={copy.calloutsThemed}
                    plain={project.model?.title?.trim() || copy.calloutsPlain}
                >
                    <ViewerCallouts
                        callouts={callouts}
                        labelledBy="callouts-h"
                    />
                </DocSection>
            ) : null}

            {brief.length ? (
                <DocSection
                    id="brief"
                    num={num("brief")}
                    themed={copy.briefThemed}
                    plain={copy.briefPlain}
                >
                    <Specs
                        className={`specs--read ${styles.brief}`}
                        items={brief.map(([key, text]) => ({
                            id: key,
                            term: copy.brief[key],
                            value: text.trim(),
                        }))}
                    />
                </DocSection>
            ) : null}

            {hasEssay ? (
                <DocSection
                    id="write-up"
                    num={num("write-up")}
                    themed={copy.writeUpThemed}
                    plain={copy.writeUpPlain}
                    prose
                    rail={
                        contents.length > 1 ? (
                            <nav
                                className={styles.contents}
                                aria-label={copy.contentsLabel}
                                data-contents
                            >
                                <p className={styles.contentsTitle}>
                                    {copy.contents}
                                </p>
                                <ol role="list">
                                    {contents.map((heading) => (
                                        <li key={heading.id}>
                                            <a href={`#${heading.id}`}>
                                                {heading.text}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </nav>
                        ) : undefined
                    }
                >
                    <ProjectEssay project={project} />
                </DocSection>
            ) : null}

            {results.length ? (
                <DocSection
                    id="results"
                    num={num("results")}
                    themed={copy.resultsThemed}
                    plain={copy.resultsPlain}
                    meta={copy.table}
                >
                    <div
                        className={`table-wrap ${styles.results}`}
                        role="region"
                        aria-labelledby="results-cap"
                        tabIndex={0}
                    >
                        <table className="table">
                            <caption id="results-cap">
                                <span className="caption__num">
                                    {copy.table}
                                </span>
                                {copy.resultsCaption(mission.name)}
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col">
                                        {copy.resultColumns.metric}
                                    </th>
                                    <th scope="col" className="num">
                                        {copy.resultColumns.value}
                                    </th>
                                    <th scope="col">
                                        {copy.resultColumns.note}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((row) => (
                                    <tr key={row._key}>
                                        <th scope="row">{row.metric}</th>
                                        <td className={`num ${styles.value}`}>
                                            {row.value}
                                        </td>
                                        <td className={styles.note}>
                                            {row.note}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DocSection>
            ) : null}

            {lessons.length || nextSteps.length ? (
                <DocSection
                    id="debrief"
                    num={num("debrief")}
                    themed={copy.debriefThemed}
                    plain={copy.debriefPlain}
                >
                    <div className={styles.debrief}>
                        {lessons.length ? (
                            <div>
                                <h3 className={styles.subhead}>
                                    {copy.lessons}
                                </h3>
                                <ul className={styles.lessons} role="list">
                                    {lessons.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {nextSteps.length ? (
                            <div>
                                <h3 className={styles.subhead}>
                                    {copy.nextSteps}
                                </h3>
                                <ul className={styles.next} role="list">
                                    {nextSteps.map((line) => (
                                        <li key={line}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                </DocSection>
            ) : null}

            {mission.links.length ? (
                <DocSection
                    id="links"
                    num={num("links")}
                    themed={copy.linksThemed}
                    plain={copy.linksPlain}
                >
                    <RouteList
                        labelledBy="links-h"
                        columns={2}
                        items={mission.links.map((link, index) => ({
                            key: link.id,
                            href: link.url,
                            num: String(index + 1).padStart(2, "0"),
                            plain: link.label,
                            blurb: link.host === link.label ? null : link.host,
                            external: true,
                        }))}
                    />
                </DocSection>
            ) : null}

            {related.length ? (
                <DocSection
                    id="related"
                    num={num("related")}
                    themed={copy.relatedThemed}
                    plain={copy.relatedPlain}
                >
                    <LogIndex entries={related} level={3} />
                </DocSection>
            ) : null}

            <section
                className="section"
                aria-labelledby="mission-close-h"
                data-print="hide"
            >
                <div className="shell">
                    <Ask id="mission-close-h" title={copy.question}>
                        <ButtonLink
                            href={contactHref("hello")}
                            icon="arrow"
                            iconAt="end"
                        >
                            {copy.getInTouch}
                        </ButtonLink>
                    </Ask>
                    <Pager
                        className={styles.pager}
                        label={copy.pagerLabel}
                        previous={
                            previous
                                ? {
                                      href: previous.href,
                                      label: `${copy.previousFile} · ${previous.designation}`,
                                      title: previous.name,
                                  }
                                : null
                        }
                        all={{ href: siteRoutes.portfolio, label: copy.all }}
                        next={
                            next
                                ? {
                                      href: next.href,
                                      label: `${copy.nextFile} · ${next.designation}`,
                                      title: next.name,
                                  }
                                : null
                        }
                    />
                </div>
            </section>

            <PostReader />
        </div>
    );
}
