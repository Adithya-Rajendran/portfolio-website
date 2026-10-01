import type { Metadata } from "next";
import FollowLinks from "@/components/blogs/follow-links";
import LogIndex from "@/components/blogs/log-index";
import { BlogJsonLd } from "@/components/json-ld";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { feedAlternates } from "@/lib/feed";
import { logEntries } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink, getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
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
 * ("Follow: RSS · LinkedIn"), then every entry in the scannable index,
 * one list ending on its closing rule. The rows' tags lead to their
 * pages. Everything is server-rendered links, so the page is complete
 * without JavaScript. /blog/archive answers 308 here. Ported from the
 * mockup's log.html.
 */
export default async function WritingPage() {
    const [posts, profile] = await Promise.all([getAllPosts(), getProfile()]);
    const entries = logEntries(posts);
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
                    {entries.length ? (
                        <LogIndex entries={entries} level={2} />
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
