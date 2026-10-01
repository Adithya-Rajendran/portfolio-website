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
 * The Contact share card: the name, tagged with the section, over the
 * page's introduction from the profile, and the availability line as
 * written in the profile, each only when set. It never shows an email
 * address or phone number (there is none to show).
 */
export default async function Image() {
    const profile = await getProfile();
    const openTo = availabilityLine(profile?.availability);
    return new ImageResponse(
        <OgCard
            tag={copy.plain}
            title={profile?.name?.trim() || siteConfig.author}
            upper
            subtitle={profile?.contactIntro?.trim() || undefined}
            status={openTo ? { label: copy.openTo, text: openTo } : undefined}
            footerRight={`${domain}/contact`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
