import LogIndex from "@/components/blogs/log-index";
import ContactRoutes from "@/components/contact/contact-routes";
import CrewRecord from "@/components/crew/crew-record";
import Questions from "@/components/crew/questions";
import { CvItem, CvList } from "@/components/cv/cv-list";
import Hero, { preloadHeroPhoto } from "@/components/home/hero";
import OrbitInteraction from "@/components/orbit/orbit-interaction";
import OrbitMap from "@/components/orbit/orbit-map";
import MissionStage from "@/components/portfolio/mission-stage";
import MissionTile, { MissionTiles } from "@/components/portfolio/mission-tile";
import { buttonClass } from "@/components/ui/button";
import { Icon, type OrnamentName } from "@/components/ui/icon";
import { LinkArrow, Rev, Status } from "@/components/ui/marks";
import Pair from "@/components/ui/pair";
import RouteList from "@/components/ui/route-list";
import SectionTag from "@/components/ui/section-tag";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { contactRoutes } from "@/lib/contact";
import { homeCopy as copy, nowKinds, orbitCopy } from "@/lib/copy";
import {
    currentEntry,
    firstParagraph,
    nowGroups,
    openTo,
    roleLine,
    taglineOf,
} from "@/lib/crew";
import { cvEntries } from "@/lib/cv";
import { profileRows } from "@/lib/directory";
import { actNumber, homeActs, type HomeAct } from "@/lib/home";
import { logEntries } from "@/lib/log-index";
import { missionOrder, originalEntries, toMission } from "@/lib/missions";
import { contactHref, siteRoutes } from "@/lib/navigation";
import { orbitModel } from "@/lib/orbit/geometry";
import { getProfileLink } from "@/lib/profile-content";
import { resolveResumeAssetUrl } from "@/lib/resume";
import {
    getAllPosts,
    getAllProjects,
    getProfile,
    getProjectBySlug,
} from "@/lib/sanity-client";
import styles from "./home.module.css";

/**
 * One act of the home page (contract §1, §9): the tag row (ornament, the
 * § number, the themed and plain names, and one meta: a link to the act's
 * section or one datum), then the act's statement as its h2, then its
 * content.
 */
function Act({
    id,
    num,
    ornament,
    themed,
    plain,
    title,
    meta,
    children,
}: {
    id: HomeAct;
    num: string;
    ornament: OrnamentName;
    themed: string;
    plain: string;
    title: string;
    meta?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section
            className={`section ${styles.act}`}
            id={id}
            aria-labelledby={`${id}-h`}
        >
            <div className="shell">
                <SectionTag as="p" ornament={ornament} num={num} meta={meta}>
                    <Pair themed={themed} plain={plain} />
                </SectionTag>
                <h2 className={`t-h1 ${styles.statement}`} id={`${id}-h`}>
                    {title}
                </h2>
                <div className={styles.content}>{children}</div>
            </div>
        </section>
    );
}

/**
 * Home (§ 00, plan §6.2 row 13): the hero, then the acts in the order of
 * the voyage: Now, Missions, Flight Log, Trajectory, Crew and Comms. An
 * act with nothing to show is absent, and the acts are numbered as they
 * appear. Everything is server-rendered; the starfield, Pause motion and
 * the orbit map's cross-lighting are the only islands.
 */
