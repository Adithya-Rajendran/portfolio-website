import { ImageResponse } from "next/og";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";

export const alt = "Blog — Adithya Rajendran";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image() {
    return new ImageResponse(
        <OgTemplate
            eyebrow={`${siteConfig.author} · Writing`}
            title="Blog"
            subtitle={BLOG_DESCRIPTION}
            footerRight={`${domain}/blogs`}
        />,
        { ...size },
    );
}
