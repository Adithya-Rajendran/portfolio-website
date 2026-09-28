import LogRow from "@/components/blogs/log-row";
import { logCopy as copy } from "@/lib/copy";
import type { LogEntry } from "@/lib/log-index";
import { groupPostsByYear } from "@/lib/tags";
import styles from "./log-index.module.css";

/**
 * The scannable Flight Log index (G8): a column head and one row per entry
 * on shared tracks, grouped by year, newest first. The year heads the
 * Entry column of its group, so a group costs no extra row on a wide
 * screen. The column names are drawn for sighted readers only; each row
 * carries its own values. Directive-free: the archive's client search
 * renders it too.
 *
 * `level` is the year's heading level; entry titles sit one below it.
 */
export default function LogIndex({
    entries,
    level = 3,
    matchTag,
    className,
}: {
    entries: readonly LogEntry[];
    level?: 2 | 3;
    matchTag?: string;
    className?: string;
}) {
    const Year = level === 2 ? "h2" : "h3";
    const titleAs = level === 2 ? "h3" : "h4";
    return (
        <div
            className={
                className ? `${styles.index} ${className}` : styles.index
            }
        >
            {groupPostsByYear([...entries]).map((group) => (
                <div className={styles.group} key={group.year}>
                    <div className={styles.head}>
                        <Year className={styles.year}>{group.year}</Year>
                        <span aria-hidden="true">{copy.columns.filed}</span>
                        <span aria-hidden="true">{copy.columns.title}</span>
                        <span aria-hidden="true">{copy.columns.read}</span>
                    </div>
                    <ol className={styles.list} role="list">
                        {group.posts.map((entry) => (
                            <LogRow
                                key={entry.slug}
                                entry={entry}
                                titleAs={titleAs}
                                matchTag={matchTag}
                            />
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    );
}