export default async function Home() {
    preloadHeroPhoto();
    const [profile, posts, projects, today] = await Promise.all([
        getProfile(),
        getAllPosts(),
        getAllProjects(),
        getToday(),
    ]);
    const name = profile?.name?.trim() || siteConfig.author;

    // Now: the current role and the owner's Now list, by kind.
    const now = currentEntry(profile?.timeline);
    const open = openTo(profile);
    const asked = nowGroups(profile?.currentCuriosities, posts, projects);
    const curiositiesDate = /^\d{4}-\d{2}-\d{2}/.exec(
        profile?.curiositiesUpdatedAt ?? "",
    )?.[0];

    // Missions: the flagship on its stage, then up to three tiles.
    const ordered = missionOrder(projects);
    const missions = ordered.map((project) =>
        toMission(project, siteConfig.url),
    );
    const lead = Math.max(
        0,
        ordered.findIndex((project) => project.featured === 1),
    );
    const flagship = missions[lead];
    const others = missions.filter((_, index) => index !== lead).slice(0, 3);
    const detail = flagship ? await getProjectBySlug(flagship.slug) : null;
    const cover = detail?.cover?.asset ? detail.cover : null;
    const poster = detail?.model?.poster?.asset ? detail.model.poster : null;
    const entries = logEntries(posts);
    const originals = originalEntries(ordered, posts, entries, siteConfig.url);
    const flagshipEntry = flagship ? originals.get(flagship.id) : undefined;

    // Flight Log: the latest three entries.
    const latest = entries.slice(0, 3);
    const linkedIn = getProfileLink(profile, "linkedin");

    // Trajectory: the orbit map and the roles, newest first.
    const timeline = cvEntries(profile?.timeline);
    const model = timeline.all.length
        ? orbitModel({
              entries: timeline.all.map((entry) => entry.orbit),
              today,
              plannedFrom: open ? profile?.availability?.from : null,
          })
        : null;
    const numbers = new Map(
        model?.orbits.map((orbit) => [orbit.id, orbit.number]) ?? [],
    );
    const hasPdf = Boolean(resolveResumeAssetUrl(profile?.resumeUrl, "view"));

    // Crew and Comms.
    const bio = firstParagraph(profile?.bio);
    const routes = contactRoutes(profile);
    const profiles = profileRows(profile);

    const acts = homeActs({
        now: Boolean(now || asked.length),
        missions: missions.length,
        entries: latest.length,
        roles: timeline.all.length,
        profile: Boolean(profile),
    });
    const num = (act: HomeAct) => actNumber(acts, act);

    return (
        <div data-page="home">
            {model ? <OrbitInteraction /> : null}
            <Hero
                name={name}
                headline={profile?.headline?.trim() || null}
                tagline={taglineOf(profile)}
                status={{
                    now: now ? roleLine(now) : null,
                    openTo: open?.text ?? null,
                    updated: open?.updated ?? null,
                }}
                routes={{
                    cv: true,
                    work: Boolean(flagship),
                    blog: latest.length > 0,
                }}
            />

            {acts.includes("now") ? (
                <Act
                    id="now"
                    num={num("now")}
                    ornament="limb"
                    themed={copy.nowAct.themed}
                    plain={copy.nowAct.plain}
                    title={
                        now?.summary ||
                        now?.title ||
                        (asked.length === 1
                            ? nowKinds[asked[0].kind]
                            : copy.nowAct.plain)
                    }
                    meta={
                        curiositiesDate && asked.length ? (
                            <Rev label={copy.updated} date={curiositiesDate} />
                        ) : undefined
                    }
                >
                    <div className={`grid ${styles.now}`}>
                        {now ? (
                            <div className={`g-rail ${styles.nowRail}`}>
                                <Status value="active">
                                    {copy.nowAct.current}
                                </Status>
                                <p className={styles.nowTitle}>{now.title}</p>
                                <p className={styles.nowOrg}>
                                    {now.organization}
                                </p>
                                {now.dates || now.expected ? (
                                    <p className={styles.nowDates}>
                                        {[now.dates, now.expected]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                        {asked.length ? (
                            <div className="g-main">
                                {asked.map((group) => {
                                    // Without a current role, the act is
                                    // titled by its one group's kind, so
                                    // that group needs no label of its own.
                                    const labelled =
                                        Boolean(now) || asked.length > 1;
                                    const id = `now-${group.kind}-h`;
                                    return (
                                        <div
                                            key={group.kind}
                                            className={styles.nowGroup}
                                        >
                                            {labelled ? (
                                                <h3
                                                    className={`label label--ink ${styles.subhead}`}
                                                    id={id}
                                                >
                                                    {nowKinds[group.kind]}
                                                </h3>
                                            ) : null}
                                            <Questions
                                                items={group.items}
                                                labelledBy={
                                                    labelled ? id : "now-h"
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </Act>
            ) : null}

            {acts.includes("missions") && flagship ? (
                <Act
                    id="missions"
                    num={num("missions")}
                    ornament="pulsar"
                    themed={copy.missionsAct.themed}
                    plain={copy.missionsAct.plain}
                    title={copy.missionsAct.title}
                    meta={
                        <LinkArrow href={siteRoutes.portfolio}>
                            {copy.missionsAct.all}
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
                        writeUp={
                            flagshipEntry
                                ? `/blog/${flagshipEntry.slug}`
                                : `${flagship.href}#write-up`
                        }
                    />
                    {others.length ? (
                        <div className={styles.tiles}>
                            <MissionTiles>
                                {others.map((mission) => (
                                    <MissionTile
                                        key={mission.id}
                                        mission={mission}
                                    />
                                ))}
                            </MissionTiles>
                        </div>
                    ) : null}
                </Act>
            ) : null}

            {acts.includes("log") ? (
                <Act
                    id="log"
                    num={num("log")}
                    ornament="wave"
                    themed={copy.logAct.themed}
                    plain={copy.logAct.plain}
                    title={copy.logAct.title}
                    meta={
                        <LinkArrow href={siteRoutes.blog}>
                            {copy.logAct.all}
                        </LinkArrow>
                    }
                >
                    <LogIndex entries={latest} level={3} />
                    <div className={`cluster ${styles.after}`}>
                        <a
                            className={buttonClass({ size: "sm" })}
                            href={siteRoutes.feed}
                        >
                            <Icon name="rss" />
                            {copy.logAct.rss}
                        </a>
                        {linkedIn ? (
                            <a
                                className={buttonClass({ size: "sm" })}
                                href={linkedIn.url}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                {copy.logAct.linkedIn}
                                <Icon name="external" />
                            </a>
                        ) : null}
                    </div>
                </Act>
            ) : null}

            {acts.includes("trajectory") ? (
                <Act
                    id="trajectory"
                    num={num("trajectory")}
                    ornament="orbit"
                    themed={copy.trajectoryAct.themed}
                    plain={copy.trajectoryAct.plain}
                    title={copy.trajectoryAct.title}
                    meta={
                        <LinkArrow href={siteRoutes.resume}>
                            {copy.trajectoryAct.all}
                        </LinkArrow>
                    }
                >
                    {model ? (
                        <div className={styles.map}>
                            <OrbitMap
                                model={model}
                                entries={timeline.all}
                                planned={
                                    open
                                        ? {
                                              text: open.text,
                                              href: contactHref("hiring"),
                                          }
                                        : null
                                }
                                idPrefix="home-orbit"
                                size="compact"
                            />
                        </div>
                    ) : null}
                    <CvList className="cv-list--grid">
                        {timeline.all.map((entry) => (
                            <CvItem
                                key={entry.id}
                                anchor={entry.anchor}
                                orbit={model ? entry.id : undefined}
                                current={entry.current}
                                code={
                                    numbers.has(entry.id)
                                        ? orbitCopy.designation(
                                              numbers.get(entry.id)!,
                                          )
                                        : undefined
                                }
                                dates={entry.dates}
                                status={
                                    entry.current ? (
                                        <Status value="active">
                                            {orbitCopy.current}
                                        </Status>
                                    ) : null
                                }
                                title={entry.title}
                                sub={entry.organization}
                            />
                        ))}
                    </CvList>
                    {hasPdf ? (
                        <div className={`cluster ${styles.after}`}>
                            <a
                                className={buttonClass({ size: "sm" })}
                                href={siteRoutes.resumePdf}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Icon name="download" />
                                {copy.trajectoryAct.resume}
                            </a>
                        </div>
                    ) : null}
                </Act>
            ) : null}

            {acts.includes("crew") && profile ? (
                <Act
                    id="crew"
                    num={num("crew")}
                    ornament="hydrogen"
                    themed={copy.crewAct.themed}
                    plain={copy.crewAct.plain}
                    title={profile.headline?.trim() || name}
                    meta={
                        <LinkArrow href={siteRoutes.about}>
                            {copy.crewAct.all}
                        </LinkArrow>
                    }
                >
                    <CrewRecord profile={profile} />
                    {bio ? <p className={styles.bio}>{bio}</p> : null}
                </Act>
            ) : null}

            <Act
                id="comms"
                num={num("comms")}
                ornament="record"
                themed={copy.commsAct.themed}
                plain={copy.commsAct.plain}
                title={copy.commsAct.title}
                meta={
                    <LinkArrow href={siteRoutes.contact}>
                        {copy.commsAct.all}
                    </LinkArrow>
                }
            >
                <ContactRoutes routes={routes} layout="grid" />
                {profiles.length ? (
                    <div className={styles.profiles}>
                        <h3 className="label label--ink" id="comms-profiles-h">
                            {copy.commsAct.profiles}
                        </h3>
                        <RouteList
                            items={profiles}
                            columns={3}
                            labelledBy="comms-profiles-h"
                        />
                    </div>
                ) : null}
            </Act>
        </div>
    );
}
