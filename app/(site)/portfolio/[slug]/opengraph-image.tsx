import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config";
import { missionsCopy as copy } from "@/lib/copy";
import { toMission } from "@/lib/missions";
import { OG_CARD_FONTS, OG_CONTENT_TYPE, OG_SIZE, OgCard } from "@/lib/og-card";
import { getAllProjectSlugs, getProjectBySlug } from "@/lib/sanity-client";

export const alt = `${copy.file} — ${siteConfig.author}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const domain = new URL(siteConfig.url).hostname;

/** A card per published project, prerendered and refreshed with the
 *  project (lib/route-tags.ts), as the project's page is. */
export async function generateStaticParams() {
    const slugs = await getAllProjectSlugs();
    return (slugs.length ? slugs : ["placeholder"]).map((slug) => ({ slug }));
}

/**
 * A project's share card: its title, in sentence case as on the page,
 * signed "Adithya Rajendran · type · status" over its own address. Its alt is the page's
 * (the project's metadata, lib/site-metadata.ts). Published content only;
 * an unknown slug gets the section's name.
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
            tag={copy.plain}
            title={mission?.title ?? copy.plain}
            footerLeft={[
                siteConfig.author,
                ...(mission?.types ?? []),
                mission?.statusLabel,
            ]
                .filter(Boolean)
                .join(" · ")}
            footerRight={`${domain}/portfolio${mission ? `/${slug}` : ""}`}
        />,
        { ...size, fonts: OG_CARD_FONTS },
    );
}
