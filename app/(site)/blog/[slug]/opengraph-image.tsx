import { ImageResponse } from "next/og";
import { readingTimeFromWordCount } from "@/components/blogs/utils";
import { siteConfig } from "@/lib/config";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate } from "@/lib/log-index";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getAllSlugs, getPostMeta } from "@/lib/sanity-client";

export const alt = `${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** The standfirst, cut at a word so the card keeps its footer. */
function standfirst(text: string | null | undefined, max = 170): string {
    const value = (text ?? "").trim();
    if (value.length <= max) return value;
    const cut = value.slice(0, max);
    return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.—–-]+$/, "")}…`;
}

/** A card per published entry, prerendered and refreshed with the entry
 *  (lib/route-tags.ts), as the entry's page is. */
export async function generateStaticParams() {
    const slugs = await getAllSlugs();
    return (slugs.length ? slugs : ["placeholder"]).map((slug) => ({ slug }));
}

/**
 * An entry's share card: the Deep Field card (lib/og-card.tsx) with the
 * entry's title and standfirst, signed "Adithya Rajendran · 30 Mar 2026 ·
 * 7 min read" over its own address. Its alt is the page's (the post's
 * metadata, lib/site-metadata.ts). Published content only; an unknown slug
 * gets the section's name.
 */
export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = await getPostMeta(slug);
    const minutes =
        post?.wordCount && post.wordCount > 0
            ? readingTimeFromWordCount(post.wordCount)
            : null;
    const footerLeft = [
        siteConfig.author,
        post?.publishedAt ? formatEntryDate(post.publishedAt) : null,
        minutes ? copy.read(minutes) : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return new ImageResponse(
        <OgCard
            tag={copy.plain}
            title={post?.title ?? copy.plain}
            subtitle={standfirst(post?.description) || undefined}
            footerLeft={footerLeft}
            footerRight={`${domain}/blog${post ? `/${slug}` : ""}`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
