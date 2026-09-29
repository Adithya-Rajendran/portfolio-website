import type { Metadata } from "next";
import Link from "next/link";
import LogIndex from "@/components/blogs/log-index";
import { CvItem, CvList } from "@/components/cv/cv-list";
import OrbitInteraction from "@/components/orbit/orbit-interaction";
import OrbitMap from "@/components/orbit/orbit-map";
import ResumeShareAction from "@/components/resume/resume-share-action";
import StaticStars from "@/components/sky/static-stars";
import Availability from "@/components/ui/availability";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
    LinkArrow,
    Rev,
    Status,
    Updated,
    type StatusValue,
} from "@/components/ui/marks";
import DocSection from "@/components/ui/doc-section";
import PageHead from "@/components/ui/page-head";
import Segmented from "@/components/ui/segmented";
import Specs from "@/components/ui/specs";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { cvCopy as copy, orbitCopy } from "@/lib/copy";
import { openTo as openToOf } from "@/lib/crew";
import {
    cvCredentials,
    cvEntries,
    cvProjects,
    cvTalks,
    hostOf,
    type CvEntry,
} from "@/lib/cv";
import { logEntries } from "@/lib/log-index";
import { contactHref, siteRoutes } from "@/lib/navigation";
import { orbitModel } from "@/lib/orbit/geometry";
import { getProfileLink } from "@/lib/profile-content";
import type { ProjectStatus } from "@/lib/project-fields";
import { resolveResumeAssetUrl } from "@/lib/resume";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    type ProfileData,
} from "@/lib/sanity-client";
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

const PROJECT_STATUS: Record<ProjectStatus, StatusValue> = {
    active: "active",
    completed: "complete",
    paused: "paused",
    archived: "archived",
    planned: "planned",
    stopped: "stopped",
};

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
 * Trajectory · Experience / CV (G2, G3): the CV first, as a list a hiring
 * reader can scan (education, experience, projects, writing and talks,
 * skills, certifications), under the head with what the owner is open to,
 * the PDF and the way to get in touch. The time-scaled orbit map with its
 * record panel is the optional Map view. The PDF is downloadable and the
 * page prints as a two-sheet controlled document. Everything is
 * server-rendered: without JavaScript the list shows and the map opens
 * from its link (`#orbit-map`), its labels linking to the CV rows; with
 * it, `OrbitInteraction` runs the view switch, previews, pins and
 * cross-lights map and list, and runs Print. There is no email address
 * or phone number, on screen or on paper.
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
    const openTo = openToOf(profile)?.text ?? null;

    const timeline = cvEntries(profile?.timeline);
    const model = orbitModel({
        entries: timeline.all.map((entry) => entry.orbit),
        today,
        plannedFrom: openTo ? availability?.from : null,
    });
    const numbers = new Map(
        model?.orbits.map((orbit) => [orbit.id, orbit.number]) ?? [],
    );
    const missions = cvProjects(projects);
    const writing = logEntries(posts);
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
        certifications: credentials.length > 0,
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

    const roleRow = (entry: CvEntry) => (
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
            title={entry.title}
            sub={entry.organization}
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

    return (
        <div data-page="resume" data-view="list" className={styles.page}>
            <OrbitInteraction />

            <div className={`head-band ${styles.band}`}>
                <StaticStars variant="band" />
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
                            <>
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
                                <a
                                    className={buttonClass({ size: "sm" })}
                                    href={siteRoutes.resumePdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {copy.openPdf}
                                    <Icon name="external" />
                                </a>
                            </>
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
                    <div className={`cluster js-only ${styles.tools}`}>
                        <Button
                            size="sm"
                            variant="quiet"
                            icon="print"
                            data-cv-print
                        >
                            {copy.print}
                        </Button>
                        <ResumeShareAction
                            canonicalUrl={canonicalUrl}
                            title={`${name} · ${copy.documentTitle}`}
                        />
                    </div>
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
                    {[
                        `${hostOf(siteConfig.url)}${siteRoutes.resume}`,
                        `${hostOf(siteConfig.url)}${siteRoutes.contact}`,
                        linkedIn ? hostOf(linkedIn.url) : null,
                        gitHub ? hostOf(gitHub.url) : null,
                    ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
                {openTo ? (
                    <span className={styles.mastOpen}>
                        <span className={styles.mastKey}>{copy.openTo}</span>
                        {openTo}
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

                {missions.length ? (
                    <CvSection
                        id="projects"
                        title={copy.projects}
                        after={
                            <LinkArrow href={siteRoutes.portfolio}>
                                {copy.allProjects}
                            </LinkArrow>
                        }
                    >
                        <CvList>
                            {missions.map((mission) => (
                                <CvItem
                                    key={mission.id}
                                    anchor={`cv-${mission.slug}`}
                                    dates={mission.years}
                                    status={
                                        <Status
                                            value={
                                                PROJECT_STATUS[mission.status]
                                            }
                                        >
                                            {mission.statusLabel}
                                        </Status>
                                    }
                                    title={mission.title}
                                    href={`/portfolio/${mission.slug}`}
                                    sub={
                                        [mission.types, mission.role]
                                            .filter(Boolean)
                                            .join(" · ") || null
                                    }
                                    lines={mission.lines}
                                    skills={mission.technologies}
                                    skillsLabel={copy.stack}
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
                            writing.length ? (
                                <LinkArrow href={siteRoutes.blog}>
                                    {copy.allWriting}
                                </LinkArrow>
                            ) : null
                        }
                    >
                        {/* Paper lists talks, not the Flight Log (plan
                            §2.5.5). */}
                        {writing.length ? (
                            <div data-print="hide">
                                <LogIndex entries={writing} level={3} />
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

                {credentials.length ? (
                    <CvSection id="certifications" title={copy.certifications}>
                        <CvList>
                            {credentials.map((credential) => (
                                <CvItem
                                    key={credential.id}
                                    status={
                                        <Status value={credential.status}>
                                            {credential.statusLabel}
                                        </Status>
                                    }
                                    title={credential.title}
                                    href={credential.url ?? undefined}
                                    sub={[credential.issuer, credential.meta]
                                        .filter(Boolean)
                                        .join(" · ")}
                                />
                            ))}
                        </CvList>
                    </CvSection>
                ) : null}
            </div>
        </div>
    );
}
