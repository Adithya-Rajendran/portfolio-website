import Plate from "@/components/ui/plate";
import { minWidth } from "@/lib/breakpoints";
import type { ImageWidth } from "@/lib/post-fields";
import type { FigureInfo } from "@/lib/prose";

/**
 * An image in the text as a plate (G1, G7): a photograph, or a diagram,
 * plot or screenshot, which keeps no photographic grade. Neither is
 * numbered: no text cites one, and the caption stands on its own. The
 * caption is the owner's, verbatim, with the credit as its source line;
 * nothing is added. A tall or square plate at text width keeps its
 * caption beside it on wider screens. The photograph itself carries
 * nothing (the plate rule in styles/components.css, `.photo`). It is
 * the one `Plate` (components/ui/plate.tsx), with the long read's layout
 * and shape classes; a credit without a caption is the caption's source
 * line alone. Ported from the mockup's `DF.render.photo` (site.css 4.26)
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
    if (layout === "full") return `${minWidth("md")} 70vw, 100vw`;
    if (layout === "wide") return `${minWidth("md")} 60rem, 100vw`;
    if (shape === "landscape") return `${minWidth("sm")} 37rem, 100vw`;
    return `${minWidth("sm")} 24rem, 100vw`;
}

export default function FigurePlate({
    value,
    info,
    priority = false,
}: {
    value: PlateImage;
    info: FigureInfo;
    /** The lead plate near the top loads eagerly. */
    priority?: boolean;
}) {
    const width = value.dimensions?.width || 1600;
    const height = value.dimensions?.height || 1067;
    const shape = shapeOf(width, height);
    const layout = layoutOf(value.width);
    return (
        <Plate
            image={{ ...value, dimensions: { width, height } }}
            kind={info.kind === "plate" ? "photo" : "drawing"}
            className={`plate plate--${layout} plate--${shape}`}
            caption={value.caption?.trim() || null}
            credit={value.credit?.trim() || null}
            sizes={sizesFor(layout, shape)}
            width={layout === "prose" ? 1200 : 2000}
            loading={priority ? "eager" : "lazy"}
        />
    );
}
