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
 * home page, a project's related writing). `stacked` keeps the phone's
 * rows at every width, for a column as narrow as the text (a post's
 * related entries).
 */
export default function LogIndex({
    entries,
    level = 3,
    tags = true,
    stacked = false,
    className,
}: {
    entries: readonly LogEntry[];
    level?: 2 | 3;
    tags?: boolean;
    stacked?: boolean;
    className?: string;
}) {
    return (
        <div
            className={[styles.index, stacked && styles.stacked, className]
                .filter(Boolean)
                .join(" ")}
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
