import Link from "next/link";
import MissionLine, {
    CARD_STACK,
    MissionStack,
} from "@/components/portfolio/mission-line";
import { ButtonLink } from "@/components/ui/button";
import { LinkArrow } from "@/components/ui/marks";
import Plate from "@/components/ui/plate";
import { missionsCopy as copy } from "@/lib/copy";
import type { Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";

/**
 * The flagship (contract §4 and §9): the mission's line (type, status,
 * dates), its title as the heading, in sentence case, its summary, which
 * leads, its first four stack items, one primary (View the project) and
 * the quiet way to the write-up, in seven columns, top-aligned with its
 * photograph as a plate in five. Without a photograph the copy takes the
 * full width. Shared by /portfolio and the home page. No stats and no
 * mission number: numbers stay on the file beside their notes, and the
 * number is the file's own identifier.
 */
export default function MissionStage({
    mission,
    image,
    caption,
    writeUp,
    as: Heading = "h3",
    priority = false,
}: {
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
                <MissionLine mission={mission} />
                <Heading className={styles.stageHeading}>
                    <Link href={mission.href}>{mission.title}</Link>
                </Heading>
                {mission.summary ? (
                    <p className={styles.stageSummary}>{mission.summary}</p>
                ) : null}
                <MissionStack
                    items={mission.technologies}
                    label={copy.stack}
                    max={CARD_STACK}
                />
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
