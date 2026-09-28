import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { entryCount, logEntries, logSince } from "@/lib/log-index";
import { OG_CARD_FONTS, OgCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";

const copy = logCopy.archive;

export const alt = `${copy.title} · ${logCopy.themed} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** The archive's share card: the Flight Log card without the chart. */
export default async function Image() {
    const [posts, profile] = await Promise.all([getAllPosts(), getProfile()]);
    const entries = logEntries(posts);
    return new ImageResponse(
        <OgCard
            num={logCopy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={copy.title}
            subtitle={getWritingDescription(profile)}
            footerLeft={
                entries.length
                    ? logCopy.meta(
                          entryCount(entries.length),
                          logSince(entries),
                      )
                    : profile?.name || siteConfig.author
            }
            footerRight={`${domain}/blog/archive`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
