import type { Metadata } from "next";
import MissionRow, { MissionRows } from "@/components/portfolio/mission-row";
import MissionStage from "@/components/portfolio/mission-stage";
import MissionTile, { MissionTiles } from "@/components/portfolio/mission-tile";
import { LinkArrow } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import RouteList from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { directoryRows } from "@/lib/directory";
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
 * stage, the next two as text-first tiles and the rest as compact rows, so
 * the owner's last project is the least prominent (`missionTiers`), then
 * the pages that the old sections of this page moved to, each still
 * answering its old fragment (#experience, #skills, #certifications,
 * #engineering-writing, #contact; #projects is the tiles). Only what the
 * owner published is shown: no counts, no register, no numbers without
 * their notes. Everything is server-rendered and static.
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

    const rows = directoryRows(
        ["experience", "skills", "certifications", "writing", "contact"],
        { profile, posts: posts.filter((post) => post.slug).length },
        { anchors: true },
    );

    return (
        <div data-page="missions" className={styles.page}>
            <PageHead
                className="shell"
                split
                ornament="pulsar"
                tag={copy.themed}
                title={copy.plain}
                intro={profile?.projectsIntro?.trim() || null}
            >
                <div className="cluster page-head__actions">
                    <LinkArrow href={siteRoutes.resume}>
                        {copy.experience}
                    </LinkArrow>
                </div>
            </PageHead>

            {flagship ? (
                <section
                    className={`section ${styles.first}`}
                    id={others ? undefined : "projects"}
                    aria-labelledby="msn-flagship-h"
                >
                    <div className="shell">
                        <SectionTag className={styles.tag} ornament="star">
                            <h2 className="section-tag__h" id="msn-flagship-h">
                                {copy.flagship}
                            </h2>
                        </SectionTag>
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
                        <SectionTag className={styles.tag}>
                            <h2 className="section-tag__h" id="msn-more-h">
                                {copy.more}
                            </h2>
                        </SectionTag>
                        {tiles.length ? (
                            <MissionTiles>
                                {tiles.map((item) => (
                                    <MissionTile key={item.id} mission={item} />
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

            {rows.length ? (
                <section className="section" aria-labelledby="msn-dir-h">
                    <div className="shell">
                        <SectionTag className={styles.tag}>
                            <h2 className="section-tag__h" id="msn-dir-h">
                                {copy.directory}
                            </h2>
                        </SectionTag>
                        <RouteList
                            items={rows}
                            columns={3}
                            labelledBy="msn-dir-h"
                        />
                    </div>
                </section>
            ) : null}
        </div>
    );
}
