import type { Metadata } from "next";
import Link from "next/link";
import LogIndex from "@/components/blogs/log-index";
import Hero, { preloadHeroPhoto } from "@/components/home/hero";
import MissionRow, { MissionRows } from "@/components/portfolio/mission-row";
import MissionStage from "@/components/portfolio/mission-stage";
import { ButtonLink } from "@/components/ui/button";
import type { OrnamentName } from "@/components/ui/icon";
import { LinkArrow } from "@/components/ui/marks";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { homeCopy as copy } from "@/lib/copy";
import { questions, taglineOf } from "@/lib/crew";
import { homeActs, homeProjects, type HomeAct } from "@/lib/home";
import { logEntries } from "@/lib/log-index";
import {
    missionOrder,
    originalEntries,
    toMission,
    writeUpHref,
    type Mission,
} from "@/lib/missions";
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
 * One section of the home page (contract §1, §9): the tag row (an
 * ornament, the plain h2, a hairline and one link to the section's page),
 * then its content. The ids are prefixed, because a visited page that
 * stays mounted can own the same fragment (/portfolio's #projects).
 */
function Act({
    id,
    ornament,
    title,
    meta,
    children,
}: {
    id: HomeAct;
    ornament: OrnamentName;
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
                <SectionTag ornament={ornament} meta={meta}>
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
 * Projects · CV · Contact), then, each only with content, the strongest
 * project on its stage with the next two as rows and any others as one
 * line, the latest three entries, the owner's research interests in one
 * statement, and the contact close (the profile's button that answers
 * what the owner is open to, while both are set, and Send a message).
 * Everything is server-rendered; the
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

    // Projects: the flagship on its stage (led by its summary; no stats),
    // two rows, then any others as one line.
    const ordered = missionOrder(projects);
    const picked = homeProjects(ordered);
    const mission = (project: (typeof ordered)[number]) =>
        toMission(project, siteConfig.url);
    const flagship = picked.flagship ? mission(picked.flagship) : null;
    const rows = picked.rows.map(mission);
    const also = picked.also.map(mission);
    const detail = flagship ? await getProjectBySlug(flagship.slug) : null;
    const cover = detail?.cover?.asset ? detail.cover : null;
    const poster = detail?.model?.poster?.asset ? detail.model.poster : null;
    const entries = logEntries(posts);
    const originals = originalEntries(ordered, posts, entries, siteConfig.url);
    const flagshipEntry = flagship ? originals.get(flagship.id) : undefined;

    // Writing: the latest three entries.
    const latest = entries.slice(0, 3);

    // Interests: the owner's one-line statement, and the way to his
    // current questions on About.
    const interests = taglineOf(profile);
    const asked = questions(profile?.currentCuriosities).length > 0;

    const acts = homeActs({
        projects: ordered.length,
        entries: latest.length,
        interests: Boolean(interests),
    });

    return (
        <div data-page="home">
            <Hero
                name={name}
                headline={profile?.headline?.trim() || null}
                openTo={open}
                projects={ordered.length > 0}
            />

            {acts.includes("projects") && flagship ? (
                <Act
                    id="projects"
                    ornament="pulsar"
                    title={copy.projectsAct.title}
                    meta={
                        <LinkArrow href={siteRoutes.portfolio}>
                            {copy.projectsAct.all}
                        </LinkArrow>
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
                        writeUp={writeUpHref(flagship, detail, flagshipEntry)}
                    />
                    {rows.length ? (
                        <MissionRows className={styles.projects}>
                            {rows.map((row) => (
                                <MissionRow key={row.id} mission={row} />
                            ))}
                        </MissionRows>
                    ) : null}
                    {also.length ? (
                        <p className={styles.also}>
                            <span className={styles.alsoLabel}>
                                {copy.projectsAct.also}
                            </span>
                            {also.map((item, index) => (
                                <span key={item.id}>
                                    {index ? (
                                        <span aria-hidden="true"> · </span>
                                    ) : null}
                                    <Link href={item.href}>{item.title}</Link>
                                </span>
                            ))}
                        </p>
                    ) : null}
                </Act>
            ) : null}

            {acts.includes("writing") ? (
                <Act
                    id="writing"
                    ornament="wave"
                    title={copy.writingAct.title}
                    meta={
                        <LinkArrow href={siteRoutes.blog}>
                            {copy.writingAct.all}
                        </LinkArrow>
                    }
                >
                    <LogIndex entries={latest} level={3} grouped={false} />
                </Act>
            ) : null}

            {acts.includes("interests") && interests ? (
                <Act
                    id="interests"
                    ornament="limb"
                    title={copy.interestsAct.title}
                    meta={
                        asked ? (
                            <LinkArrow href={`${siteRoutes.about}#crew-now`}>
                                {copy.interestsAct.now}
                            </LinkArrow>
                        ) : undefined
                    }
                >
                    <p className={styles.interests}>{interests}</p>
                </Act>
            ) : null}

            <section
                className={`section ${styles.act}`}
                id="home-contact"
                aria-labelledby="home-contact-h"
            >
                <div className="shell">
                    <div className={styles.closeInner}>
                        <h2 className="t-h1" id="home-contact-h">
                            {copy.contactAct.title}
                        </h2>
                        <div className={`cluster ${styles.closeActions}`}>
                            {answer ? (
                                <ButtonLink
                                    variant="primary"
                                    href={contactHref("hiring")}
                                    icon="arrow"
                                    iconAt="end"
                                >
                                    {answer}
                                </ButtonLink>
                            ) : null}
                            <ButtonLink
                                variant={answer ? undefined : "primary"}
                                href={siteRoutes.contact}
                                icon="arrow"
                                iconAt="end"
                            >
                                {copy.contactAct.message}
                            </ButtonLink>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
