import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { trajectoryCopy as copy } from "@/lib/copy";
import { siteRoutes } from "@/lib/navigation";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";

export const alt = `${copy.title} by ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * The flight's share card: the Deep Field card tagged Trajectory, its
 * title Timeline, signed with the name over its own address. It reads no
 * content, so it is never warmed.
 */
export default function Image() {
    return new ImageResponse(
        <OgCard
            tag={copy.tag}
            title={copy.title}
            subtitle={copy.description}
            footerLeft={siteConfig.author}
            footerRight={`${domain}${siteRoutes.trajectory}`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
