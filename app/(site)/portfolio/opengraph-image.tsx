import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Projects share card: the name, tagged with the section, over the
 * page's one-line introduction from the profile, when there is one.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={copy.plain}
            title={profile?.name?.trim() || siteConfig.author}
            upper
            subtitle={profile?.projectsIntro?.trim() || undefined}
            footerRight={`${domain}/portfolio`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
