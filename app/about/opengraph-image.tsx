import { ImageResponse } from "next/og";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";
import { getProfile } from "@/lib/sanity-client";

export const alt = `About — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image() {
    const profile = await getProfile();
    return new ImageResponse(
        <OgTemplate
            eyebrow={profile?.name || siteConfig.author}
            title="About"
            subtitle={profile?.headline || "The person behind the notebook."}
            footerRight={`${domain}/about`}
        />,
        { ...size },
    );
}
