import type { Metadata } from "next";
import FollowLinks from "@/components/blogs/follow-links";
import LogIndex from "@/components/blogs/log-index";
import TagChips, { ALL_ENTRIES } from "@/components/blogs/tag-chips";
import { BlogJsonLd } from "@/components/json-ld";
import { LinkArrow } from "@/components/ui/marks";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { feedAlternates } from "@/lib/feed";
import { logEntries, offersFilters } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink, getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import styles from "./log.module.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getWritingDescription(profile);
    const described = description ? { description } : {};
    const name = profile?.name || siteConfig.author;
    const title = copy.plain;
    const url = `${siteConfig.url}${siteRoutes.blog}`;
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
 * Writing (/blog; themed Flight Log, G8): the page head with the owner's
 * description of his writing and one quiet line of ways to follow it
 * ("Follow: RSS · LinkedIn"), then every entry in the scannable index
 * (grouped by year once the entries span two), then a quiet link to the
 * searchable archive. The tag chips appear once a tag gathers two or
 * more entries (`offersFilters`); until then the list is short enough to
 * read whole. Everything is server-rendered links, so the page is
 * complete without JavaScript. Ported from the mockup's log.html.
 */
export default async function WritingPage() {
    const [posts, profile] = await Promise.all([getAllPosts(), getProfile()]);
    const entries = logEntries(posts);
    const tags = collectTags(entries);
    const filters = offersFilters(tags);
    const linkedIn = getProfileLink(profile, "linkedin");

    return (
        <div data-page="log" className={styles.page}>
            <BlogJsonLd />
            <PageHead
                className="shell"
                split
                tag={copy.themed}
                title={copy.plain}
                intro={getWritingDescription(profile)}
            >
                <FollowLinks
                    className="page-head__actions"
                    linkedIn={linkedIn}
                />
            </PageHead>

            <section className={`section ${styles.index}`}>
                <div className={`shell ${styles.indexInner}`}>
                    {filters ? (
                        <TagChips
                            tags={tags}
                            total={entries.length}
                            current={ALL_ENTRIES}
                        />
                    ) : null}
                    {entries.length ? (
                        <>
                            <LogIndex entries={entries} level={2} />
                            <LinkArrow
                                className={styles.archive}
                                href={siteRoutes.archive}
                            >
                                {copy.archive.title}
                            </LinkArrow>
                        </>
                    ) : (
                        <div className={styles.empty}>
                            <p className={styles.emptyTitle}>{copy.empty}</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
