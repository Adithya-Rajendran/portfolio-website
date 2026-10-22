import Contents from "@/components/ui/contents";
import { postCopy as copy } from "@/lib/copy";
import type { PostHeading } from "@/lib/headings";
import styles from "./post.module.css";

/**
 * An entry's contents (G1). On a wide screen they are the sticky rail
 * beside the text (`PostRail`); on a phone they sit in a closed
 * disclosure above the text (`PostBox`), so the first paragraph stays in
 * the first screen. CSS shows one of the two; both are server-rendered,
 * so they work without JavaScript. Both are the shared `Contents`
 * (components/ui/contents.tsx, as a project's essay is). PostReader marks
 * the current section. An entry with fewer than two sections has neither (a
 * one-item contents leads nowhere new), and the rail's column is space.
 * The date, the read time and any revision are the head's alone: the
 * rail repeats none of them.
 */

/** Contents need at least this many sections to lead anywhere. */
const CONTENTS_MIN = 2;

/** The sticky rail beside the text (≥ 960px). */
export function PostRail({
    headings,
    className,
}: {
    headings: readonly PostHeading[];
    className?: string;
}) {
    if (headings.length < CONTENTS_MIN) return null;
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
    if (headings.length < CONTENTS_MIN) return null;
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
