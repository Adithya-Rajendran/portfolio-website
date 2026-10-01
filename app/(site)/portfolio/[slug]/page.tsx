import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LogIndex from "@/components/blogs/log-index";
import PostReader from "@/components/blogs/post-reader";
import { BreadcrumbJsonLd, MissionJsonLd } from "@/components/json-ld";
import MissionLine, { MissionStack } from "@/components/portfolio/mission-line";
import ProjectEssay from "@/components/portfolio/project-essay";
import CrumbRow from "@/components/ui/crumb-row";
import DocSection from "@/components/ui/doc-section";
import { Icon } from "@/components/ui/icon";
import { LinkArrow } from "@/components/ui/marks";
import Metrics from "@/components/ui/metrics";
import Pager from "@/components/ui/pager";
import Plate from "@/components/ui/plate";
import RouteList from "@/components/ui/route-list";
import Specs, { type SpecItem } from "@/components/ui/specs";
import ViewerFigure, {
    ViewerCallouts,
} from "@/components/viewer/viewer-figure";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy, pagerCopy } from "@/lib/copy";
import { contentsHeadings, extractHeadings } from "@/lib/headings";
import { logEntries } from "@/lib/log-index";
import {
    adjacentMissions,
    essayShown,
    headStats,
    missionCallouts,
    missionEntries,
    missionLayout,
    missionOrder,
    noteLines,
    resultRows,
    stackSaid,
    toMission,
    writeUpHref,
    type Mission,
    type MissionLink,
} from "@/lib/missions";
import { siteRoutes } from "@/lib/navigation";
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

/** How many links the facts carry before they get a section of their
 *  own ("References"). */
const FACT_LINKS = 2;

