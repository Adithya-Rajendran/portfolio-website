import Image from "next/image";
import type { CSSProperties } from "react";
import type { ImageWidth } from "@/lib/post-fields";
import type { FigureInfo } from "@/lib/prose";
import { urlForImage } from "@/lib/sanity-image";

/**
 * An image in the text as a numbered plate or figure (G1, G7): photographs
 * are plates (Pl. I), diagrams, plots and screenshots figures (Fig. 1). The
 * caption is the owner's, verbatim, with the credit as its source line;
 * nothing is added. A tall or square plate at text width keeps its caption
 * beside it on wider screens. In Void a photograph dissolves into the dark;
 * in Flight Manual it is mounted with crop marks (styles/components.css,
 * `.photo`). Ported from the mockup's `DF.render.photo` (site.css 4.26)
 * and writing.css "Plates".
 */

export type PlateImage = {
    _key?: string;
    asset?: { _ref?: string };
    alt?: string | null;
    caption?: string | null;
    credit?: string | null;
    kind?: string | null;
    width?: ImageWidth | string | null;
    lqip?: string | null;
    dimensions?: { width?: number; height?: number } | null;
};

type Shape = "portrait" | "square" | "landscape";

function shapeOf(width: number, height: number): Shape {
    const ratio = width / height;
    if (ratio < 0.9) return "portrait";
    if (ratio <= 1.1) return "square";
    return "landscape";
}

function layoutOf(width: unknown): ImageWidth {
    return width === "wide" || width === "full" ? width : "prose";
}

/** What the plate is drawn at, for the browser's choice of file. */
function sizesFor(layout: ImageWidth, shape: Shape): string {
    if (layout === "full") return "(min-width: 60rem) 70vw, 100vw";
    if (layout === "wide") return "(min-width: 60rem) 60rem, 100vw";
    if (shape === "landscape") return "(min-width: 37.5rem) 37rem, 100vw";
    return "(min-width: 37.5rem) 24rem, 100vw";
}

export default function FigurePlate({
    value,
    info,
    tag,
    priority = false,
}: {
    value: PlateImage;
    info: FigureInfo;
    /** Printed on the plate after its number: "LOG 003". */
    tag?: string;
    /** The lead plate near the top loads eagerly. */
    priority?: boolean;
}) {
    const width = value.dimensions?.width || 1600;
    const height = value.dimensions?.height || 1067;
    const shape = shapeOf(width, height);
    const layout = layoutOf(value.width);
    const request = layout === "prose" ? 1200 : 2000;
    const src = urlForImage(value)
        .width(Math.min(request, width))
        .fit("max")
        .auto("format")
        .url();
    const photo = info.kind === "plate";
    const classes = [
        "plate",
        `plate--${layout}`,
        `plate--${shape}`,
        "photo",
        photo ? "photo--real" : "photo--drawing",
    ].join(" ");
    const style = {
        "--photo-ratio": `${width} / ${height}`,
    } as CSSProperties;
    const caption = value.caption?.trim();
    const credit = value.credit?.trim();

    return (
        <figure className={classes} style={style}>
            <div className="photo__frame">
                <Image
                    className="photo__img"
                    src={src}
                    alt={value.alt || ""}
                    width={width}
                    height={height}
                    sizes={sizesFor(layout, shape)}
                    loading={priority ? "eager" : "lazy"}
                    {...(value.lqip
                        ? {
                              placeholder: "blur" as const,
                              blurDataURL: value.lqip,
                          }
                        : {})}
                />
                <span className="photo__plate" aria-hidden="true">
                    {tag ? `${info.label} · ${tag}` : info.label}
                </span>
            </div>
            <figcaption className="caption caption--plate">
                <span className="caption__num">{info.label}</span>
                {caption || credit ? (
                    <span className="caption__body">
                        {caption}
                        {credit ? (
                            <span className="caption__src">{credit}</span>
                        ) : null}
                    </span>
                ) : null}
            </figcaption>
        </figure>
    );
}
