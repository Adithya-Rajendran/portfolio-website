import type { CSSProperties } from "react";
import Link from "next/link";
import MissionLine, { MissionStack } from "@/components/portfolio/mission-line";
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
 * dates), its heading (the link to its file, stretched over the tile:
 * the owner's short name over the title, else the title alone), its
 * summary and its stack, under a hairline. Numbers stay on the file,
 * beside their notes. A cover adds a 3:2 plate on top; a mission without
 * one is not given a stand-in.
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
                    caption={cover.caption}
                    ratio="3 / 2"
                    sizes="(min-width: 60rem) 30vw, 100vw"
                    width={900}
                />
            ) : null}
            <MissionLine mission={mission} />
            <Heading
                className={styles.tileName}
                style={{ "--chars": mission.nameChars } as CSSProperties}
            >
                <Link className="stretch" href={mission.href}>
                    {mission.label}
                </Link>
            </Heading>
            {mission.name ? (
                <p className={styles.tileTitle}>{mission.title}</p>
            ) : null}
            {mission.summary ? (
                <p className={styles.tileSummary}>{mission.summary}</p>
            ) : null}
            <MissionStack items={mission.technologies} label={copy.stack} />
            <Icon name="arrow" className={styles.tileArrow} />
        </article>
    );
}
