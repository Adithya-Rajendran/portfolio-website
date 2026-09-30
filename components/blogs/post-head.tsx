import Link from "next/link";
import CrumbRow from "@/components/ui/crumb-row";
import { Updated } from "@/components/ui/marks";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import styles from "./post.module.css";

/**
 * The top of an entry (G1): the crumb row (Writing / LOG nnn: the section
 * and the entry's one quiet identifier, as a project file's), then date ·
 * read time · Updated (only after a revision) · the tags that link (two
 * or more entries each; `LogEntry.tagLinks`), the title and the
 * standfirst. Kept short, so the first paragraph reaches the first
 * screen. Ported from the mockup's post.html (`.post-crumbrow`,
 * `.post-head`).
 */
export function PostCrumb({
    designation,
    className,
}: {
    designation?: string;
    className?: string;
}) {
    return (
        <CrumbRow
            className={
                className ? `${styles.crumb} ${className}` : styles.crumb
            }
            ornament="wave"
            label={copy.plain}
            href={siteRoutes.blog}
            code={designation}
        />
    );
}

export function PostHead({
    title,
    description,
    publishedAt,
    revisedAt,
    readMinutes,
    tags,
    className,
}: {
    title: string;
    description?: string | null;
    publishedAt?: string | null;
    revisedAt?: string | null;
    readMinutes: number | null;
    /** The tags that link: a tag with one entry is not shown. */
    tags: readonly string[];
    className?: string;
}) {
    const filed = publishedAt?.slice(0, 10) ?? "";
    return (
        <header className={className}>
            <div className={styles.meta}>
                {filed ? (
                    <time className={styles.metaData} dateTime={filed}>
                        {formatEntryDate(filed)}
                    </time>
                ) : null}
                {readMinutes ? (
                    <span className={styles.metaData}>
                        {copy.read(readMinutes)}
                    </span>
                ) : null}
                {revisedAt ? (
                    <span className={styles.metaData}>
                        <Updated
                            date={revisedAt.slice(0, 10)}
                            label={copy.updated}
                        />
                    </span>
                ) : null}
                {tags.length > 0 ? (
                    <ul
                        className={`tags ${styles.metaTags}`}
                        aria-label={copy.tags}
                    >
                        {tags.map((tag) => (
                            <li key={tag}>
                                <Link
                                    className="tag"
                                    href={`/blog/tags/${tag}`}
                                >
                                    {tag}
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.dek}>{description}</p> : null}
        </header>
    );
}
