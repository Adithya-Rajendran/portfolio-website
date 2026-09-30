import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReactElement } from "react";

export { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/site-metadata";

/**
 * The Deep Field share card (plan §2.9): the void, the patch
 * (assets/patch.svg, written by scripts/generate-patch.mjs; no stars:
 * they are the home hero's alone), Jost for the title, Michroma for the
 * tier-1 labels and DM Mono for the data. Every card names the author:
 * a section's card leads with the name, an item's card signs its footer.
 * Satori reads static TTF copies (assets/fonts/og/, each with its OFL
 * licence), read once at module scope so the image prerenders (docs:
 * image-response.md §Custom fonts). Every page's share image is this
 * card.
 */

const FONTS = join(process.cwd(), "assets/fonts/og");

const [jostLight, jostRegular, michroma, dmMono, patchSvg] = await Promise.all([
    readFile(join(FONTS, "Jost-Light.ttf")),
    readFile(join(FONTS, "Jost-Regular.ttf")),
    readFile(join(FONTS, "Michroma-Regular.ttf")),
    readFile(join(FONTS, "DMMono-Regular.ttf")),
    readFile(join(process.cwd(), "assets/patch.svg")),
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

const PAD_X = 80;

const label = {
    fontFamily: "Michroma",
    fontSize: 17,
    letterSpacing: "0.16em",
    textTransform: "uppercase" as const,
};

/**
 * A page's card: the patch with the section's small tag, the title, one
 * line from the page, an optional status line (● OPEN TO and the owner's
 * words) and a footer of data in one size on every card: the author and
 * the item's facts on the left, its address on the right, on a line of
 * its own when the two do not fit one. `upper` sets the title in capitals
 * (the owner's name, leading a section's card).
 */
export function OgCard({
    tag,
    title,
    subtitle,
    status,
    footerLeft,
    footerRight,
    upper = false,
}: {
    /** The section's plain name: a small label beside the patch. */
    tag?: string;
    title: string;
    subtitle?: string;
    /** A keyed line under the subtitle: "Open to" and the profile's line. */
    status?: { label: string; text: string };
    footerLeft?: string;
    footerRight: string;
    upper?: boolean;
}): ReactElement {
    // The name in capitals keeps one line at 96 px; a long title wraps.
    const titleSize =
        title.length > 24
            ? 84
            : status || (upper && title.length > 12)
              ? 96
              : 124;
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                padding: `64px ${PAD_X}px 56px`,
                background: VOID.bg,
                color: VOID.ink1,
                fontFamily: "Jost",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image */}
                <img src={PATCH} width={76} height={76} alt="" />
                {tag ? (
                    <span
                        style={{ display: "flex", ...label, color: VOID.ink2 }}
                    >
                        {tag}
                    </span>
                ) : null}
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
                        fontSize: titleSize,
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
                {status ? (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            marginTop: 30,
                            maxWidth: 1040,
                        }}
                    >
                        <div
                            style={{
                                width: 10,
                                height: 10,
                                flex: "none",
                                borderRadius: 5,
                                background: VOID.accent,
                            }}
                        />
                        <span
                            style={{
                                display: "flex",
                                flex: "none",
                                ...label,
                                fontSize: 15,
                                color: VOID.ink2,
                            }}
                        >
                            {status.label}
                        </span>
                        <span
                            style={{
                                display: "flex",
                                fontSize: status.text.length > 64 ? 24 : 28,
                                lineHeight: 1.3,
                                color: VOID.ink1,
                            }}
                        >
                            {status.text}
                        </span>
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    rowGap: 8,
                    columnGap: 32,
                    paddingTop: 22,
                    borderTop: `1px solid ${VOID.rule2}`,
                    fontFamily: "DM Mono",
                    fontSize: 20,
                    color: VOID.ink2,
                }}
            >
                {footerLeft ? (
                    <span style={{ display: "flex" }}>{footerLeft}</span>
                ) : null}
                <span style={{ display: "flex", marginLeft: "auto" }}>
                    {footerRight}
                </span>
            </div>
        </div>
    );
}
