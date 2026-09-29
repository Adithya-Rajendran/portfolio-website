import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LogIndex from "@/components/blogs/log-index";
import TagChips from "@/components/blogs/tag-chips";
import StaticStars from "@/components/sky/static-stars";
import { ButtonLink } from "@/components/ui/button";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { entriesTagged, logEntries, offersFilters } from "@/lib/log-index";
import { siteRoutes } from "@/lib/navigation";
import { getAllPosts } from "@/lib/sanity-client";
import { collectTags, TAG_PATTERN } from "@/lib/tags";
import styles from "../../log.module.css";

/**
 * Partial Prefetching for this route only (plan §4.6 rule 8, measured in
 * PR 9): the tag links on a page share one prefetched App Shell instead of
 * each prefetching its own page, and the tag's entries load on the click.
 * The app-wide flag stays off (next.config.mjs).
 */
export const prefetch = "partial";

const copy = logCopy.tag;

/**
 * Data section: the tag's entries in the writing index, with every tag's
 * chip and the search once the index offers them (`offersFilters`). An
 * unknown tag has no entries and answers 404.
 */
async function TagEntries({ tag }: { tag: string }) {
    const all = logEntries(await getAllPosts());
    const entries = entriesTagged(all, tag);
    if (entries.length === 0) notFound();
    const tags = collectTags(all);
    const filters = offersFilters(tags);

    return (
        <>
            <div className="head-band">
                <StaticStars variant="band" />
                <PageHead
                    className="shell"
                    split
                    ornament="wave"
                    tag={logCopy.themed}
                    title={tag}
                    intro={copy.intro(tag)}
                >
                    <div className="cluster page-head__actions">
                        <ButtonLink
                            size="sm"
                            icon="arrow"
                            iconAt="end"
                            href={siteRoutes.blog}
                        >
                            {logCopy.back}
                        </ButtonLink>
                        {filters ? (
                            <ButtonLink
                                size="sm"
                                icon="search"
                                href="/blog/archive"
                            >
                                {logCopy.search}
                            </ButtonLink>
                        ) : null}
                    </div>
                </PageHead>
            </div>

            <section
                className={`section ${styles.index}`}
                aria-label={copy.intro(tag)}
            >
                <div className={`shell ${styles.indexInner}`}>
                    {filters ? (
                        <TagChips
                            tags={tags}
                            total={all.length}
                            current={tag}
                        />
                    ) : null}
                    <LogIndex entries={entries} level={2} matchTag={tag} />
                </div>
            </section>
        </>
    );
}

/**
 * Prerender a page per known tag at build time; unknown tags still render
 * on demand (dynamicParams default). Cache Components requires at least
 * one param at build time, so when there are no posts/tags yet (CI's
 * fallback sentinel, or pre-launch) we emit a placeholder tag that
 * prerenders as the 404 page and is linked from nowhere — mirrors
 * app/(site)/blog/[slug]/page.tsx.
 */
export async function generateStaticParams() {
    const tags = collectTags(await getAllPosts());
    if (tags.length === 0) return [{ tag: "placeholder" }];
    return tags.map(({ tag }) => ({ tag }));
}

/**
 * A tag's page: one tag's entries. Validates the route param
 * before handing off to the data section.
 */
export default async function TagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    // Next has already percent-decoded the segment once during route
    // matching — decoding again would let double-encoded URLs (e.g.
    // /blog/tags/kub%2565rnetes) alias the canonical page.
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) notFound();

    return (
        <div data-page="tag" className={styles.page}>
            <TagEntries tag={tag} />
        </div>
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ tag: string }>;
}): Promise<Metadata | undefined> {
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) {
        return;
    }
    const description = copy.intro(tag);
    const title = `${tag} · ${logCopy.plain}`;
    return {
        title,
        description,
        alternates: {
            canonical: `${siteConfig.url}/blog/tags/${tag}`,
        },
        openGraph: {
            title: `${title} | ${siteConfig.author}`,
            description,
            url: `${siteConfig.url}/blog/tags/${tag}`,
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${siteConfig.author}`,
            description,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}
