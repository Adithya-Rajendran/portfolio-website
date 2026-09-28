import type { CSSProperties } from "react";
import Link from "next/link";
import MissionLine, { MissionStack } from "@/components/portfolio/mission-line";
import { Icon } from "@/components/ui/icon";
import Metrics from "@/components/ui/metrics";
import Plate from "@/components/ui/plate";
import { missionsCopy as copy } from "@/lib/copy";
import type { Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";

/** The row of tiles: 1, 2 or 3 across (/portfolio and the home act). */
export function MissionTiles({ children }: { children: React.ReactNode }) {
    return <div className={styles.tiles}>{children}</div>;
}

/**
 * A mission as a tile (contract §4): text first. Its line, its name in
 * capitals (the link to its file, stretched over the tile), its title, its
 * summary, up to four stats and its stack, under a hairline. A cover adds
 * a 3:2 plate on top; a mission without one is not given a stand-in.
 */
export default function MissionTile({
    mission,
    cover,
    plate,
    as: Heading = "h3",
}: {
    mission: Mission;
    cover?: SanityImageValue | null;
    /** The cover's plate number: "Pl. II". */
    plate?: string;
    as?: "h2" | "h3";
}) {
    return (
        <article className={styles.tile}>
            {cover?.asset && plate ? (
                <Plate
                    className={styles.tilePlate}
                    image={cover}
                    label={plate}
                    tag={mission.designation}
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
                    {mission.name}
                </Link>
            </Heading>
            <p className={styles.tileTitle}>{mission.title}</p>
            {mission.summary ? (
                <p className={styles.tileSummary}>{mission.summary}</p>
            ) : null}
            <Metrics
                className={styles.tileMetrics}
                items={mission.parameters}
                columns={2}
                size="sm"
            />
            <MissionStack items={mission.technologies} label={copy.stack} />
            <Icon name="arrow" className={styles.tileArrow} />
        </article>
    );
}
