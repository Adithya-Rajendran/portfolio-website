import type { Metadata } from "next";
import LogIndex from "@/components/blogs/log-index";
import TagChips, { ALL_ENTRIES } from "@/components/blogs/tag-chips";
import Transmissions from "@/components/blogs/transmissions";
import { BlogJsonLd } from "@/components/json-ld";
import StaticStars from "@/components/sky/static-stars";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import DocSection from "@/components/ui/doc-section";
import { Icon } from "@/components/ui/icon";
import PageHead from "@/components/ui/page-head";
import Pair from "@/components/ui/pair";
import SectionTag from "@/components/ui/section-tag";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { logEntries } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLink, getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { collectTags } from "@/lib/tags";
import { transmissions } from "@/lib/transmissions";
import styles from "./log.module.css";

export async function generateMetadata(): Promise<Metadata> {
    const profile = await getProfile();
    const description = getWritingDescription(profile);
    const described = description ? { description } : {};
    const name = profile?.name || siteConfig.author;
    const title = `${copy.themed} · ${copy.plain}`;
    const url = `${siteConfig.url}${siteRoutes.blog}`;
    return {
        title,
        ...described,
        alternates: { canonical: url },
        openGraph: { title: `${title} | ${name}`, ...described, url },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${name}`,
            ...described,
        },
    };
}

/** "adithya-rajendran.com/feed.xml": an address without its scheme. */
function host(url: string): string {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Flight Log · Blog (G8): the page head with the owner's description of
 * his writing, Fig. 1 (every entry on a time axis), the scannable index
 * grouped by year with tag chips and their counts, and the Downlink (RSS
 * and LinkedIn; there is no newsletter). Everything is server-rendered
 * links, so the page is complete without JavaScript. Below 960px the chart
 * follows the index, so the first entries reach the first viewport.
 * Ported from the mockup's log.html (§ 01).
 */
export default async function FlightLogPage() {
    const [posts, profile, today] = await Promise.all([
        getAllPosts(),
        getProfile(),
        getToday(),
    ]);
    const entries = logEntries(posts);
    const tags = collectTags(entries);
    const chart = transmissions(entries, today);
    const linkedIn = getProfileLink(profile, "linkedin");

    return (
        <div data-page="log" className={styles.page}>
            <BlogJsonLd />
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    split
                    ornament="wave"
                    num={copy.num}
                    themed={copy.themed}
                    plain={copy.plain}
                    intro={getWritingDescription(profile)}
                >
                    <div className="cluster page-head__actions">
                        <a
                            className={buttonClass({ size: "sm" })}
                            href="#downlink"
                        >
                            <Icon name="rss" />
                            {copy.follow}
                        </a>
                        {entries.length > 0 ? (
                            <ButtonLink
                                size="sm"
                                icon="search"
                                href="/blog/archive"
                            >
                                {copy.search}
                            </ButtonLink>
                        ) : null}
                    </div>
                </PageHead>
            </div>

            {chart ? (
                <Transmissions
                    chart={chart}
                    className={`shell ${styles.chart}`}
                />
            ) : null}

            <section
                className={`section ${styles.index}`}
                aria-labelledby="log-index-h"
            >
                <div className={`shell ${styles.indexInner}`}>
                    <SectionTag num={`${copy.num}.1`}>
                        <h2 className="section-tag__h" id="log-index-h">
                            <Pair
                                themed={copy.indexThemed}
                                plain={copy.indexPlain}
                            />
                        </h2>
                    </SectionTag>
                    <TagChips
                        tags={tags}
                        total={entries.length}
                        current={ALL_ENTRIES}
                    />
                    {entries.length ? (
                        <LogIndex entries={entries} level={3} />
                    ) : (
                        <div className={styles.empty}>
                            <p className={styles.emptyTitle}>{copy.empty}</p>
                        </div>
                    )}
                </div>
            </section>

            <DocSection
                className={styles.downlink}
                id="downlink"
                headingId="log-downlink-h"
                num={`${copy.num}.2`}
                themed={copy.downlinkThemed}
                plain={copy.downlinkPlain}
            >
                <div className={styles.downGrid}>
                    <div className={styles.downItem}>
                        <p className="label label--ink">{copy.feedLabel}</p>
                        <p className={`data ${styles.downUrl}`}>
                            {host(siteConfig.url)}
                            {siteRoutes.feed}
                        </p>
                        <p className={styles.downNote}>{copy.feedNote}</p>
                        <div className="cluster">
                            <a
                                className={buttonClass({ size: "sm" })}
                                href={siteRoutes.feed}
                            >
                                <Icon name="rss" />
                                {copy.feedAction}
                            </a>
                        </div>
                    </div>
                    {linkedIn ? (
                        <div className={styles.downItem}>
                            <p className="label label--ink">
                                {copy.linkedInLabel}
                            </p>
                            <p className={`data ${styles.downUrl}`}>
                                {host(linkedIn.url)}
                            </p>
                            <div className="cluster">
                                <a
                                    className={buttonClass({ size: "sm" })}
                                    href={linkedIn.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {copy.linkedInAction}
                                    <Icon name="external" />
                                </a>
                            </div>
                        </div>
                    ) : null}
                </div>
            </DocSection>
        </div>
    );
}
