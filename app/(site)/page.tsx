import type { Metadata } from "next";
import LogIndex from "@/components/blogs/log-index";
import Hero, { preloadHeroPhoto } from "@/components/home/hero";
import MissionRow, { MissionRows } from "@/components/portfolio/mission-row";
import MissionStage from "@/components/portfolio/mission-stage";
import { ButtonLink } from "@/components/ui/button";
import { LinkArrow } from "@/components/ui/marks";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { homeCopy as copy } from "@/lib/copy";
import { questions, taglineOf } from "@/lib/crew";
import { homeActs, homeProjects, type HomeAct } from "@/lib/home";
import { logEntries } from "@/lib/log-index";
import { missionOrder, toMission } from "@/lib/missions";
import { contactHref, siteRoutes } from "@/lib/navigation";
import { availabilityLine } from "@/lib/profile-content";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    getProjectBySlug,
} from "@/lib/sanity-client";
import { homeCardAlt, shareImage, siteOpenGraph } from "@/lib/site-metadata";
import styles from "./home.module.css";

/**
 * Home's share card with an alt in the card's own words (the route's
 * `alt` export is one fixed string), over the site's Open Graph fields.
 */
export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    return {
        openGraph: {
            ...siteOpenGraph(profile),
            images: [
                shareImage(
                    "app/(site)/opengraph-image.tsx",
                    homeCardAlt(profile),
                ),
            ],
        },
    };
}

/**
 * One section of the home page (contract §1, §9): the tag row (the
 * plain h2, a hairline and, while the section's page holds more than
 * home shows, one link to it), then its content. The ids are prefixed, because a visited page that
 * stays mounted can own the same fragment (/portfolio's #projects).
 */
function Act({
    id,
    title,
    meta,
    children,
}: {
    id: HomeAct;
    title: string;
    meta?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section
            className={`section ${styles.act}`}
            id={`home-${id}`}
            aria-labelledby={`home-${id}-h`}
        >
            <div className="shell">
                <SectionTag meta={meta}>
                    <h2 className="section-tag__h" id={`home-${id}-h`}>
                        {title}
                    </h2>
                </SectionTag>
                <div className={styles.content}>{children}</div>
            </div>
        </section>
    );
}

/**
 * Home: the hero (the name, the profile's headline and availability, and
 * CV), then, each only with content, the strongest project on its stage
 * with the next two as rows, and the latest three entries, each linking
 * its section's page only while that page holds more; then the close: the
 * owner's tagline as its heading with the way to his current focus,
 * then one way to /contact: the profile's button that
 * answers what the owner is open to (the one primary, while both are
 * set), else Send a message. Everything is server-rendered; the
 * starfield and Pause motion are the only islands.
 */
export default async function Home() {
    preloadHeroPhoto();
    const [profile, posts, projects] = await Promise.all([
        getProfile(),
        getAllPosts(),
        getAllProjects(),
    ]);
    const name = profile?.name?.trim() || siteConfig.author;
    const open = availabilityLine(profile?.availability);
    // The button that answers the Open To line: the profile's words.
    const answer = open ? profile?.availability?.cta?.trim() || null : null;

    // Projects: the flagship on its stage (led by its summary; no stats)
    // and two rows (each with its cover as a thumbnail, when it has one).
    // Home curates these three: All projects shows only while /portfolio
    // holds more.
    const ordered = missionOrder(projects);
    const picked = homeProjects(ordered);
    const mission = (project: (typeof ordered)[number]) =>
        toMission(project, siteConfig.url);
    const flagship = picked.flagship ? mission(picked.flagship) : null;
    const rows = picked.rows.map(mission);
    const detail = flagship ? await getProjectBySlug(flagship.slug) : null;
    const cover = detail?.cover?.asset ? detail.cover : null;
    const poster = detail?.model?.poster?.asset ? detail.model.poster : null;
    // Writing: the latest three entries, and All writing only while /blog
    // lists more. (The stage leads to the project alone: its page links the
    // write-up, and the entries are listed here.)
    const entries = logEntries(posts);
    const latest = entries.slice(0, 3);

    // The close: the owner's one-line statement of what he is exploring,
    // and the way to his current questions on About.
    const tagline = taglineOf(profile);
    const asked = questions(profile?.currentCuriosities).length > 0;

    const acts = homeActs({
        projects: ordered.length,
        entries: latest.length,
    });

    return (
        <div data-page="home">
            <Hero
                name={name}
                headline={profile?.headline?.trim() || null}
                openTo={open}
            />

            {acts.includes("projects") && flagship ? (
                <Act
                    id="projects"
                    title={copy.projectsAct.title}
                    meta={
                        picked.also.length ? (
                            <LinkArrow href={siteRoutes.portfolio}>
                                {copy.projectsAct.all}
                            </LinkArrow>
                        ) : undefined
                    }
                >
                    <MissionStage
                        mission={flagship}
                        image={cover ?? poster}
                        caption={
                            cover
                                ? cover.caption
                                : detail?.model?.title?.trim() || null
                        }
                    />
                    {rows.length ? (
                        <MissionRows className={styles.projects}>
                            {rows.map((row) => (
                                <MissionRow
                                    key={row.id}
                                    mission={row}
                                    cover={row.cover}
                                />
                            ))}
                        </MissionRows>
                    ) : null}
                </Act>
            ) : null}

            {acts.includes("writing") ? (
                <Act
                    id="writing"
                    title={copy.writingAct.title}
                    meta={
                        entries.length > latest.length ? (
                            <LinkArrow href={siteRoutes.blog}>
                                {copy.writingAct.all}
                            </LinkArrow>
                        ) : undefined
                    }
                >
                    <LogIndex
                        entries={latest}
                        level={3}
                        grouped={false}
                        tags={false}
                    />
                </Act>
            ) : null}

            <section
                className={`section ${styles.act}`}
                id="home-contact"
                aria-labelledby="home-contact-h"
            >
                <div className="shell">
                    <div className={styles.close}>
                        <h2
                            className={tagline ? styles.tagline : "sr-only"}
                            id="home-contact-h"
                        >
                            {tagline ?? copy.contactAct.title}
                        </h2>
                        {asked ? (
                            <LinkArrow href={`${siteRoutes.about}#crew-now`}>
                                {copy.contactAct.now}
                            </LinkArrow>
                        ) : null}
                        <div className={styles.closeActions}>
                            {answer ? (
                                <ButtonLink
                                    variant="primary"
                                    href={contactHref("hiring")}
                                    icon="arrow"
                                    iconAt="end"
                                >
                                    {answer}
                                </ButtonLink>
                            ) : (
                                <LinkArrow href={siteRoutes.contact}>
                                    {copy.contactAct.message}
                                </LinkArrow>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
