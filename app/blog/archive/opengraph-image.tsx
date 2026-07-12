import { ImageResponse } from "next/og";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";

export const alt = "Archive — Adithya Rajendran";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default async function Image() {
    return new ImageResponse(
        <OgTemplate
            eyebrow={`${siteConfig.author} · Blog`}
            title="Archive"
            subtitle="Every post, searchable by title, description, or tag and grouped by year."
            footerRight={`${domain}/blog/archive`}
        />,
        { ...size },
    );
}
