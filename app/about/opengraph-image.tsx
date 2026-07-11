import { ImageResponse } from "next/og";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";

export const alt = `About — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image() {
    return new ImageResponse(
        <OgTemplate
            eyebrow={siteConfig.author}
            title="About"
            subtitle="A little more about me and where to find me online."
            footerRight={`${domain}/about`}
        />,
        { ...size },
    );
}
