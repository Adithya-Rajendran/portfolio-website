import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { CvItem, CvList } from "@/components/cv/cv-list";
import OrbitInteraction from "@/components/orbit/orbit-interaction";
import OrbitMap from "@/components/orbit/orbit-map";
import Availability from "@/components/ui/availability";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LinkArrow, Rev, Status, Updated } from "@/components/ui/marks";
import DocSection from "@/components/ui/doc-section";
import PageHead from "@/components/ui/page-head";
import Segmented from "@/components/ui/segmented";
import Specs from "@/components/ui/specs";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { cvCopy as copy, orbitCopy } from "@/lib/copy";
import {
    cvCredentials,
    cvEntries,
    cvProjects,
    cvTalks,
    hostOf,
    type CvCredential,
    type CvEntry,
} from "@/lib/cv";
import { formatEntryDate, logEntries } from "@/lib/log-index";
import { contactHref, siteRoutes } from "@/lib/navigation";
import { orbitModel } from "@/lib/orbit/geometry";
import { availabilityLine, getProfileLink } from "@/lib/profile-content";
import { resolveResumeAssetUrl } from "@/lib/resume";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    type ProfileData,
} from "@/lib/sanity-client";
import { splitTitle } from "@/lib/trajectory";
import styles from "./resume.module.css";

const canonicalUrl = `${siteConfig.url}${siteRoutes.resume}`;
const title = copy.plain;

function summaryOf(profile: ProfileData | null): string | null {
    return profile?.workSummary?.trim() || null;
}

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = summaryOf(profile) ?? copy.description;
    return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `${title} | ${name}`,
            description,
            url: canonicalUrl,
            type: "profile",
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            description,
        },
    };
}

/** The latest entries Writing & talks lists; /blog has them all, and
 *  All writing shows only when it has more. */
const WRITING_ROWS = 3;

/**
 * A CV section: the shared section head (DocSection: the full-width tag
 * row with its plain name), then the rows in the main column. On paper
 * the head prints the same name in capitals over a rule.
 */
function CvSection({
    id,
    title,
    after,
    print = true,
    children,
}: {
    id: string;
    title: React.ReactNode;
    after?: React.ReactNode;
    /** False leaves the section off the paper. */
    print?: boolean;
    children: React.ReactNode;
}) {
    return (
        <DocSection
            className={`section--tight ${styles.cv}`}
            id={id}
            title={title}
            data={{ "data-print": print ? undefined : "hide" }}
        >
            {children}
            {after ? <div className={styles.after}>{after}</div> : null}
        </DocSection>
    );
}

/** The printed document's control line, at the top of each sheet (G3). */
function SheetHead({
    sheet,
    sheets,
    rev,
}: {
    sheet: number;
    sheets: number;
    rev: string | null;
}) {
    return (
        <p className={styles.sheetHead}>
            <span className={styles.sheetDoc}>
                {copy.document} · {copy.documentTitle}
            </span>
            <span className={styles.sheetRev}>
                {rev ? (
                    <>
                        <Rev date={rev} />
                        <span aria-hidden="true"> · </span>
                    </>
                ) : null}
                {copy.sheet(sheet, sheets)}
            </span>
        </p>
    );
}

/**
 * Items on one line where they fit, each kept whole: a wrapped line never
 * breaks inside an address or an opening, and never starts with a
 * separator (the dot stays with the item before it).
 */
function Unbroken({ items }: { items: readonly string[] }) {
    return items.map((item, index) => (
        <Fragment key={item}>
            {index ? " " : null}
            <span className={styles.whole}>
                {item}
                {index < items.length - 1 ? "\u00a0·" : null}
            </span>
        </Fragment>
    ));
}

/**
 * A short list on the CV's columns: a date in the mono column, then a
 * line (the latest writing, the certifications).
 */
function PlainRows({
    rows,
}: {
    rows: readonly {
        id: string;
        date: React.ReactNode;
        line: React.ReactNode;
    }[];
}) {
    return (
        <ol className={styles.rows} role="list">
            {rows.map((row) => (
                <li className={styles.row} key={row.id}>
                    <span className={styles.rowDate}>{row.date}</span>
                    <span>{row.line}</span>
                </li>
            ))}
        </ol>
    );
}

/**
 * A credential's plain row: the span (or the issue date), then the name,
 * linked to its verification page when the record has one, and the
 * issuer. The outbound mark and the issuer are kept on the name's last
 * word, so a wrapped line never starts with the mark or a dot.
 */
