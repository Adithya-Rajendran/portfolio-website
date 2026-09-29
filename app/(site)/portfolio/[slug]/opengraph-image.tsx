import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { toMission } from "@/lib/missions";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getProjectBySlug } from "@/lib/sanity-client";

export const alt = `${copy.file} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/**
 * A mission file's share card: the owner's short name for the project in
 * capitals over its title (else the title alone), and MSN-0n · type ·
 * status underneath. Published content only; an unknown slug gets the
 * section's name.
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
            tag={copy.themed}
            title={mission?.label ?? copy.plain}
            upper={Boolean(mission?.name)}
            subtitle={mission?.name ? mission.title : undefined}
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
