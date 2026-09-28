import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { cvCopy as copy } from "@/lib/copy";
import { OG_CARD_FONTS, OgCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${copy.themed} · ${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Trajectory share card: the page's themed name, the owner's work
 * summary as written in the profile, and the name and address.
 */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            num={copy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={copy.themed}
            subtitle={profile?.workSummary?.trim() || copy.description}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/resume`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
