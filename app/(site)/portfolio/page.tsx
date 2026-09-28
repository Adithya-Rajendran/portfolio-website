import type { Metadata } from "next";
import MissionRegister from "@/components/portfolio/mission-register";
import MissionStage from "@/components/portfolio/mission-stage";
import MissionTile, { MissionTiles } from "@/components/portfolio/mission-tile";
import StaticStars from "@/components/sky/static-stars";
import { LinkArrow, Status } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import Pair from "@/components/ui/pair";
import RouteList from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { directoryRows } from "@/lib/directory";
import { logEntries } from "@/lib/log-index";
import {
    missionOrder,
    originalEntries,
    statusTally,
    toMission,
    typeList,
    type Mission,
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
const title = `${copy.themed} · ${copy.plain}`;

export async function generateMetadata(): Promise<Metadata> {
    const [profile, projects] = await Promise.all([
        getProfile(),
        getAllProjects(),
    ]);
    const name = profile?.name || siteConfig.author;
    const description = copy.dek(
        typeList(projects.map((project) => toMission(project, siteConfig.url))),
    );
    return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
            title: `${title} | ${name}`,
            description,
            url: canonicalUrl,
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            description,
        },
    };
}

/**
 * Missions · Projects (§ 02): the flagship on its stage, the other
 * missions as text-first tiles, the register of every mission (Table 1),
 * and the pages that the old sections of this page moved to, each still
 * answering its old fragment (#experience, #skills, #certifications,
 * #engineering-writing, #contact; #projects is the tiles). Everything is
 * server-rendered and static.
 */
export default async function Portfolio() {
    const [profile, projects, posts] = await Promise.all([
        getProfile(),
        getAllProjects(),
        getAllPosts(),
    ]);
    const ordered = missionOrder(projects);
    const missions = ordered.map((project) =>
        toMission(project, siteConfig.url),
    );
    const flagshipIndex = ordered.findIndex(
        (project) => project.featured === 1,
    );
    const lead = flagshipIndex >= 0 ? flagshipIndex : 0;
    const flagship: Mission | undefined = missions[lead];
    const others = missions.filter((_, index) => index !== lead);
    const detail = flagship ? await getProjectBySlug(flagship.slug) : null;
    const cover = detail?.cover?.asset ? detail.cover : null;
    const poster = detail?.model?.poster?.asset ? detail.model.poster : null;

    const originals = originalEntries(
        ordered,
        posts,
        logEntries(posts),
        siteConfig.url,
    );
    const writeUp = (mission: Mission) => {
        const entry = originals.get(mission.id);
        return entry ? `/blog/${entry.slug}` : `${mission.href}#write-up`;
    };

    const tally = statusTally(missions);
    const rows = directoryRows(
        ["experience", "skills", "certifications", "writing", "contact"],
        { profile, posts: posts.filter((post) => post.slug).length },
        { anchors: true },
    );
    const sections = [
        flagship ? "flagship" : null,
        others.length ? "more" : null,
        missions.length ? "register" : null,
        rows.length ? "directory" : null,
    ].filter(Boolean);
    const num = (id: string) => `${copy.num}.${sections.indexOf(id) + 1}`;

    return (
        <div data-page="missions" className={styles.page}>
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    split
                    ornament="pulsar"
                    num={copy.num}
                    themed={copy.themed}
                    plain={copy.plain}
                    intro={copy.dek(typeList(missions))}
                >
                    <div className={styles.headMeta}>
                        {tally.length ? (
                            <p className={styles.tally}>
                                <span className="sr-only">
                                    {copy.tallyLabel}:{" "}
                                </span>
                                {tally.map((item) => (
                                    <Status key={item.value} value={item.value}>
                                        {item.count} {item.label}
                                    </Status>
                                ))}
                            </p>
                        ) : null}
                        <LinkArrow href={siteRoutes.resume}>
                            {copy.experience}
                        </LinkArrow>
                    </div>
                </PageHead>
            </div>

            {flagship ? (
                <section
                    className={`section ${styles.first}`}
                    id={others.length ? undefined : "projects"}
                    aria-labelledby="msn-flagship-h"
                >
                    <div className="shell">
                        <SectionTag
                            className={styles.tag}
                            ornament="star"
                            num={num("flagship")}
                            meta={flagship.designation}
                        >
                            <h2 className="section-tag__h" id="msn-flagship-h">
                                <Pair
                                    themed={copy.flagshipThemed}
                                    plain={copy.flagshipPlain}
                                />
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
                            writeUp={writeUp(flagship)}
                            priority
                        />
                    </div>
                </section>
            ) : null}

            {others.length ? (
                <section
                    className="section"
                    id="projects"
                    aria-labelledby="msn-more-h"
                >
                    <div className="shell">
                        <SectionTag className={styles.tag} num={num("more")}>
                            <h2 className="section-tag__h" id="msn-more-h">
                                <Pair
                                    themed={copy.moreThemed}
                                    plain={copy.morePlain}
                                />
                            </h2>
                        </SectionTag>
                        <MissionTiles>
                            {others.map((mission) => (
                                <MissionTile
                                    key={mission.id}
                                    mission={mission}
                                />
                            ))}
                        </MissionTiles>
                    </div>
                </section>
            ) : null}

            {missions.length ? (
                <section
                    className="section"
                    id="register"
                    aria-labelledby="msn-register-h"
                >
                    <div className="shell">
                        <SectionTag
                            className={styles.tag}
                            num={num("register")}
                            meta={copy.table}
                        >
                            <h2 className="section-tag__h" id="msn-register-h">
                                <Pair
                                    themed={copy.registerThemed}
                                    plain={copy.registerPlain}
                                />
                            </h2>
                        </SectionTag>
                        <MissionRegister
                            missions={[...missions].sort(
                                (a, b) => a.number - b.number,
                            )}
                            entries={originals}
                            captionId="msn-register-cap"
                        />
                    </div>
                </section>
            ) : null}

            {rows.length ? (
                <section className="section" aria-labelledby="msn-dir-h">
                    <div className="shell">
                        <SectionTag
                            className={styles.tag}
                            num={num("directory")}
                        >
                            <h2 className="section-tag__h" id="msn-dir-h">
                                <Pair
                                    themed={copy.directoryThemed}
                                    plain={copy.directoryPlain}
                                />
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
