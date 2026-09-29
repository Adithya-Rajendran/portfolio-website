import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { contactCopy as copy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { availabilityLine } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Comms share card: the page's themed name, and the availability line
 * as written in the profile when there is one, else the page's
 * introduction from the profile, else no subtitle. It never shows an email
 * address or phone number (there is none to show).
 */
export default async function Image() {
    const profile = await getProfile();
    const openTo = availabilityLine(profile?.availability);
    return new ImageResponse(
        <OgCard
            tag={copy.themed}
            title={copy.plain}
            subtitle={
                openTo
                    ? `${copy.openTo}: ${openTo}`
                    : profile?.contactIntro?.trim() || undefined
            }
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/contact`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
