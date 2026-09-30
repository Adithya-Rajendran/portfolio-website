import type { Metadata } from "next";
import LogIndex from "@/components/blogs/log-index";
import CrewRecord from "@/components/crew/crew-record";
import Questions from "@/components/crew/questions";
import { CvItem, CvList } from "@/components/cv/cv-list";
import { ProfilePageJsonLd } from "@/components/json-ld";
import Ask from "@/components/ui/ask";
import { ButtonLink } from "@/components/ui/button";
import DocSection from "@/components/ui/doc-section";
import { Patch } from "@/components/ui/icon";
import { LinkArrow, Updated } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import RouteList from "@/components/ui/route-list";
import { siteConfig } from "@/lib/config";
import { aboutCopy as copy, nowKinds } from "@/lib/copy";
import { nowGroups } from "@/lib/crew";
import { cvTalks } from "@/lib/cv";
import { directoryRows } from "@/lib/directory";
import { logEntries } from "@/lib/log-index";
import { contactHref, siteRoutes } from "@/lib/navigation";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    type ProfileData,
} from "@/lib/sanity-client";
import styles from "./about.module.css";

const canonicalUrl = `${siteConfig.url}${siteRoutes.about}`;
const title = copy.plain;

function descriptionOf(profile: ProfileData | null): string {
    return (
        profile?.introduction?.trim() ||
        profile?.headline?.trim() ||
        copy.description
    );
}

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = descriptionOf(profile);
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

/** The biography's paragraphs (blank-line apart in the profile). */
function paragraphsOf(bio: string | null | undefined): string[] {
    return (bio ?? "")
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean);
}

/** How many of the latest entries the page lists; the rest are a link. */
const ENTRIES = 3;

/**
 * About (themed Crew File; plan §6.2 row 14): the head with the patch as
 * the identity mark (there is no portrait), the profile record (G6), then
 * the biography, the Now list by kind, the latest writing and any talks,
 * the related pages, and the way to get in touch. A section with nothing
 * to show is absent; the sections are titled by their plain names.
 * Everything is server-rendered and static; there are no islands.
 */
export default async function AboutPage() {
    const [profile, posts, projects] = await Promise.all([
        getProfile(),
        getAllPosts(),
        getAllProjects(),
    ]);
    const headline = profile?.headline?.trim() || null;
    const paragraphs = paragraphsOf(profile?.bio);
    const groups = nowGroups(profile?.currentCuriosities, posts, projects);
    const nowDate = /^\d{4}-\d{2}-\d{2}/.exec(
        profile?.curiositiesUpdatedAt ?? "",
    )?.[0];
    const entries = logEntries(posts).slice(0, ENTRIES);
    const talks = cvTalks(profile?.talksAndPapers);
    const related = directoryRows(
        ["experience", "skills", "certifications", "missions"],
        { profile, projects: projects.length },
    );

    return (
        <div data-page="about">
            <ProfilePageJsonLd />
            <PageHead
                className="shell"
                ornament="hydrogen"
                tag={copy.themed}
                title={copy.plain}
                intro={headline}
                figure={<Patch />}
            >
                <div className="cluster page-head__actions">
                    <LinkArrow href={siteRoutes.resume}>
                        {copy.experience}
                    </LinkArrow>
                </div>
            </PageHead>

            <div className="shell">
                <CrewRecord profile={profile} className={styles.record} />
            </div>

            {paragraphs.length ? (
                <DocSection id="crew-bio" title={copy.bio} prose>
                    <div className="prose">
                        {paragraphs.map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </DocSection>
            ) : null}

            {groups.length ? (
                <DocSection
                    id="crew-now"
                    title={copy.now}
                    meta={
                        nowDate ? (
                            <Updated label={copy.updated} date={nowDate} />
                        ) : undefined
                    }
                >
                    {groups.map((group) => (
                        <div className={styles.group} key={group.kind}>
                            <h3
                                className={`label label--ink ${styles.groupTitle}`}
                                id={`crew-now-${group.kind}-h`}
                            >
                                {nowKinds[group.kind]}
                            </h3>
                            <Questions
                                items={group.items}
                                labelledBy={`crew-now-${group.kind}-h`}
                            />
                        </div>
                    ))}
                </DocSection>
            ) : null}

            {entries.length || talks.length ? (
                <DocSection
                    id="crew-writing"
                    title={
                        entries.length && talks.length
                            ? copy.writingAndTalks
                            : entries.length
                              ? copy.writing
                              : copy.talks
                    }
                    meta={
                        entries.length ? (
                            <LinkArrow href={siteRoutes.blog}>
                                {copy.allEntries}
                            </LinkArrow>
                        ) : undefined
                    }
                >
                    {entries.length ? (
                        <LogIndex entries={entries} level={3} />
                    ) : null}
                    {talks.length ? (
                        <CvList
                            className={
                                entries.length ? styles.talks : undefined
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
                </DocSection>
            ) : null}

            {related.length ? (
                <DocSection id="crew-elsewhere" title={copy.elsewhere}>
                    <RouteList
                        items={related}
                        columns={2}
                        labelledBy="crew-elsewhere-h"
                    />
                </DocSection>
            ) : null}

            <section
                className="section"
                aria-labelledby="crew-close-h"
                data-print="hide"
            >
                <div className="shell">
                    <Ask id="crew-close-h" title={copy.ask}>
                        <ButtonLink
                            href={contactHref("hello")}
                            icon="arrow"
                            iconAt="end"
                        >
                            {copy.getInTouch}
                        </ButtonLink>
                    </Ask>
                </div>
            </section>
        </div>
    );
}
