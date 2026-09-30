import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { homeCopy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { availabilityLine } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";

export const alt = siteConfig.author;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The home share card (and the card of any page without its own): the
 * name in capitals, as in the hero, over the profile's headline and, when
 * the profile says what the owner is open to, that line, so a shared link
 * carries it. The home page names this image in its metadata with an alt
 * built from the same fields (lib/site-metadata.ts); `alt` here serves
 * any page that inherits the card.
 */
export default async function Image() {
    const profile = await getProfile();
    const openTo = availabilityLine(profile?.availability);
    return new ImageResponse(
        <OgCard
            title={profile?.name?.trim() || siteConfig.author}
            subtitle={profile?.headline?.trim() || undefined}
            status={
                openTo ? { label: homeCopy.openTo, text: openTo } : undefined
            }
            footerRight={domain}
            upper
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
