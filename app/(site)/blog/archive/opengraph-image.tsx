import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getWritingDescription } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";

const copy = logCopy.archive;

export const alt = `${copy.title} · ${logCopy.themed} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** The archive's share card: the Flight Log card without the chart. */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            num={logCopy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={copy.title}
            subtitle={getWritingDescription(profile)}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/blog/archive`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
