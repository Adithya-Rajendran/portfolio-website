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
import Metrics from "@/components/ui/metrics";
import Pager from "@/components/ui/pager";
import Plate from "@/components/ui/plate";
import RouteList from "@/components/ui/route-list";
import Specs, { type SpecItem } from "@/components/ui/specs";
import ViewerFigure, {
    ViewerCallouts,
} from "@/components/viewer/viewer-figure";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { contentsHeadings, extractHeadings } from "@/lib/headings";
import { logEntries } from "@/lib/log-index";
import {
    adjacentMissions,
    essayShown,
    headStats,
    missionCallouts,
    missionEntries,
    missionLayout,
    noteLines,
    resultRows,
    toMission,
    writeUpHref,
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
import { shareImage } from "@/lib/site-metadata";
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
            images: [
                shareImage(
                    "app/(site)/portfolio/[slug]/opengraph-image.tsx",
                    `${project.title} by ${siteConfig.author}`,
                    slug,
                ),
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: project.title,
            description: project.summary,
        },
    };
}

/**
 * The facts under a head: the status note, the stack, the owner's role,
 * the named parameters the stack does not list and, on a note, the links.
 * Each row only when set.
 */
function factRows(mission: Mission, links: boolean): SpecItem[] {
    const f = copy.facts;
    return [
        ...(mission.statusNote
            ? [{ id: "status", term: f.status, value: mission.statusNote }]
            : []),
        ...(mission.technologies.length
            ? [
                  {
                      id: "stack",
                      term: f.stack,
                      value: (
                          <span className="data">
                              {mission.technologies.join(" · ")}
                          </span>
                      ),
                  },
              ]
            : []),
        ...(mission.role
            ? [{ id: "role", term: f.role, value: mission.role }]
            : []),
        ...mission.specs.map((spec) => ({
            id: `spec-${spec.id}`,
            term: spec.label,
            value: spec.value,
        })),
        ...(links && mission.links.length
            ? [
                  {
                      id: "links",
                      term: f.links,
                      value: (
                          <ul className={styles.factLinks} role="list">
                              {mission.links.map((link) => (
                                  <li key={link.id}>
                                      <a
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                      >
                                          {link.label}
                                          <Icon name="external" />
                                      </a>
                                  </li>
                              ))}
                          </ul>
                      ),
                  },
              ]
            : []),
    ];
}