function credentialRow(credential: CvCredential) {
    const at = credential.title.lastIndexOf(" ") + 1;
    return {
        id: credential.id,
        date: credential.dates,
        line: (
            <>
                {credential.url ? (
                    <a
                        href={credential.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {credential.title.slice(0, at)}
                        <span className={styles.whole}>
                            {credential.title.slice(at)}
                            <Icon name="external" />
                        </span>
                    </a>
                ) : (
                    credential.title
                )}
                {credential.issuer ? (
                    <span className={styles.rowAside}>
                        {"\u00a0·\u00a0"}
                        {credential.issuer}
                    </span>
                ) : null}
            </>
        ),
    };
}

/**
 * Trajectory · Experience / CV (G2, G3): the CV first, as a list a hiring
 * reader can scan (education, experience, projects, writing and talks,
 * skills, certifications), under the head with what the owner is open to,
 * the PDF and the way to get in touch. The time-scaled orbit map with its
 * record panel is the optional Timeline view, and the flight
 * (/resume/trajectory) is one quiet link beside it. The PDF is
 * downloadable, and the browser's Print gives the two-sheet controlled
 * document. Everything is server-rendered: without JavaScript the list
 * shows and the map opens from its link (`#orbit-map`), its labels
 * linking to the CV rows; with it, `OrbitInteraction` runs the view
 * switch, previews, pins and cross-lights map and list. There is no
 * email address or phone number, on screen or on paper.
 */
export default async function ResumePage() {
    const [profile, projects, posts, today] = await Promise.all([
        getProfile(),
        getAllProjects(),
        getAllPosts(),
        getToday(),
    ]);
    const name = profile?.name || siteConfig.author;
    const hasPdf = Boolean(resolveResumeAssetUrl(profile?.resumeUrl, "view"));
    // The résumé's upload date: "Updated …" on screen, the revision on
    // paper.
    const rev =
        hasPdf && /^\d{4}-\d{2}-\d{2}/.test(profile?.resumeUploadedAt ?? "")
            ? profile!.resumeUploadedAt!.slice(0, 10)
            : null;
    const summary = summaryOf(profile);
    const availability = profile?.availability;
    const openTo = availabilityLine(availability);

    const timeline = cvEntries(profile?.timeline);
    const model = orbitModel({
        entries: timeline.all.map((entry) => entry.orbit),
        today,
        plannedFrom: openTo ? availability?.from : null,
    });
    const numbers = new Map(
        model?.orbits.map((orbit) => [orbit.id, orbit.number]) ?? [],
    );
    const entries = logEntries(posts);
    const writing = entries.slice(0, WRITING_ROWS);
    const missions = cvProjects(projects, {
        url: siteConfig.url,
        posts: new Set(entries.map((entry) => entry.slug)),
    });
    const talks = cvTalks(profile?.talksAndPapers);
    const skills = (profile?.skillGroups ?? []).filter(
        (group) => group.title && group.skills?.length,
    );
    const credentials = cvCredentials(profile?.credentials);
    const linkedIn = getProfileLink(profile, "linkedin");
    const gitHub = getProfileLink(profile, "github");

    // An empty section is absent. Paper: education and experience on
    // sheet 1, the rest on sheet 2.
    const present = {
        education: timeline.education.length > 0,
        experience: timeline.experience.length > 0,
        projects: missions.length > 0,
        writing: writing.length + talks.length > 0,
        skills: skills.length > 0,
        certifications:
            credentials.current.length + credentials.prior.length > 0,
    };
    const order = (Object.keys(present) as (keyof typeof present)[]).filter(
        (id) => present[id],
    );
    const sheetOne = present.education || present.experience;
    // Paper leaves the Flight Log off: writing prints only with talks.
    const sheetTwo = order.some(
        (id) =>
            id !== "education" &&
            id !== "experience" &&
            (id !== "writing" || talks.length > 0),
    );
    const sheets = sheetOne && sheetTwo ? 2 : 1;

    const roleRow = (entry: CvEntry) => {
        // "Field Software Engineer I (promoted from …)": the title, and
        // the promotion as a quiet line under it, word for word.
        const [title, note] = splitTitle(entry.title);
        return (
            <CvItem
                key={entry.id}
                anchor={entry.anchor}
                orbit={model ? entry.id : undefined}
                current={entry.current}
                code={
                    numbers.has(entry.id)
                        ? orbitCopy.designation(numbers.get(entry.id)!)
                        : undefined
                }
                dates={entry.dates}
                meta={[entry.location, entry.expected, entry.employment]}
                status={
                    entry.current ? (
                        <Status value="active">{copy.current}</Status>
                    ) : null
                }
                title={title}
                sub={entry.organization}
                note={note}
                dek={entry.summary}
                lines={entry.highlights}
                skills={entry.skills}
                skillsLabel={copy.skillsLabel}
                actions={
                    model ? (
                        <Button
                            size="sm"
                            variant="quiet"
                            icon="arrow-up"
                            className="js-only"
                            data-orbit-show={entry.id}
                            data-print="hide"
                        >
                            {copy.showOnMap}
                        </Button>
                    ) : null
                }
            />
        );
    };

    return (
        <div data-page="resume" data-view="list" className={styles.page}>
            <OrbitInteraction />

            <div className={styles.band}>
                <PageHead
                    className="shell"
                    split
                    ornament="orbit"
                    tag={copy.themed}
                    title={copy.title}
                    meta={rev ? <Updated date={rev} /> : undefined}
                    intro={summary}
                >
                    {openTo ? (
                        <Availability
                            className={styles.openTo}
                            label={copy.openTo}
                            text={openTo}
                        />
                    ) : null}
                    <div className="cluster page-head__actions">
                        {hasPdf ? (
                            <a
                                className={buttonClass({
                                    variant: "primary",
                                    size: "sm",
                                })}
                                href="/resume/download"
                            >
                                <Icon name="download" />
                                {copy.download}
                            </a>
                        ) : null}
                        <Link
                            className={buttonClass({
                                variant: hasPdf ? "default" : "primary",
                                size: "sm",
                            })}
                            href={
                                openTo
                                    ? contactHref("hiring")
                                    : siteRoutes.contact
                            }
                        >
                            {copy.contact}
                            <Icon name="arrow" className="icon--nudge" />
                        </Link>
                    </div>
                    {profile?.resumeNote?.trim() ? (
                        <p className={styles.note}>
                            {profile.resumeNote.trim()}
                        </p>
                    ) : null}
                </PageHead>

                <div className={`shell ${styles.toolbar}`}>
                    {model ? (
                        <>
                            <Segmented
                                legend={copy.viewLegend}
                                name="cv-view"
                                options={copy.views}
                                defaultValue="list"
                                className={`js-only ${styles.switch}`}
                            />
                            {/* Without JavaScript the map opens from its
                                fragment (CSS :target). */}
                            <LinkArrow
                                className="nojs-only"
                                href="#orbit-map"
                                prefetch={false}
                            >
                                {copy.showMap}
                            </LinkArrow>
                        </>
                    ) : null}
                    {/* The flight: the timeline in 3D, on its own page. */}
                    {timeline.all.length ? (
                        <LinkArrow href={siteRoutes.trajectory}>
                            {copy.flight}
                        </LinkArrow>
                    ) : null}
                </div>
            </div>

            {model ? (
                <DocSection
                    className={styles.map}
                    id="orbit-map"
                    headingId="cv-map-h"
                    data={{ "data-print": "hide" }}
                    title={copy.map}
                    wide
                >
                    <OrbitMap
                        model={model}
                        entries={timeline.all}
                        planned={
                            openTo
                                ? {
                                      text: openTo,
                                      href: contactHref("hiring"),
                                      cta: availability?.cta?.trim() || null,
                                  }
                                : null
                        }
                        idPrefix="cv-orbit"
                        figure={copy.figure}
                    />
                </DocSection>
            ) : null}

            {/* The printed masthead: sheet 1 opens with it (G3). */}
            <header className={`shell ${styles.mast}`} data-print="only">
                <SheetHead sheet={1} sheets={sheets} rev={rev} />
                <span className={styles.mastName}>{name}</span>
                {profile?.headline ? (
                    <span className={styles.mastRole}>{profile.headline}</span>
                ) : null}
                <span className={styles.mastLinks}>
                    <Unbroken
                        items={[
                            `${hostOf(siteConfig.url)}${siteRoutes.resume}`,
                            `${hostOf(siteConfig.url)}${siteRoutes.contact}`,
                            ...(linkedIn ? [hostOf(linkedIn.url)] : []),
                            ...(gitHub ? [hostOf(gitHub.url)] : []),
                        ]}
                    />
                </span>
                {openTo ? (
                    <span className={styles.mastOpen}>
                        <span className={styles.mastKey}>{copy.openTo}</span>
                        <Unbroken items={openTo.split(" · ")} />
                    </span>
                ) : null}
                {summary ? (
                    <span className={styles.mastSummary}>{summary}</span>
                ) : null}
            </header>

            <div className={styles.cvBody}>
                {timeline.education.length ? (
                    <CvSection id="education" title={copy.education}>
                        <CvList>{timeline.education.map(roleRow)}</CvList>
                    </CvSection>
                ) : null}

                {timeline.experience.length ? (
                    <CvSection id="experience" title={copy.experience}>
                        <CvList>{timeline.experience.map(roleRow)}</CvList>
                    </CvSection>
                ) : null}

                {sheets === 2 ? (
                    <div
                        className={`shell ${styles.sheetTwo}`}
                        data-print="only"
                    >
                        <SheetHead sheet={2} sheets={sheets} rev={rev} />
                    </div>
                ) : null}

                {/* Every project is here; the header's Projects is
                    one click away. */}
                {missions.length ? (
                    <CvSection id="projects" title={copy.projects}>
                        <CvList>
                            {missions.map((mission) => (
                                <CvItem
                                    key={mission.id}
                                    anchor={`cv-${mission.slug}`}
                                    dates={mission.years}
                                    title={mission.title}
                                    href={`/portfolio/${mission.slug}`}
                                    sub={
                                        [mission.types, mission.role]
                                            .filter(Boolean)
                                            .join(" · ") || null
                                    }
                                    lines={mission.lines}
                                    links={mission.links}
                                    linksLabel={copy.links}
                                />
                            ))}
                        </CvList>
                    </CvSection>
                ) : null}

                {writing.length || talks.length ? (
                    <CvSection
                        id="writing"
                        title={
                            writing.length && talks.length ? (
                                <>
                                    <span data-print="hide">
                                        {copy.writing.withTalks}
                                    </span>
                                    <span data-print="only">
                                        {copy.writing.talks}
                                    </span>
                                </>
                            ) : talks.length ? (
                                copy.writing.talks
                            ) : (
                                copy.writing.title
                            )
                        }
                        print={talks.length > 0}
                        after={
                            entries.length > writing.length ? (
                                <LinkArrow href={siteRoutes.blog}>
                                    {copy.allWriting}
                                </LinkArrow>
                            ) : null
                        }
                    >
                        {/* The latest entries, compact: the date and the
                            linked title; All writing only when /blog has
                            more. Paper lists talks, not the Flight Log
                            (plan §2.5.5). */}
                        {writing.length ? (
                            <div data-print="hide">
                                <PlainRows
                                    rows={writing.map((entry) => ({
                                        id: entry.slug,
                                        date: (
                                            <time dateTime={entry.publishedAt}>
                                                {formatEntryDate(
                                                    entry.publishedAt,
                                                )}
                                            </time>
                                        ),
                                        line: (
                                            <Link href={`/blog/${entry.slug}`}>
                                                {entry.title}
                                            </Link>
                                        ),
                                    }))}
                                />
                            </div>
                        ) : null}
                        {talks.length ? (
                            <CvList
                                className={
                                    writing.length ? styles.talks : undefined
                                }
                            >
                                {talks.map((talk) => (
                                    <CvItem
                                        key={talk.id}
                                        code={talk.kind}
                                        dates={talk.date}
                                        title={talk.title}
                                        sub={talk.venue}
                                        links={talk.links}
                                    />
                                ))}
                            </CvList>
                        ) : null}
                    </CvSection>
                ) : null}

                {skills.length ? (
                    <CvSection id="skills" title={copy.skills}>
                        <Specs
                            className={styles.skills}
                            items={skills.map((group) => ({
                                id: group._key,
                                term: group.title,
                                value: group.skills.join(" · "),
                            }))}
                        />
                    </CvSection>
                ) : null}

                {/* Every credential the same plain row: the current
                    ones, then Prior certifications, as the résumé lists
                    them, on screen and on paper. */}
                {credentials.current.length || credentials.prior.length ? (
                    <CvSection
                        id="certifications"
                        title={
                            credentials.current.length
                                ? copy.certifications
                                : copy.priorCertifications
                        }
                    >
                        {credentials.current.length ? (
                            <PlainRows
                                rows={credentials.current.map(credentialRow)}
                            />
                        ) : null}
                        {credentials.current.length &&
                        credentials.prior.length ? (
                            <h3 className={styles.subhead}>
                                {copy.priorCertifications}
                            </h3>
                        ) : null}
                        {credentials.prior.length ? (
                            <PlainRows
                                rows={credentials.prior.map(credentialRow)}
                            />
                        ) : null}
                    </CvSection>
                ) : null}
            </div>
        </div>
    );
}
