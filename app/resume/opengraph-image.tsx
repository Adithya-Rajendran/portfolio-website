import { ImageResponse } from "next/og";
import { OgTemplate, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { siteConfig } from "@/lib/config";

export const alt = `Résumé — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

export default function Image() {
    return new ImageResponse(
        <OgTemplate
            eyebrow={siteConfig.author}
            title="Résumé"
            subtitle="View the current PDF résumé directly in your browser."
            footerRight={`${domain}/resume`}
        />,
        { ...size },
    );
}
