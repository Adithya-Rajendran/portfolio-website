import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Status } from "@/components/ui/marks";
import Plate from "@/components/ui/plate";
import type { Mission } from "@/lib/missions";
import type { SanityImageValue } from "@/lib/sanity-client";
import styles from "./missions.module.css";

/**
 * A project as a compact row (contract §4's card rule): its status and
 * dates, its title (the link to its file, over the whole row) and its
 * summary, under a hairline. The home page's rows after the flagship,
 * and /portfolio's least prominent projects. A cover adds a 3:2
 * thumbnail beside the line and title, its caption set as its credit
 * ("Illustration"), so the row stays smaller than the stage's plate.
 */
export default function MissionRow({
    mission,
    cover,
    as: Heading = "h3",
}: {
    mission: Mission;
    cover?: SanityImageValue | null;
    as?: "h3" | "h4";
}) {
    return (
        <li
            className={
                cover?.asset ? `${styles.row} ${styles.rowCovered}` : styles.row
            }
        >
            {cover?.asset ? (
                <Plate
                    className={styles.rowPlate}
                    image={cover}
                    credit={cover.caption}
                    ratio="3 / 2"
                    sizes="(min-width: 60rem) 14vw, 32vw"
                    width={600}
                />
            ) : null}
            <p className={styles.rowLine}>
                <Status value={mission.statusValue}>
                    {mission.statusLabel}
                </Status>
                {mission.dates ? (
                    <span className={styles.rowDates}>{mission.dates}</span>
                ) : null}
            </p>
            <Heading className={styles.rowTitle}>
                <Link className="stretch" href={mission.href}>
                    {mission.title}
                </Link>
            </Heading>
            {mission.summary ? (
                <p className={styles.rowSummary}>{mission.summary}</p>
            ) : null}
            <Icon name="arrow" className={styles.rowArrow} />
        </li>
    );
}

/** The rows' list: one column, two across from 960px. `quiet` sets
 *  them a step smaller (/portfolio's least prominent projects). */
export function MissionRows({
    children,
    quiet = false,
    className,
}: {
    children: React.ReactNode;
    quiet?: boolean;
    className?: string;
}) {
    return (
        <ul
            className={[styles.rows, quiet && styles.rowsQuiet, className]
                .filter(Boolean)
                .join(" ")}
            role="list"
        >
            {children}
        </ul>
    );
}
