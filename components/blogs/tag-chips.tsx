import Link from "next/link";
import { logCopy as copy } from "@/lib/copy";
import { entryCount } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { linkedTags, type TagCount } from "@/lib/tags";
import styles from "./tag-chips.module.css";

/** `current` on the index: the "All" chip. Never a valid tag. */
export const ALL_ENTRIES = "*";

/**
 * The Flight Log's tag chips with their counts (G8): "All" and one chip
 * per tag that links (two or more entries, `linkedTags`), each a link to
 * its page, so they work without JavaScript and open in a new tab. The
 * chip for the page you are on is current (a filled chip with a dot,
 * not colour alone). Ported from the mockup's
 * log.html `.log-filter`. The group is named "Tags" for assistive tech
 * only: tag names with their counts need no printed label. Each chip is
 * named "notes, 2 entries" (the count's flex item would otherwise be read
 * apart).
 */
export default function TagChips({
    tags,
    total,
    current,
}: {
    tags: readonly TagCount[];
    /** Every entry: the count on "All". */
    total: number;
    /** The chip for this page: ALL_ENTRIES on the index, the tag on its
     *  page, none on the archive. */
    current?: string;
}) {
    const linked = linkedTags(tags);
    if (!linked.length) return null;
    return (
        <div className={styles.group} role="group" aria-label={copy.tags}>
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
                {linked.map(({ tag, count }) => (
                    <li key={tag}>
                        <Link
                            className={`chip ${styles.chip}`}
                            href={`/blog/tags/${tag}`}
                            aria-current={tag === current ? "page" : undefined}
                            aria-label={`${tag}, ${entryCount(count)}`}
                        >
                            {tag}
                            <span className="chip__count">{count}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
