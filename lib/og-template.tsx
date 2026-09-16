import type { ReactElement } from "react";
import { ImageResponse } from "next/og";
import { getProfile } from "@/lib/sanity-client";
import { siteConfig } from "@/lib/config";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

interface OgTemplateProps {
    eyebrow: string;
    title: string;
    subtitle?: string;
    footerLeft?: string;
    footerRight: string;
}

/**
 * Shared layout for every file-convention opengraph-image route. Inline
 * styles only — Satori (the engine powering next/og) doesn't understand
 * class names, and every container with more than one child must set
 * display: flex.
 */
export function OgTemplate({
    eyebrow,
    title,
    subtitle,
    footerLeft,
    footerRight,
}: OgTemplateProps): ReactElement {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "76px 80px",
                position: "relative",
                overflow: "hidden",
                background:
                    "radial-gradient(ellipse at 100% 0%, rgba(66, 103, 131, 0.28) 0%, transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(246, 175, 128, 0.12) 0%, transparent 50%), #0c1318",
                color: "#e9e9e2",
                fontFamily: "sans-serif",
            }}
        >
            {[
                { x: 1056, y: 77 },
                { x: 1130, y: 194 },
                { x: 989, y: 308 },
                { x: 1160, y: 433 },
                { x: 890, y: 53 },
            ].map(({ x, y }, index) => (
                <div
                    key={`${x}-${y}`}
                    style={{
                        position: "absolute",
                        left: x,
                        top: y,
                        width: index === 0 ? 3 : 2,
                        height: index === 0 ? 3 : 2,
                        borderRadius: "50%",
                        background: "#dae4ec",
                        opacity: 0.3,
                    }}
                />
            ))}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "18px",
                }}
            >
                <div
                    style={{
                        width: "44px",
                        height: "2px",
                        background: "#f6af80",
                    }}
                />
                <span
                    style={{
                        fontSize: "22px",
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#f6af80",
                        fontWeight: 600,
                    }}
                >
                    {eyebrow}
                </span>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    marginRight: "40px",
                }}
            >
                <div
                    style={{
                        fontSize:
                            title.length > 110
                                ? "46px"
                                : title.length > 70
                                  ? "58px"
                                  : "76px",
                        fontWeight: 600,
                        lineHeight: 1.08,
                        letterSpacing: "-0.02em",
                        color: "#e9e9e2",
                        display: "flex",
                    }}
                >
                    {title}
                </div>
                {subtitle && (
                    <div
                        style={{
                            fontSize: subtitle.length > 110 ? "25px" : "29px",
                            lineHeight: 1.3,
                            color: "#b2bbbf",
                            display: "flex",
                        }}
                    >
                        {subtitle}
                    </div>
                )}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "23px",
                    borderTop: "1px solid #344048",
                    paddingTop: "25px",
                    color: "#a2adb4",
                }}
            >
                <span style={{ display: "flex" }}>{footerLeft ?? ""}</span>
                <span style={{ display: "flex" }}>{footerRight}</span>
            </div>
        </div>
    );
}

interface ProfileOgImageOptions {
    eyebrow: string;
    footerRight: string;
}

/**
 * Factory for identity-led OG routes. The CMS supplies only the name and
 * headline; visual composition remains code-defined alongside the site.
 */
export function makeProfileOgImage({
    eyebrow,
    footerRight,
}: ProfileOgImageOptions): () => Promise<ImageResponse> {
    return async function Image(): Promise<ImageResponse> {
        const profile = await getProfile();
        const subtitle = profile?.headline || siteConfig.role;

        return new ImageResponse(
            <OgTemplate
                eyebrow={eyebrow}
                title={profile?.name || siteConfig.author}
                subtitle={subtitle}
                footerRight={footerRight}
            />,
            { ...OG_SIZE },
        );
    };
}

/** Kept until the route modules are renamed in the V3 integration pass. */
export const makeIntroOgImage = makeProfileOgImage;
