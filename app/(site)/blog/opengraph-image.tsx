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
 * The Writing share card: the name, tagged with the section, over the
 * owner's description of his writing.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={copy.plain}
            title={profile?.name?.trim() || siteConfig.author}
            upper
            subtitle={getWritingDescription(profile) ?? undefined}
            footerRight={`${domain}/blog`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
