import { ImageResponse } from "next/og";
import { OgTemplate, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";
import { contactCopy } from "@/lib/copy";
import { getProfile } from "@/lib/sanity-client";

export const alt = `${contactCopy.themed} · ${contactCopy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The Comms share card: the page's own heading, and the availability line
 * as written in the profile when there is one. It never shows an email
 * address or phone number (there is none to show). The shared template is
 * restyled with the other share images.
 */
export default async function Image() {
    const profile = await getProfile();
    const availability = profile?.availability;
    const openTo =
        availability?.status !== "closed" ? availability?.openTo?.trim() : "";
    return new ImageResponse(
        <OgTemplate
            eyebrow={`${contactCopy.themed} · ${contactCopy.plain}`}
            title={contactCopy.title}
            subtitle={
                openTo ? `${contactCopy.openTo}: ${openTo}` : contactCopy.intro
            }
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/contact`}
        />,
        { ...size },
    );
}
