import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { toMission } from "@/lib/missions";
import { OG_CARD_FONTS, OgCard } from "@/lib/og-card";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";
import { getProjectBySlug } from "@/lib/sanity-client";

export const alt = `${copy.fileThemed} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * A mission file's share card: the mission's name in capitals, its title,
 * and MSN-0n · type · status underneath. Published content only; an
 * unknown slug gets the section's name.
 */
export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const project = await getProjectBySlug(slug);
    const mission = project ? toMission(project, siteConfig.url) : null;
    return new ImageResponse(
        <OgCard
            num={copy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={mission?.name ?? copy.themed}
            upper={Boolean(mission)}
            subtitle={mission?.title}
            footerLeft={
                mission
                    ? [
                          mission.designation,
                          mission.types.join(" · "),
                          mission.statusLabel,
                      ]
                          .filter(Boolean)
                          .join(" · ")
                    : siteConfig.author
            }
            footerRight={`${domain}/portfolio`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
