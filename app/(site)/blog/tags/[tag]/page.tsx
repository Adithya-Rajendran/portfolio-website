import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LogIndex from "@/components/blogs/log-index";
import PageHead from "@/components/ui/page-head";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { feedAlternates } from "@/lib/feed";
import { entriesTagged, logEntries } from "@/lib/log-index";
import { getAllPosts } from "@/lib/sanity-client";
import {
    notFoundMetadata,
    shareImage,
    siteOpenGraph,
} from "@/lib/site-metadata";
import { collectTags, TAG_LINK_MIN, TAG_PATTERN, tagLabel } from "@/lib/tags";
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
 * Data section: the head (the tag in words as the h1, "GPU computing";
 * no dek restating it, and no actions: the header's Writing leads back),
 * then the tag's entries in the writing index, each row with its other
 * tags (the h1 names this one). An unknown tag has no entries and
 * answers 404.
 */
async function TagEntries({ tag }: { tag: string }) {
    const entries = entriesTagged(logEntries(await getAllPosts()), tag).map(
        (entry) => ({
            ...entry,
            tagLinks: entry.tagLinks.filter((other) => other !== tag),
        }),
    );
    if (entries.length === 0) notFound();

    return (
        <>
            <PageHead
                className="shell"
                split
                tag={logCopy.themed}
                title={tagLabel(tag)}
            />

            <section className={`section ${styles.index}`}>
                <div className={`shell ${styles.indexInner}`}>
                    <LogIndex entries={entries} level={2} />
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
}): Promise<Metadata> {
    const { tag } = await params;
    if (!TAG_PATTERN.test(tag)) return notFoundMetadata;
    const count = entriesTagged(logEntries(await getAllPosts()), tag).length;
    if (count === 0) return notFoundMetadata;
    const description = copy.description(tagLabel(tag));
    const title = `${tagLabel(tag)} · ${logCopy.plain}`;
    const url = `${siteConfig.url}/blog/tags/${tag}`;
    return {
        title,
        description,
        alternates: feedAlternates(url),
        // A page's openGraph replaces its parent's whole: the site's
        // fields again, and Writing's card.
        openGraph: {
            ...siteOpenGraph(null),
            title: `${title} | ${siteConfig.author}`,
            description,
            url,
            images: [
                shareImage(
                    "app/(site)/blog/opengraph-image.tsx",
                    `${logCopy.plain} — ${siteConfig.author}`,
                ),
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: `${title} | ${siteConfig.author}`,
            description,
        },
        // Indexed only where the site links it (and the sitemap lists it).
        robots: {
            index: count >= TAG_LINK_MIN,
            follow: true,
        },
    };
}
