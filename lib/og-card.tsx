import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";
import { starLayout } from "@/lib/sky/stars";

/**
 * The Deep Field share card (plan §2.9): the void, a seeded scatter of
 * stars, the patch, one orange rule, Jost for the title, Michroma for the
 * tier-1 labels and DM Mono for the data. Satori reads static TTF copies
 * (assets/fonts/og/, each with its OFL licence), read once at module scope
 * so the image prerenders (docs: image-response.md §Custom fonts). Every
 * page's share image is this card.
 */

const FONTS = join(process.cwd(), "assets/fonts/og");

const [jostLight, jostRegular, michroma, dmMono, patchSvg] = await Promise.all([
    readFile(join(FONTS, "Jost-Light.ttf")),
    readFile(join(FONTS, "Jost-Regular.ttf")),
    readFile(join(FONTS, "Michroma-Regular.ttf")),
    readFile(join(FONTS, "DMMono-Regular.ttf")),
    readFile(join(process.cwd(), "app/icon.svg")),
]);

export const OG_CARD_FONTS = [
    {
        name: "Jost",
        data: jostLight,
        weight: 300 as const,
        style: "normal" as const,
    },
    {
        name: "Jost",
        data: jostRegular,
        weight: 400 as const,
        style: "normal" as const,
    },
    {
        name: "Michroma",
        data: michroma,
        weight: 400 as const,
        style: "normal" as const,
    },
    {
        name: "DM Mono",
        data: dmMono,
        weight: 400 as const,
        style: "normal" as const,
    },
];

const PATCH = `data:image/svg+xml;base64,${patchSvg.toString("base64")}`;

/** The Void tokens (styles/tokens.css); Satori reads no CSS. */
const VOID = {
    bg: "#050507",
    ink1: "#ece8df",
    ink2: "#bcb7ad",
    ink3: "#8f8a80",
    rule1: "#1f1f25",
    rule2: "#67635c",
    accent: "#ff5a1f",
    accentText: "#ff7a45",
} as const;

const WIDTH = 1200;
const HEIGHT = 630;

/** Every share image's size and type (the routes' `size`, `contentType`). */
export const OG_SIZE = { width: WIDTH, height: HEIGHT } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
const PAD_X = 80;
const STARS = starLayout(1990, 70, WIDTH, HEIGHT);

const label = {
    fontFamily: "Michroma",
    fontSize: 17,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
};
const mono = { fontFamily: "DM Mono", fontSize: 20 };

/**
 * A page's card: the patch and one orange rule with the section's small
 * themed tag, the page's plain title, one line from the page, and a
 * footer of data. `upper` sets the title in capitals (a project's name or
 * the owner's, the vehicle treatment).
 */
export function OgCard({
    tag,
    title,
    subtitle,
    footerLeft,
    footerRight,
    upper = false,
}: {
    /** The section's themed name: a small label beside the patch. */
    tag?: string;
    title: string;
    subtitle?: string;
    footerLeft?: string;
    footerRight: string;
    upper?: boolean;
}): ReactElement {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                padding: `64px ${PAD_X}px 56px`,
                background: VOID.bg,
                color: VOID.ink1,
                fontFamily: "Jost",
            }}
        >
            {STARS.map((star, index) => (
                <div
                    key={index}
                    style={{
                        position: "absolute",
                        left: Math.round(star.x),
                        top: Math.round(star.y),
                        width: star.mag === 1 ? 3 : 2,
                        height: star.mag === 1 ? 3 : 2,
                        borderRadius: 2,
                        background: VOID.ink1,
                        opacity:
                            star.mag === 1 ? 0.7 : star.mag === 2 ? 0.4 : 0.2,
                    }}
                />
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
                <img src={PATCH} width={76} height={76} alt="" />
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        ...label,
                        color: VOID.ink1,
                    }}
                >
                    <div
                        style={{
                            width: 48,
                            height: 2,
                            background: VOID.accent,
                        }}
                    />
                    {tag ? (
                        <span style={{ color: VOID.ink2 }}>{tag}</span>
                    ) : null}
                </div>
            </div>

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    marginTop: 44,
                    flexGrow: 1,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        fontSize: title.length > 24 ? 84 : 124,
                        fontWeight: 300,
                        lineHeight: 1,
                        letterSpacing: upper ? "0.04em" : "-0.02em",
                        textTransform: upper ? "uppercase" : "none",
                    }}
                >
                    {title}
                </div>
                {subtitle ? (
                    <div
                        style={{
                            display: "flex",
                            marginTop: 26,
                            maxWidth: 940,
                            fontSize: subtitle.length > 110 ? 26 : 30,
                            lineHeight: 1.35,
                            color: VOID.ink2,
                        }}
                    >
                        {subtitle}
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 22,
                    borderTop: `1px solid ${VOID.rule2}`,
                    ...mono,
                    color: VOID.ink2,
                }}
            >
                <span style={{ display: "flex" }}>{footerLeft ?? ""}</span>
                <span style={{ display: "flex" }}>{footerRight}</span>
            </div>
        </div>
    );
}
