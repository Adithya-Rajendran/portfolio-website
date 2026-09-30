import type { Metadata } from "next";
import ArchiveList from "@/components/blogs/archive-list";
import TagChips from "@/components/blogs/tag-chips";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { feedAlternates } from "@/lib/feed";
import { logEntries, offersFilters } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import styles from "../log.module.css";

const copy = logCopy.archive;

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getWritingDescription(profile);
    const described = description ? { description } : {};
    const name = profile?.name || siteConfig.author;
    const title = `${copy.title} · ${logCopy.plain}`;
    const url = `${siteConfig.url}${siteRoutes.archive}`;
    return {
        title,
        ...described,
        alternates: feedAlternates(url),
        openGraph: { title: `${title} | ${name}`, ...described, url },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            ...described,
        },
    };
}

/**
 * Archive: every entry in the writing index (by year once the entries
 * span two), with a search over titles, standfirsts and tags, and the tag
 * chips once a tag gathers two or more entries (`offersFilters`, as on
 * /blog). The head is the title alone: the search explains itself, and
 * the header's Writing leads back. The whole list is server-rendered;
 * only the search needs JavaScript.
 */
export default async function ArchivePage() {
    const entries = logEntries(await getAllPosts());
    const tags = collectTags(entries);

    return (
        <div data-page="archive" className={styles.page}>
            <PageHead
                className="shell"
                split
                tag={logCopy.themed}
                title={copy.title}
            />

            <section className={`section ${styles.index}`}>
                <div className={`shell ${styles.indexInner}`}>
                    <ArchiveList entries={entries}>
                        {offersFilters(tags) ? (
                            <TagChips tags={tags} total={entries.length} />
                        ) : null}
                    </ArchiveList>
                </div>
            </section>
        </div>
    );
}
