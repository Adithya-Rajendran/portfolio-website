import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { toMission, typeList } from "@/lib/missions";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getAllProjects, getProfile } from "@/lib/sanity-client";

export const alt = `${copy.themed} · ${copy.plain} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** The Missions share card: the page's name and its one-line intro. */
export default async function Image() {
    const [profile, projects] = await Promise.all([
        getProfile(),
        getAllProjects(),
    ]);
    const missions = projects.map((project) =>
        toMission(project, siteConfig.url),
    );
    return new ImageResponse(
        <OgCard
            num={copy.num}
            themed={copy.themed}
            plain={copy.plain}
            title={copy.themed}
            subtitle={copy.dek(typeList(missions))}
            footerLeft={profile?.name || siteConfig.author}
            footerRight={`${domain}/portfolio`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
