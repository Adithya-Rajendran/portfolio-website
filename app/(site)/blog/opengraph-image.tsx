import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { logCopy as copy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getWritingDescription } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Writing share card: the owner's description of his writing, signed
 * like every other card.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={copy.themed}
            title={copy.plain}
            subtitle={getWritingDescription(profile) ?? undefined}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/blog`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
