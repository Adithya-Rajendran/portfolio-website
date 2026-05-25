import { ImageResponse } from "next/og";
import { getIntro } from "@/lib/sanity-client";
import { OgTemplate, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-template";

export const alt = "Adithya Rajendran — Portfolio";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
    const intro = await getIntro();
    const subtitle = intro?.subtitle || "Cloud Field Engineer @ Canonical";

    return new ImageResponse(
        <OgTemplate
            eyebrow="Portfolio"
            title="Adithya Rajendran"
            subtitle={subtitle}
            footerRight="adithya-rajendran.com/portfolio"
        />,
        { ...size },
    );
}
