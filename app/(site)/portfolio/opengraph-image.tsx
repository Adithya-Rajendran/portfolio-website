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
 * The Missions share card: the page's name and its one-line introduction
 * from the profile, when there is one.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={copy.themed}
            title={copy.plain}
            subtitle={profile?.projectsIntro?.trim() || undefined}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/portfolio`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
