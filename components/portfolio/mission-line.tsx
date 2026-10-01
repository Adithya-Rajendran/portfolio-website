import { Status } from "@/components/ui/marks";
import type { Mission } from "@/lib/missions";
import styles from "./missions.module.css";

/**
 * A mission's one metadata line (contract §11): ● Status · dates. No type:
 * the title and the summary say what kind of project it is. A value that
 * is not set is simply absent. The mission number is not on it: it is the
 * file's quiet identifier, in the file's crumb.
 */
export default function MissionLine({
    mission,
    className,
}: {
    mission: Pick<Mission, "statusValue" | "statusLabel" | "dates">;
    className?: string;
}) {
    return (
        <div
            className={
                className ? `${styles.lineBox} ${className}` : styles.lineBox
            }
        >
            <p className={styles.line}>
                <Status value={mission.statusValue}>
                    {mission.statusLabel}
                </Status>
                {mission.dates ? (
                    <span className={styles.dates}>{mission.dates}</span>
                ) : null}
            </p>
        </div>
    );
}

/** How many stack items a card (the stage, a tile) lists, in the
 *  owner's order; the project's page lists them all. */
export const CARD_STACK = 4;

/** The stack as a quiet mono list, each item kept whole; `max` lists the
 *  first ones only. */
export function MissionStack({
    items,
    label,
    max,
    className,
}: {
    items: readonly string[];
    label: string;
    max?: number;
    className?: string;
}) {
    if (!items.length) return null;
    return (
        <ul
            className={
                className ? `${styles.stack} ${className}` : styles.stack
            }
            aria-label={label}
            role="list"
        >
            {items.slice(0, max).map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}
