import CrumbRow from "@/components/ui/crumb-row";
import { Updated } from "@/components/ui/marks";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import styles from "./post.module.css";

/**
 * The top of an entry (G1): the crumb row (Writing, the section alone, as
 * a project's), then date · read time · Updated (only after a revision),
 * the title and the standfirst, which say the topic: the tags that link
 * are the index's (/blog's rows). Kept short, so the first paragraph
 * reaches the first screen. Ported from the mockup's post.html
 * (`.post-crumbrow`, `.post-head`).
 */
export function PostCrumb({ className }: { className?: string }) {
    return (
        <CrumbRow
            className={className}
            label={copy.plain}
            href={siteRoutes.blog}
        />
    );
}

export function PostHead({
    title,
    description,
    publishedAt,
    revisedAt,
    readMinutes,
    className,
}: {
    title: string;
    description?: string | null;
    publishedAt?: string | null;
    revisedAt?: string | null;
    readMinutes: number | null;
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
            </div>
            <h1 className={styles.title}>{title}</h1>
            {description ? <p className={styles.dek}>{description}</p> : null}
        </header>
    );
}
