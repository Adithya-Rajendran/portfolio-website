import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { logCopy as copy } from "@/lib/copy";
import { formatEntryDate, type LogEntry } from "@/lib/log-index";
import styles from "./log-index.module.css";

type TitleTag = "h2" | "h3";

/**
 * One entry on the index's shared tracks: the date it was filed · the
 * title, standfirst and the tags that link (two or more entries each,
 * `LogEntry.tagLinks`) · the read time. A revision's date is the post
 * head's (and its Revisions'), where the reader acts on it. The title's
 * link is stretched over the whole row, so the row is one big target;
 * the tag links stay clickable above it. Ported from the mockup's post
 * row (site.css 4.10, 4.27).
 */
export default function LogRow({
    entry,
    titleAs: Title = "h3",
    tags = true,
}: {
    entry: LogEntry;
    titleAs?: TitleTag;
    /** Whether the row lists its tags. */
    tags?: boolean;
}) {
    return (
        <li className={styles.row} data-slug={entry.slug}>
            <div className={styles.meta}>
                {entry.publishedAt ? (
                    <time className={styles.date} dateTime={entry.publishedAt}>
                        {formatEntryDate(entry.publishedAt)}
                    </time>
                ) : null}
                {entry.readMinutes ? (
                    <span className={styles.read}>
                        {copy.read(entry.readMinutes)}
                        <span className="sr-only">{copy.readSuffix}</span>
                    </span>
                ) : null}
            </div>
            <Title className={styles.title}>
                <Link className="stretch" href={`/blog/${entry.slug}`}>
                    {entry.title}
                </Link>
            </Title>
            {entry.dek ? <p className={styles.dek}>{entry.dek}</p> : null}
            {tags && entry.tagLinks.length > 0 ? (
                <ul className={`tags ${styles.tags}`} aria-label={copy.tagList}>
                    {entry.tagLinks.map((tag) => (
                        <li key={tag}>
                            <Link className="tag" href={`/blog/tags/${tag}`}>
                                {tag}
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
            <Icon name="arrow" className={styles.arrow} />
        </li>
    );
}
