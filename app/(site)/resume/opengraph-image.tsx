import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { cvCopy as copy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Experience share card: the name, tagged with the section, over the
 * owner's work summary as written in the profile, and the address.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={copy.title}
            title={profile?.name?.trim() || siteConfig.author}
            upper
            subtitle={profile?.workSummary?.trim() || copy.description}
            footerRight={`${domain}/resume`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
