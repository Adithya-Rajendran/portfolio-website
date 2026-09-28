import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { homeRoute } from "@/lib/navigation";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getProfile } from "@/lib/sanity-client";

export const alt = siteConfig.author;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The home share card (and the card of any page without its own): the
 * name in capitals, as in the hero, over the profile's headline.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            num={homeRoute.num}
            themed={homeRoute.themed}
            plain={homeRoute.plain}
            title={profile?.name?.trim() || siteConfig.author}
            subtitle={profile?.headline?.trim() || undefined}
            footerRight={domain}
            upper
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
