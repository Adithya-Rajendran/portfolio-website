import { Status } from "@/components/ui/marks";
import type { Mission } from "@/lib/missions";
import styles from "./missions.module.css";

/**
 * A mission's one metadata line (contract §11): TYPE · ● Status · dates.
 * It never wraps: where it would, the type is dropped first. A value that
 * is not set is simply absent. The mission number is not on it: it is the
 * file's quiet identifier, in the file's crumb.
 */
export default function MissionLine({
    mission,
    className,
}: {
    mission: Pick<Mission, "types" | "statusValue" | "statusLabel" | "dates">;
    className?: string;
}) {
    return (
        <div
            className={
                className ? `${styles.lineBox} ${className}` : styles.lineBox
            }
        >
            <p className={styles.line}>
                {mission.types.length ? (
                    <span className={styles.type}>
                        {mission.types.join(" · ")}
                    </span>
                ) : null}
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

/** The stack as a quiet mono list. */
export function MissionStack({
    items,
    label,
    className,
}: {
    items: readonly string[];
    label: string;
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
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}
