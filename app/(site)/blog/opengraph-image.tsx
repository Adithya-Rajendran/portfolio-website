import { ImageResponse } from "next/og";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { entryCount, logEntries, logSince } from "@/lib/log-index";
import { OG_CARD_FONTS, OgCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { transmissions } from "@/lib/transmissions";

export const alt = `${copy.themed} · ${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Flight Log's share card: the owner's description of his writing,
 * the transmissions strip (every entry on its date, the newest in orange)
 * and the entry count. It shows only published content.
 */
export default async function Image() {
    const [posts, profile, today] = await Promise.all([
        getAllPosts(),
        getProfile(),
        getToday(),
    ]);
    const entries = logEntries(posts);
    return new ImageResponse(
        <OgCard
            num={copy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={copy.themed}
            subtitle={getWritingDescription(profile)}
            chart={transmissions(entries, today)}
            footerLeft={
                entries.length
                    ? copy.meta(entryCount(entries.length), logSince(entries))
                    : profile?.name || siteConfig.author
            }
            footerRight={`${domain}/blog`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
