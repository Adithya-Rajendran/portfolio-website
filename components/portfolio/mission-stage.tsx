import type { CSSProperties } from "react";
import Link from "next/link";
import MissionLine, { MissionStack } from "@/components/portfolio/mission-line";
import { ButtonLink } from "@/components/ui/button";
import { LinkArrow } from "@/components/ui/marks";
import Metrics from "@/components/ui/metrics";
import Plate from "@/components/ui/plate";
import { missionsCopy as copy } from "@/lib/copy";
import { cardStats, type Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";

/**
 * The flagship (contract §4 and §9): the mission's line, its name in
 * capitals, its title and summary, its quantities as stats and its stack
 * in seven columns, beside its photograph as a plate in five. Without a
 * photograph the copy takes the full width and the stats go four across.
 * Shared by /portfolio and the home page, which leaves out the stats and
 * the mission number (`stats`, `code`): there the summary leads.
 */
export default function MissionStage({
    mission,
    image,
    caption,
    writeUp,
    as: Heading = "h3",
    priority = false,
    stats = true,
    code = true,
}: {
    stats?: boolean;
    code?: boolean;
    mission: Mission;
    /** The cover, or the model's poster. */
    image?: SanityImageValue | null;
    caption?: string | null;
    /** Where "Read the write-up" goes: the original entry, or the file's. */
    writeUp?: string | null;
    as?: "h2" | "h3";
    priority?: boolean;
}) {
    const plate = image?.asset ? image : null;
    return (
        <article
            className={
                plate ? styles.stage : `${styles.stage} ${styles.stageText}`
            }
        >
            <div className={styles.stageCopy}>
                <MissionLine mission={mission} code={code} />
                <Heading
                    className={styles.stageName}
                    style={{ "--chars": mission.nameChars } as CSSProperties}
                >
                    <Link href={mission.href}>{mission.name}</Link>
                </Heading>
                <p className={styles.stageTitle}>{mission.title}</p>
                {mission.summary ? (
                    <p className={styles.stageSummary}>{mission.summary}</p>
                ) : null}
                {stats ? (
                    <Metrics
                        className={styles.stageMetrics}
                        items={cardStats(mission)}
                        columns={plate ? 2 : 4}
                    />
                ) : null}
                <MissionStack items={mission.technologies} label={copy.stack} />
                <div className={`cluster ${styles.stageActions}`}>
                    <ButtonLink
                        variant="primary"
                        href={mission.href}
                        icon="arrow"
                        iconAt="end"
                    >
                        {copy.openFile}
                    </ButtonLink>
                    {writeUp ? (
                        <LinkArrow href={writeUp}>{copy.readWriteUp}</LinkArrow>
                    ) : null}
                </div>
            </div>
            {plate ? (
                <Plate
                    className={styles.stagePlate}
                    image={plate}
                    label="Pl. I"
                    tag={code ? mission.designation : undefined}
                    caption={caption}
                    ratio="4 / 5"
                    focus="50% 40%"
                    sizes="(min-width: 60rem) 36vw, 100vw"
                    priority={priority}
                />
            ) : null}
        </article>
    );
}
