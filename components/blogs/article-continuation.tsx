import LogIndex from "@/components/blogs/log-index";
import MissionRow, { MissionRows } from "@/components/portfolio/mission-row";
import Pager, { type PagerLink } from "@/components/ui/pager";
import SectionTag from "@/components/ui/section-tag";
import { siteConfig } from "@/lib/config";
import { postCopy as copy } from "@/lib/copy";
import type { LogEntry } from "@/lib/log-index";
import { toMission } from "@/lib/missions";
import type { ProjectListItem } from "@/lib/sanity-client";
import styles from "./post.module.css";

/**
 * After an entry (G1): the entries filed just before and after it (the
 * shared `Pager`, names only, only the sides that exist), then the
 * project it belongs to (only when the owner linked one, as the shared
 * project row) and other entries that share a tag (only when there are
 * any). The end matter above it closes the entry itself; the footer
 * carries the author. Every block is server-rendered links; empty blocks
 * are left out. Ported from the mockup's post.html `.post-end`.
 */

/** A neighbouring entry as a pager side: "Next entry", then its title. */
function pagerLink(
    entry: LogEntry | null,
    direction: "previous" | "next",
): PagerLink | null {
    if (!entry) return null;
    return {
        href: `/blog/${entry.slug}`,
        label: direction === "previous" ? copy.previous : copy.next,
        title: entry.title,
    };
}

function Block({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.endSection}>
            <SectionTag>
                <h2 className="section-tag__h" id={id}>
                    {title}
                </h2>
            </SectionTag>
            {children}
        </div>
    );
}

export default function ArticleContinuation({
    missions,
    previous,
    next,
    related,
    className,
}: {
    missions: readonly ProjectListItem[];
    previous: LogEntry | null;
    next: LogEntry | null;
    related: readonly LogEntry[];
    className?: string;
}) {
    if (!previous && !next && !missions.length && !related.length) {
        return null;
    }
    return (
        <section
            className={className}
            aria-label={copy.after}
            data-print="hide"
        >
            <div className={styles.end}>
                <Pager
                    className={styles.pager}
                    label={copy.pager}
                    previous={pagerLink(previous, "previous")}
                    next={pagerLink(next, "next")}
                />
                {missions.length > 0 ? (
                    <Block
                        id="entry-mission"
                        title={copy.projects(missions.length)}
                    >
                        <MissionRows>
                            {missions.map((project) => (
                                <MissionRow
                                    key={project._id}
                                    mission={toMission(project, siteConfig.url)}
                                />
                            ))}
                        </MissionRows>
                    </Block>
                ) : null}
                {related.length > 0 ? (
                    <Block id="entry-related" title={copy.related}>
                        <LogIndex entries={related} level={3} />
                    </Block>
                ) : null}
            </div>
        </section>
    );
}
