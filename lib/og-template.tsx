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
                padding: "80px",
                background:
                    "radial-gradient(circle at 18% 12%, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.08) 32%, transparent 62%), #090c0b",
                color: "#ffffff",
                fontFamily: "sans-serif",
            }}
        >
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
                        background: "#10b981",
                    }}
                />
                <span
                    style={{
                        fontSize: "22px",
                        textTransform: "uppercase",
                        letterSpacing: "0.22em",
                        color: "#34d399",
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
                        fontSize: title.length > 70 ? "62px" : "78px",
                        fontWeight: 700,
                        lineHeight: 1.08,
                        letterSpacing: "-0.02em",
                        color: "#ffffff",
                        display: "flex",
                    }}
                >
                    {title}
                </div>
                {subtitle && (
                    <div
                        style={{
                            fontSize: "30px",
                            lineHeight: 1.3,
                            color: "#cbd5e1",
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
                    fontSize: "26px",
                    color: "#94a3b8",
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