/** Links in a facts row, each with its outbound mark. */
function FactLinks({ links }: { links: readonly MissionLink[] }) {
    return (
        <ul className={styles.factLinks} role="list">
            {links.map((link) => (
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
    );
}

/**
 * The facts under a head: the status note, the stack (unless the words
 * on the page already name every item), the owner's role, the named
 * parameters the stack and the card do not name and, while there are no
 * more than two links in all, the links other than the repositories
 * (those are the head's actions). Each row only when set.
 */
function factRows(
    mission: Mission,
    { stack, links }: { stack: boolean; links: MissionLink[] },
): SpecItem[] {
    const f = copy.facts;
    return [
        ...(mission.statusNote
            ? [{ id: "status", term: f.status, value: mission.statusNote }]
            : []),
        ...(stack && mission.technologies.length
            ? [
                  {
                      id: "stack",
                      term: f.stack,
                      value: (
                          <MissionStack
                              items={mission.technologies}
                              label={f.stack}
                          />
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
        ...(links.length
            ? [
                  {
                      id: "links",
                      term: f.links,
                      value: <FactLinks links={links} />,
                  },
              ]
            : []),
    ];
}

/**
 * A project's page (G5, contract §9), in one of two layouts
 * (`missionLayout`):
 *
 * - **The file**, where there is evidence to lay out: the crumb (the
 *   section alone), the head (line, title, summary, the quiet links to
 *   the original entry and the repositories, stats only when there is no
 *   results table, the facts) beside the model's poster or the cover,
 *   then the overview, the results with their notes, the lessons and
 *   next steps, the parts of the build, the write-up, the references
 *   (past two links) and the other related entries, each only when the
 *   owner has published it.
 * - **The short note**, for a project with little more than its card:
 *   the title, the summary, the same quiet links, the highlights that add
 *   to it and the facts with the links (beside the cover, when it has
 *   one), then the essay only when it says more. No empty sections.
 *
 * The title is the heading, in sentence case; the owner's short name is
 * the pager's. Both end in space before the neighbouring projects, in
 * the index's order (the crumb leads back to all of them).
 * Server-rendered; PostReader keeps in-page links inside this page while
 * another is still mounted.
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
    const callouts = missionCallouts(project.model?.hotspots);
    const { previous, next } = adjacentMissions(
        missionOrder(projects).map((item) => toMission(item, siteConfig.url)),
        slug,
    );

    // The head's image: the model's poster (the viewer's slot), else the
    // cover, its caption set as its credit. Either layout sets it beside
    // the head.
    const model = project.model?.poster?.asset ? project.model : null;
    const media = model ? (
        <ViewerFigure model={model} priority />
    ) : mission.cover ? (
        <Plate
            image={mission.cover}
            credit={mission.cover.caption}
            sizes="(min-width: 60rem) 36vw, 100vw"
            priority
        />
    ) : null;
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
    // The head links the original entry quietly; the file's own write-up
    // is already on the page, so nothing points down to it.
    const writeUp = writeUpHref(mission, null, original);
    const code = mission.links.filter((link) => link.code);

    // The short note: the highlights that add to the summary.
    const lines = noteLines(mission.summary, mission.highlights);
    // The links: the repositories are the head's; the rest join the
    // facts while there are two links or fewer (always on a note), else
    // they are the References section.
    const others = mission.links.filter((link) => !link.code);
    const folded =
        layout === "note" || mission.links.length <= FACT_LINKS ? others : [];
    const references = folded.length ? [] : others;
    const facts = factRows(mission, {
        stack: !stackSaid(mission.technologies, [
            mission.title,
            mission.summary,
            ...(layout === "note" ? lines : []),
        ]),
        links: folded,
    });

    // The head's quiet links: the original entry and the repositories,
    // each underlined, the repositories with their outbound mark.
    const actions =
        writeUp || code.length ? (
            <div className={styles.actions}>
                {writeUp ? (
                    <LinkArrow href={writeUp}>{copy.readWriteUp}</LinkArrow>
                ) : null}
                {code.length ? <FactLinks links={code} /> : null}
            </div>
        ) : null;

    // The short note: its line, title, summary and quiet links, then the
    // highlights that add to the summary (one is a plain paragraph) and
    // the facts.
    const noteHead = (
        <>
            <MissionLine mission={mission} />
            <h1 className={styles.title}>{mission.title}</h1>
            {mission.summary ? (
                <p className={styles.summary}>{mission.summary}</p>
            ) : null}
            {actions}
        </>
    );
    const noteBody = (
        <div className={styles.noteBody}>
            {lines.length > 1 ? (
                <ul className={styles.lines} role="list">
                    {lines.map((line) => (
                        <li key={line}>{line}</li>
                    ))}
                </ul>
            ) : lines.length ? (
                <p className={styles.line}>{lines[0]}</p>
            ) : null}
            <Specs className={styles.facts} items={facts} />
        </div>
    );

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
        <div data-page="mission" data-layout={layout}>
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
                    label={copy.plain}
                    href={siteRoutes.portfolio}
                />

                {layout === "note" ? (
                    media ? (
                        <header className={styles.head}>
                            <div className={styles.headCopy}>
                                {noteHead}
                                {noteBody}
                            </div>
                            <div className={styles.headMedia}>{media}</div>
                        </header>
                    ) : (
                        <>
                            <header className={styles.noteHead}>
                                {noteHead}
                            </header>
                            {noteBody}
                        </>
                    )
                ) : (
                    <header
                        className={
                            media
                                ? styles.head
                                : `${styles.head} ${styles.headText}`
                        }
                    >
                        <div className={styles.headCopy}>
                            <MissionLine mission={mission} />
                            <h1 className={styles.title}>{mission.title}</h1>
                            {mission.summary ? (
                                <p className={styles.summary}>
                                    {mission.summary}
                                </p>
                            ) : null}
                            {actions}
                            <Metrics
                                className={styles.metrics}
                                items={stats}
                                columns={media ? 2 : 4}
                                size={media ? "lg" : "md"}
                            />
                            <Specs className={styles.facts} items={facts} />
                        </div>
                        {media ? (
                            <div className={styles.headMedia}>{media}</div>
                        ) : null}
                    </header>
                )}
            </div>

            {layout === "note" ? (
                <>
                    {hasEssay ? essay : null}
                    {related.length ? (
                        <DocSection id="related" title={copy.related}>
                            <LogIndex
                                entries={related}
                                level={3}
                                tags={false}
                            />
                        </DocSection>
                    ) : null}
                </>
            ) : (
                <>
                    {brief.length ? (
                        <DocSection id="brief" title={copy.overview}>
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
                            {/* The section is the region; the table is
                                named by its heading, opens on its first
                                row (the column heads are for screen
                                readers) and reflows on phones instead of
                                scrolling. */}
                            <div className={`table-wrap ${styles.results}`}>
                                <table
                                    className="table"
                                    aria-labelledby="results-h"
                                >
                                    <thead className={styles.columns}>
                                        <tr>
                                            <th scope="col">
                                                <span className="sr-only">
                                                    {copy.resultColumns.metric}
                                                </span>
                                            </th>
                                            <th scope="col">
                                                <span className="sr-only">
                                                    {copy.resultColumns.value}
                                                </span>
                                            </th>
                                            {hasNotes ? (
                                                <th scope="col">
                                                    <span className="sr-only">
                                                        {
                                                            copy.resultColumns
                                                                .note
                                                        }
                                                    </span>
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

                    {/* One list is titled by its name; both share a
                        plain title, each under its subhead. */}
                    {lessons.length && nextSteps.length ? (
                        <DocSection id="debrief" title={copy.retrospective}>
                            <div className={styles.debrief}>
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
                                <div>
                                    <h3 className={styles.subhead}>
                                        {copy.nextSteps}
                                    </h3>
                                    <ul className={styles.lessons} role="list">
                                        {nextSteps.map((line) => (
                                            <li key={line}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </DocSection>
                    ) : lessons.length || nextSteps.length ? (
                        <DocSection
                            id="debrief"
                            title={
                                lessons.length ? copy.lessons : copy.nextSteps
                            }
                        >
                            <ul
                                className={`${styles.lessons} ${styles.single}`}
                                role="list"
                            >
                                {[...lessons, ...nextSteps].map((line) => (
                                    <li key={line}>{line}</li>
                                ))}
                            </ul>
                        </DocSection>
                    ) : null}

                    {callouts.length ? (
                        <DocSection id="callouts" title={copy.callouts}>
                            <ViewerCallouts
                                callouts={callouts}
                                labelledBy="callouts-h"
                            />
                        </DocSection>
                    ) : null}

                    {hasEssay ? essay : null}

                    {references.length ? (
                        <DocSection id="links" title={copy.references}>
                            <RouteList
                                labelledBy="links-h"
                                columns={2}
                                items={references.map((link) => ({
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
                            <LogIndex
                                entries={related}
                                level={3}
                                tags={false}
                            />
                        </DocSection>
                    ) : null}
                </>
            )}

            {previous || next ? (
                <div className="section" data-print="hide">
                    <div className="shell">
                        <Pager
                            label={copy.pagerLabel}
                            previous={
                                previous
                                    ? {
                                          href: previous.href,
                                          label: pagerCopy.previous,
                                          title: previous.label,
                                      }
                                    : null
                            }
                            next={
                                next
                                    ? {
                                          href: next.href,
                                          label: pagerCopy.next,
                                          title: next.label,
                                      }
                                    : null
                            }
                        />
                    </div>
                </div>
            ) : null}

            <PostReader />
        </div>
    );
}
