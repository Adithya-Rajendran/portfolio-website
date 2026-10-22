import Link from "next/link";
import MissionLine, {
    CARD_STACK,
    MissionStack,
} from "@/components/portfolio/mission-line";
import { Icon } from "@/components/ui/icon";
import Plate from "@/components/ui/plate";
import { minWidth } from "@/lib/breakpoints";
import { missionsCopy as copy } from "@/lib/copy";
import type { Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";
import KeepWhole from "@/components/ui/keep-whole";

/** The row of tiles: one column, two across from 960px, where a lone
 *  tile spans both (/portfolio). */
export function MissionTiles({ children }: { children: React.ReactNode }) {
    return <div className={styles.tiles}>{children}</div>;
}

/**
 * A mission as a tile (contract §4): text first. Its line (status,
 * dates), its title as the heading (the link to its file, stretched over
 * the tile), its summary and its first four stack items, under a
 * hairline. Numbers stay on the file, beside their notes. A cover adds a
 * 3:2 thumbnail beside the title, its caption set as its credit
 * ("Illustration"), so the tile stays smaller than the stage's plate; a
 * mission without one is not given a stand-in. The arrow ends the line.
 * The cover follows the title in the source (the grid's `plate` area
 * draws it beside the title), so a card reads line, title, then the
 * image and its credit: the credit never leads the card.
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
        <article
            className={
                cover?.asset
                    ? `${styles.tile} ${styles.tileCovered}`
                    : styles.tile
            }
        >
            <div className={styles.tileHead}>
                <MissionLine mission={mission} />
                <Icon name="arrow" className={styles.tileArrow} />
            </div>
            <Heading className={styles.tileName}>
                <Link className="stretch" href={mission.href}>
                    {mission.title}
                </Link>
            </Heading>
            {cover?.asset ? (
                <Plate
                    className={styles.tilePlate}
                    image={cover}
                    credit={cover.caption}
                    ratio="3 / 2"
                    sizes={`${minWidth("md")} 15vw, ${minWidth("sm")} 30vw, 37vw`}
                    width={600}
                />
            ) : null}
            {mission.summary ? (
                <p className={styles.tileSummary}>
                    <KeepWhole text={mission.summary} />
                </p>
            ) : null}
            <MissionStack
                items={mission.technologies}
                label={copy.stack}
                max={CARD_STACK}
            />
        </article>
    );
}
