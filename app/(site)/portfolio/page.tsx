import type { Metadata } from "next";
import MissionRow, { MissionRows } from "@/components/portfolio/mission-row";
import MissionStage from "@/components/portfolio/mission-stage";
import MissionTile, { MissionTiles } from "@/components/portfolio/mission-tile";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { logEntries } from "@/lib/log-index";
import {
    missionOrder,
    missionTiers,
    originalEntries,
    toMission,
    writeUpHref,
} from "@/lib/missions";
import { siteRoutes } from "@/lib/navigation";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    getProjectBySlug,
} from "@/lib/sanity-client";
import styles from "./portfolio.module.css";

const canonicalUrl = `${siteConfig.url}${siteRoutes.portfolio}`;
const title = copy.plain;

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const name = profile?.name || siteConfig.author;
    const description = profile?.projectsIntro?.trim();
    const described = description ? { description } : {};
    return {
        title,
        ...described,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `${title} | ${name}`,
            ...described,
            url: canonicalUrl,
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            ...described,
        },
    };
}

/** How many projects after the flagship get a tile; the rest are rows. */
const TILES = 2;

/**
 * Projects (/portfolio; themed Missions): the page head with the owner's
 * introduction (`projectsIntro`, left out when empty), the flagship on its
 * stage, the next two as text-first tiles (with their covers, when they
 * have one) and the rest as compact rows,
 * so the owner's last project is the least prominent (`missionTiers`);
 * the tiers' sections are named for screen readers only, since the page
 * title already says what they are; #projects is the tiles. The old sections' fragments (#experience…) are sent on by
 * RouteMarker. Only what the owner published is shown: no counts, no
 * register, no numbers without their notes. Everything is server-rendered
 * and static.
 */
export default async function Portfolio() {
    const [profile, projects, posts] = await Promise.all([
        getProfile(),
        getAllProjects(),
        getAllPosts(),
    ]);
    const ordered = missionOrder(projects);
    const mission = (project: (typeof ordered)[number]) =>
        toMission(project, siteConfig.url);
    const tiers = missionTiers(ordered, TILES);
    const flagship = tiers.flagship ? mission(tiers.flagship) : null;
    const tiles = tiers.rows.map(mission);
    const rest = tiers.also.map(mission);
    const detail = flagship ? await getProjectBySlug(flagship.slug) : null;
    const cover = detail?.cover?.asset ? detail.cover : null;
    const poster = detail?.model?.poster?.asset ? detail.model.poster : null;
    const originals = originalEntries(
        ordered,
        posts,
        logEntries(posts),
        siteConfig.url,
    );
    const others = tiles.length + rest.length > 0;

    return (
        <div data-page="missions">
            <PageHead
                className="shell"
                split
                tag={copy.themed}
                title={copy.plain}
                intro={profile?.projectsIntro?.trim() || null}
            />

            {flagship ? (
                <section
                    className={`section ${styles.first}`}
                    id={others ? undefined : "projects"}
                    aria-labelledby="msn-flagship-h"
                >
                    <div className="shell">
                        <h2 className="sr-only" id="msn-flagship-h">
                            {copy.flagship}
                        </h2>
                        <MissionStage
                            mission={flagship}
                            image={cover ?? poster}
                            caption={
                                cover
                                    ? cover.caption
                                    : detail?.model?.title?.trim() || null
                            }
                            writeUp={writeUpHref(
                                flagship,
                                detail,
                                originals.get(flagship.id),
                            )}
                            priority
                        />
                    </div>
                </section>
            ) : null}

            {others ? (
                <section
                    className="section"
                    id="projects"
                    aria-labelledby="msn-more-h"
                >
                    <div className="shell">
                        <h2 className="sr-only" id="msn-more-h">
                            {copy.more}
                        </h2>
                        {tiles.length ? (
                            <MissionTiles>
                                {tiles.map((item) => (
                                    <MissionTile
                                        key={item.id}
                                        mission={item}
                                        cover={item.cover}
                                    />
                                ))}
                            </MissionTiles>
                        ) : null}
                        {rest.length ? (
                            <div className={styles.rest}>
                                <p className={styles.restLabel}>{copy.also}</p>
                                <MissionRows quiet>
                                    {rest.map((item) => (
                                        <MissionRow
                                            key={item.id}
                                            mission={item}
                                        />
                                    ))}
                                </MissionRows>
                            </div>
                        ) : null}
                    </div>
                </section>
            ) : null}
        </div>
    );
}
