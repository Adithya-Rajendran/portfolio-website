import FollowLinks from "@/components/blogs/follow-links";
import Footnotes from "@/components/prose/footnotes";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate } from "@/lib/log-index";
import { changeKindTitle } from "@/lib/post-fields";
import type { NoteInfo } from "@/lib/prose";
import type { ExternalLink, PostChange } from "@/lib/sanity-client";
import styles from "./post.module.css";

/**
 * The end of an entry (G1, G7): the numbered notes, the revisions (each
 * dated in the site's format, "30 Jun 2026 · Correction"; corrections are
 * errata), the end mark, and the one way on: follow the writing (one
 * quiet line). The header's Contact and Writing, and the crumb, are in
 * reach; the pager continues the reading. A post gets a revision entry
 * only for a real change the owner recorded.
 */
export default function EndMatter({
    notes,
    changelog,
    linkedIn,
    className,
}: {
    notes: readonly NoteInfo[];
    changelog: readonly PostChange[];
    /** The owner's LinkedIn, the follow line's second link. */
    linkedIn?: ExternalLink | null;
    className?: string;
}) {
    const revisions = [...changelog]
        .filter((change) => change.date && change.note)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return (
        <footer className={className}>
            <Footnotes notes={notes} className={styles.endBlock} />
            {revisions.length > 0 ? (
                <section
                    className={`${styles.endBlock} ${styles.revisions}`}
                    aria-labelledby="entry-revisions"
                >
                    <h2 className={styles.endTitle} id="entry-revisions">
                        {copy.revisions}
                    </h2>
                    <ol className={styles.revisionList} role="list">
                        {revisions.map((change) => (
                            <li
                                key={change._key}
                                className={styles.revision}
                                data-kind={change.kind}
                            >
                                <p className={styles.revisionHead}>
                                    <time dateTime={change.date.slice(0, 10)}>
                                        {formatEntryDate(change.date)}
                                    </time>
                                    {" · "}
                                    {changeKindTitle(change.kind)}
                                </p>
                                <p className={styles.revisionNote}>
                                    {change.note}
                                </p>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}
            <div className={styles.endmark}>
                <p className="label">{copy.end}</p>
            </div>
            <div className={styles.follow} data-print="hide">
                <FollowLinks linkedIn={linkedIn} />
            </div>
        </footer>
    );
}
