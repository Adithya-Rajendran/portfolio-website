import { postCopy as copy } from "@/lib/copy";
import type { PostHeading } from "@/lib/headings";
import styles from "./post.module.css";

/**
 * An entry's contents (G1). On a wide screen they are the sticky rail
 * beside the text (`PostRail`); on a phone they sit in a closed
 * disclosure above the text (`PostBox`), so the first paragraph stays in
 * the first screen. CSS shows one of the two; both are server-rendered,
 * so they work without JavaScript. The contents are `nav aria-label="On
 * this page"`, never an `aside` inside `main`. PostReader marks the
 * current section. An entry without sections has neither. The date, the
 * read time and any revision are the head's alone: the rail repeats none
 * of them.
 */

function Contents({
    headings,
    titled = true,
}: {
    headings: readonly PostHeading[];
    titled?: boolean;
}) {
    return (
        <nav
            className={styles.contents}
            aria-label={copy.contentsLabel}
            data-contents
        >
            {titled ? (
                <p className={`label ${styles.contentsTitle}`}>
                    {copy.contents}
                </p>
            ) : null}
            <ol className={styles.contentsList} role="list">
                {headings.map((heading) => (
                    <li key={heading.key}>
                        <a href={`#${heading.id}`}>{heading.text}</a>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/** The sticky rail beside the text (≥ 960px). */
export function PostRail({
    headings,
    className,
}: {
    headings: readonly PostHeading[];
    className?: string;
}) {
    if (!headings.length) return null;
    return (
        <div className={className} data-print="hide">
            <Contents headings={headings} />
        </div>
    );
}

/** The same contents as a closed disclosure above the text (< 960px). */
export function PostBox({
    headings,
    className,
}: {
    headings: readonly PostHeading[];
    className?: string;
}) {
    if (!headings.length) return null;
    return (
        <details className={className} data-print="hide" data-entry-box>
            <summary className={styles.boxSummary}>
                <span className="label">{copy.contents}</span>
            </summary>
            <div className={styles.boxBody}>
                <Contents headings={headings} titled={false} />
            </div>
        </details>
    );
}
