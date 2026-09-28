import { ImageResponse } from "next/og";
import { readingTimeFromWordCount } from "@/components/blogs/utils";
import { siteConfig } from "@/lib/config";
import { postCopy as copy } from "@/lib/copy";
import { formatEntryDate, logEntries } from "@/lib/log-index";
import { OG_CARD_FONTS, OgCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { getAllPosts, getPostMeta } from "@/lib/sanity-client";

export const alt = `${copy.themed} entry — ${siteConfig.author}`;
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

/**
 * A Flight Log entry's share card: the Deep Field card (lib/og-card.tsx)
 * with the entry's title and standfirst, and LOG nnn · date · read time
 * underneath. Published content only; an unknown slug gets the log's name.
 */
export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const [post, posts] = await Promise.all([getPostMeta(slug), getAllPosts()]);
    const entry = logEntries(posts).find((item) => item.slug === slug);
    const minutes =
        post?.wordCount && post.wordCount > 0
            ? readingTimeFromWordCount(post.wordCount)
            : null;
    const footerLeft = [
        entry?.designation,
        post?.publishedAt ? formatEntryDate(post.publishedAt) : null,
        minutes ? copy.read(minutes) : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return new ImageResponse(
        <OgCard
            num={copy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={post?.title ?? copy.themed}
            subtitle={standfirst(post?.description) || undefined}
            footerLeft={footerLeft || siteConfig.author}
            footerRight={`${domain}/blog`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
