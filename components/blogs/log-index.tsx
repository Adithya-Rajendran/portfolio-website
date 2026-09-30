import LogRow from "@/components/blogs/log-row";
import type { LogEntry } from "@/lib/log-index";
import { groupPostsByYear } from "@/lib/tags";
import styles from "./log-index.module.css";

/**
 * The scannable writing index (G8): one row per entry on shared tracks,
 * newest first, grouped by year under the year's heading. `grouped={false}`
 * lists the entries without year heads (the home page's latest three,
 * whose dates carry their year). Directive-free: the archive's client
 * search renders it too.
 *
 * `level` is the year's heading level; entry titles sit one below it
 * (and at `level` when the list is not grouped). `tags={false}` leaves
 * the rows' tags out where a few entries are listed beside other work
 * (the home page, a project's related writing).
 */
export default function LogIndex({
    entries,
    level = 3,
    grouped = true,
    tags = true,
    matchTag,
    className,
}: {
    entries: readonly LogEntry[];
    level?: 2 | 3;
    grouped?: boolean;
    tags?: boolean;
    matchTag?: string;
    className?: string;
}) {
    const Year = level === 2 ? "h2" : "h3";
    const titleAs = level === 2 ? "h3" : "h4";
    const classes = className ? `${styles.index} ${className}` : styles.index;
    if (!grouped) {
        return (
            <div className={classes}>
                <ol className={styles.list} role="list">
                    {entries.map((entry) => (
                        <LogRow
                            key={entry.slug}
                            entry={entry}
                            titleAs={level === 2 ? "h2" : "h3"}
                            tags={tags}
                            matchTag={matchTag}
                        />
                    ))}
                </ol>
            </div>
        );
    }
    return (
        <div className={classes}>
            {groupPostsByYear([...entries]).map((group) => (
                <div className={styles.group} key={group.year}>
                    <Year className={styles.year}>{group.year}</Year>
                    <ol className={styles.list} role="list">
                        {group.posts.map((entry) => (
                            <LogRow
                                key={entry.slug}
                                entry={entry}
                                titleAs={titleAs}
                                tags={tags}
                                matchTag={matchTag}
                            />
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    );
}
