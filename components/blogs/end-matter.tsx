import Link from "next/link";
import CopyButton from "@/components/blogs/copy-button";
import FollowLinks from "@/components/blogs/follow-links";
import Footnotes from "@/components/prose/footnotes";
import { LinkArrow, Rev } from "@/components/ui/marks";
import { postCopy as copy } from "@/lib/copy";
import { contactHref, siteRoutes } from "@/lib/navigation";
import { changeKindTitle } from "@/lib/post-fields";
import type { NoteInfo } from "@/lib/prose";
import type { ExternalLink, PostChange } from "@/lib/sanity-client";
import styles from "./post.module.css";

/**
 * The end of an entry (G1, G7): the numbered notes, the revisions (each
 * dated with a revision mark; corrections are errata), the end mark, and
 * what to do next: reply through Comms (the contact form's Hello route,
 * no email address), follow the writing (one quiet line), copy the link,
 * or go back to the index. The entry's LOG number is the crumb's alone.
 * A post gets a revision entry only for a real change the owner recorded.
 */
export default function EndMatter({
    notes,
    changelog,
    url,
    linkedIn,
    className,
}: {
    notes: readonly NoteInfo[];
    changelog: readonly PostChange[];
    /** The entry's canonical address, for Copy link. */
    url: string;
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
                        {copy.revisions.title}
                    </h2>
                    <ol className={styles.revisionList} role="list">
                        {revisions.map((change) => (
                            <li
                                key={change._key}
                                className={styles.revision}
                                data-kind={change.kind}
                            >
                                <p className={styles.revisionHead}>
                                    <Rev
                                        date={change.date.slice(0, 10)}
                                        label={copy.revisions.rev}
                                    />
                                    <span className={styles.revisionKind}>
                                        {changeKindTitle(change.kind)}
                                    </span>
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
            <div className={styles.actions} data-print="hide">
                <p className={styles.actionsNote}>
                    {copy.question}{" "}
                    <Link href={contactHref("hello")}>{copy.reply}</Link>.
                </p>
                <FollowLinks linkedIn={linkedIn} />
                <div className={`cluster ${styles.actionsRow}`}>
                    <CopyButton
                        text={url}
                        idle={copy.copyLink}
                        done={copy.linkCopied}
                        failed={copy.listing.failed}
                        label={copy.copyLinkLabel}
                        announceDone={copy.linkCopied}
                        announceFailed={copy.listing.announceFailed}
                    />
                    <LinkArrow href={siteRoutes.blog}>
                        {copy.allEntries}
                    </LinkArrow>
                </div>
            </div>
        </footer>
    );
}