/**
 * A project's page (G5, contract §9), in one of two layouts
 * (`missionLayout`):
 *
 * - **The file**, where there is evidence to lay out: the crumb (with the
 *   mission number, the file's quiet identifier), the head (line, name,
 *   title, summary, the way to the write-up, stats only when there is no
 *   results table, the facts) beside the photograph, then the brief, the
 *   results with their notes, the lessons and next steps, the model's
 *   callouts, the write-up, the links and the related entries, each only
 *   when the owner has published it.
 * - **The short note**, for a project with little more than its card:
 *   the title, the summary, the highlights that add to it, the essay only
 *   when it says more, and the facts with the links. No empty sections.
 *
 * Both close with the way to get in touch and to the neighbouring
 * projects. Server-rendered; PostReader keeps in-page links inside this
 * page while another is still mounted.
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
    const layout = missionLayout(project);
    const brief = [
        ["problem", project.brief?.problem],
        ["approach", project.brief?.approach],
        ["outcome", project.brief?.outcome],
    ].filter((row): row is [keyof typeof copy.brief, string] =>
        Boolean(row[1]?.trim()),
    );
    // The results carry their numbers with their notes, so the head sets
    // no stats beside them; the note column only when a row has a note.
    const results = resultRows(project.results);
    const stats = headStats(mission, results);
    const hasNotes = results.some((row) => row.note?.trim());
    const lessons = (project.lessons ?? []).filter((line) => line.trim());
    const nextSteps = (project.next ?? []).filter((line) => line.trim());
    // The essay (Case study) only when it says more than the card and the
    // brief; a note shows it on the same terms.
    const hasEssay = project.body?.length > 0 && essayShown(project);
    const contents = headings.length ? contentsHeadings(headings) : [];
    const writeUp = writeUpHref(mission, project, original);

    // The short note: the highlights that add to the summary.
    const lines = noteLines(mission.summary, mission.highlights);

    const essay = (
        <DocSection
            id="write-up"
            title={copy.writeUp}
            prose
            rail={
                contents.length > 1 ? (
                    <nav
                        className={styles.contents}
                        aria-label={copy.contentsLabel}
                        data-contents
                    >
                        <p className={styles.contentsTitle}>{copy.contents}</p>
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
    );

    return (
        <div data-page="mission" data-layout={layout} className={styles.page}>
            <BreadcrumbJsonLd
                items={[
                    { name: "Home", path: "/" },
                    { name: copy.plain, path: siteRoutes.portfolio },
                    { name: project.title, path: mission.href },
                ]}
            />
            <MissionJsonLd mission={mission} />

            <div className="shell">
                <CrumbRow
                    className={styles.crumb}
                    ornament="pulsar"
                    label={copy.plain}
                    href={siteRoutes.portfolio}
                    code={mission.designation}
                    name={mission.label}
                />

                {layout === "note" ? (
                    <header className={styles.noteHead}>
                        <MissionLine mission={mission} />
                        <h1 className={styles.noteTitle}>{mission.title}</h1>
                        {mission.summary ? (
                            <p className={styles.summary}>{mission.summary}</p>
                        ) : null}
                    </header>
                ) : (
                    <header
                        className={
                            hasPlate
                                ? styles.head
                                : `${styles.head} ${styles.headText}`
                        }
                    >
                        <div className={styles.headCopy}>
                            <MissionLine mission={mission} />
                            {mission.name ? (
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
                                    <span className={styles.dek}>
                                        {mission.title}
                                    </span>
                                </h1>
                            ) : (
                                <h1 className={styles.noteTitle}>
                                    {mission.title}
                                </h1>
                            )}
                            {mission.summary ? (
                                <p className={styles.summary}>
                                    {mission.summary}
                                </p>
                            ) : null}
                            {writeUp ? (
                                <div className={`cluster ${styles.actions}`}>
                                    {writeUp.startsWith("#") ||
                                    writeUp.startsWith(`${mission.href}#`) ? (
                                        <a
                                            className={buttonClass({
                                                variant: "primary",
                                            })}
                                            href="#write-up"
                                        >
                                            {copy.readWriteUp}
                                            <Icon name="arrow-down" />
                                        </a>
                                    ) : (
                                        <ButtonLink
                                            variant="primary"
                                            href={writeUp}
                                            icon="arrow"
                                            iconAt="end"
                                        >
                                            {copy.readWriteUp}
                                        </ButtonLink>
                                    )}
                                </div>
                            ) : null}
                            <Metrics
                                className={styles.metrics}
                                items={stats}
                                columns={hasPlate ? 2 : 4}
                                size={hasPlate ? "lg" : "md"}
                            />
                            <Specs
                                className={styles.facts}
                                items={factRows(mission, false)}
                            />
                        </div>
                        {hasPlate ? (
                            <div className={styles.headMedia}>
                                {model ? (
                                    <ViewerFigure model={model} priority />
                                ) : (
                                    <Plate
                                        image={cover}
                                        caption={cover?.caption}
                                        sizes="(min-width: 60rem) 36vw, 100vw"
                                        priority
                                    />
                                )}
                            </div>
                        ) : null}
                    </header>
                )}

                {layout === "note" ? (
                    <div className={styles.noteBody}>
                        {lines.length ? (
                            <ul className={styles.lines} role="list">
                                {lines.map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        ) : null}
                        <Specs
                            className={styles.facts}
                            items={factRows(mission, true)}
                        />
                    </div>
                ) : null}
            </div>

            {layout === "note" ? (
                <>
                    {hasEssay ? essay : null}
                    {related.length ? (
                        <DocSection id="related" title={copy.related}>
                            <LogIndex entries={related} level={3} />
                        </DocSection>
                    ) : null}
                </>
            ) : (
                <>
                    {brief.length ? (
                        <DocSection id="brief" title={copy.briefTitle}>
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

                    {results.length ? (
                        <DocSection id="results" title={copy.results}>
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
                                        {copy.resultsCaption(mission.title)}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">
                                                {copy.resultColumns.metric}
                                            </th>
                                            <th scope="col" className="num">
                                                {copy.resultColumns.value}
                                            </th>
                                            {hasNotes ? (
                                                <th scope="col">
                                                    {copy.resultColumns.note}
                                                </th>
                                            ) : null}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((row) => (
                                            <tr key={row._key}>
                                                <th scope="row">
                                                    {row.metric}
                                                </th>
                                                <td
                                                    className={`num ${styles.value}`}
                                                >
                                                    {row.value}
                                                </td>
                                                {hasNotes ? (
                                                    <td className={styles.note}>
                                                        {row.note}
                                                    </td>
                                                ) : null}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </DocSection>
                    ) : null}

                    {lessons.length || nextSteps.length ? (
                        <DocSection id="debrief" title={copy.debrief}>
                            <div className={styles.debrief}>
                                {lessons.length ? (
                                    <div>
                                        <h3 className={styles.subhead}>
                                            {copy.lessons}
                                        </h3>
                                        <ul
                                            className={styles.lessons}
                                            role="list"
                                        >
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

                    {callouts.length ? (
                        <DocSection
                            id="callouts"
                            title={
                                project.model?.title?.trim() || copy.callouts
                            }
                        >
                            <ViewerCallouts
                                callouts={callouts}
                                labelledBy="callouts-h"
                            />
                        </DocSection>
                    ) : null}

                    {hasEssay ? essay : null}

                    {mission.links.length ? (
                        <DocSection id="links" title={copy.links}>
                            <RouteList
                                labelledBy="links-h"
                                columns={2}
                                items={mission.links.map((link) => ({
                                    key: link.id,
                                    href: link.url,
                                    plain: link.label,
                                    blurb:
                                        link.host === link.label
                                            ? null
                                            : link.host,
                                    external: true,
                                }))}
                            />
                        </DocSection>
                    ) : null}

                    {related.length ? (
                        <DocSection id="related" title={copy.related}>
                            <LogIndex entries={related} level={3} />
                        </DocSection>
                    ) : null}
                </>
            )}

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
                                      label: copy.previousFile,
                                      title: previous.label,
                                  }
                                : null
                        }
                        all={{ href: siteRoutes.portfolio, label: copy.all }}
                        next={
                            next
                                ? {
                                      href: next.href,
                                      label: copy.nextFile,
                                      title: next.label,
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
