import LogRow from "@/components/blogs/log-row";
import type { LogEntry } from "@/lib/log-index";
import styles from "./log-index.module.css";

/**
 * The scannable writing index (G8): one row per entry on shared tracks,
 * newest first, in one list with even spacing (each row's date carries
 * its year). Directive-free.
 *
 * `level` is the entry titles' heading level. `tags={false}` leaves the
 * rows' tags out where a few entries are listed beside other work (the
 * home page, a project's related writing).
 */
export default function LogIndex({
    entries,
    level = 3,
    tags = true,
    className,
}: {
    entries: readonly LogEntry[];
    level?: 2 | 3;
    tags?: boolean;
    className?: string;
}) {
    return (
        <div
            className={
                className ? `${styles.index} ${className}` : styles.index
            }
        >
            <ol className={styles.list} role="list">
                {entries.map((entry) => (
                    <LogRow
                        key={entry.slug}
                        entry={entry}
                        titleAs={level === 2 ? "h2" : "h3"}
                        tags={tags}
                    />
                ))}
            </ol>
        </div>
    );
}
