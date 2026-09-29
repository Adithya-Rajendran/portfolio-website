import { ImageResponse } from "next/og";
import { getToday } from "@/lib/clock";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { logEntries } from "@/lib/log-index";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getWritingDescription } from "@/lib/profile-content";
import { getAllPosts, getProfile } from "@/lib/sanity-client";
import { transmissions } from "@/lib/transmissions";

export const alt = `${copy.themed} · ${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Flight Log's share card: the owner's description of his writing and
 * the strip of every entry on its date (the newest in orange), signed like
 * every other card. It shows only published content.
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
            subtitle={getWritingDescription(profile) ?? undefined}
            chart={transmissions(entries, today)}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/blog`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
