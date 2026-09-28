import Link from "next/link";
import { logCopy as copy } from "@/lib/copy";
import { entryCount } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import type { TagCount } from "@/lib/tags";
import styles from "./tag-chips.module.css";

/** `current` on the index: the "All" chip. Never a valid tag. */
export const ALL_ENTRIES = "*";

/**
 * The Flight Log's tag chips with their counts (G8): "All" and one chip
 * per tag, each a link to its page, so they work without JavaScript and
 * open in a new tab. The chip for the page you are on is current (a filled
 * chip with a dot and an orange underline, not colour alone). Ported from
 * the mockup's log.html `.log-filter`. Each chip is named "homelab, 1
 * entry" (the count's flex item would otherwise be read apart).
 */
export default function TagChips({
    tags,
    total,
    current,
    id = "log-tags",
}: {
    tags: readonly TagCount[];
    /** Every entry: the count on "All". */
    total: number;
    /** The chip for this page: ALL_ENTRIES on the index, the tag on its
     *  page, none on the archive. */
    current?: string;
    /** The label's id: unique on the page. */
    id?: string;
}) {
    if (!tags.length) return null;
    return (
        <div className={styles.group} role="group" aria-labelledby={id}>
            <p className={`label ${styles.label}`} id={id}>
                {copy.tags}
            </p>
            <ul className={styles.chips} role="list">
                <li>
                    <Link
                        className={`chip ${styles.chip}`}
                        href={siteRoutes.blog}
                        aria-current={
                            current === ALL_ENTRIES ? "page" : undefined
                        }
                        aria-label={`${copy.all}, ${entryCount(total)}`}
                    >
                        {copy.all}
                        <span className="chip__count">{total}</span>
                    </Link>
                </li>
                {tags.map(({ tag, count }) => (
                    <li key={tag}>
                        <Link
                            className={`chip ${styles.chip}`}
                            href={`/blog/tags/${tag}`}
                            aria-current={tag === current ? "page" : undefined}
                            aria-label={`${tag}, ${entryCount(count)}`}
                        >
                            <span className={styles.hash}>#</span>
                            {tag}
                            <span className="chip__count">{count}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
