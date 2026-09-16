import { ImageResponse } from "next/og";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";
import { getWritingDescription } from "@/lib/profile-content";

export const alt = "Archive — Adithya Rajendran";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image() {
    const description = getWritingDescription(await getProfile());
    return new ImageResponse(
        <OgTemplate
            eyebrow={`${siteConfig.author} · Writing`}
            title="Archive"
            subtitle={description}
            footerRight={`${domain}/blog/archive`}
        />,
        { ...size },
    );
}
