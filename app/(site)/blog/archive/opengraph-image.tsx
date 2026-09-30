import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { logCopy } from "@/lib/copy";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getWritingDescription } from "@/lib/profile-content";
import { getProfile } from "@/lib/sanity-client";

const copy = logCopy.archive;

export const alt = `${copy.title} · ${logCopy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** The archive's share card: the Writing card with its own tag. */
export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgCard
            tag={`${logCopy.plain} · ${copy.title}`}
            title={profile?.name?.trim() || siteConfig.author}
            upper
            subtitle={getWritingDescription(profile) ?? undefined}
            footerRight={`${domain}/blog/archive`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
