import Link from "next/link";
import MissionLine, {
    CARD_STACK,
    MissionStack,
} from "@/components/portfolio/mission-line";
import { Icon } from "@/components/ui/icon";
import Plate from "@/components/ui/plate";
import { missionsCopy as copy } from "@/lib/copy";
import type { Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";

/** The row of tiles: one on phones, then two across (/portfolio). */
export function MissionTiles({ children }: { children: React.ReactNode }) {
    return <div className={styles.tiles}>{children}</div>;
}

/**
 * A mission as a tile (contract §4): text first. Its line (type, status,
 * dates), its title as the heading (the link to its file, stretched over
 * the tile), its summary and its first four stack items, under a
 * hairline. Numbers stay on the file, beside their notes. A cover adds a
 * 3:2 plate on top, its caption set as its credit ("Illustration"); a
 * mission without one is not given a stand-in. The arrow ends the line.
 */
export default function MissionTile({
    mission,
    cover,
    as: Heading = "h3",
}: {
    mission: Mission;
    cover?: SanityImageValue | null;
    as?: "h2" | "h3";
}) {
    return (
        <article className={styles.tile}>
            {cover?.asset ? (
                <Plate
                    className={styles.tilePlate}
                    image={cover}
                    credit={cover.caption}
                    ratio="3 / 2"
                    sizes="(min-width: 37.5rem) 45vw, 100vw"
                />
            ) : null}
            <div className={styles.tileHead}>
                <MissionLine mission={mission} />
                <Icon name="arrow" className={styles.tileArrow} />
            </div>
            <Heading className={styles.tileName}>
                <Link className="stretch" href={mission.href}>
                    {mission.title}
                </Link>
            </Heading>
            {mission.summary ? (
                <p className={styles.tileSummary}>{mission.summary}</p>
            ) : null}
            <MissionStack
                items={mission.technologies}
                label={copy.stack}
                max={CARD_STACK}
            />
        </article>
    );
}
