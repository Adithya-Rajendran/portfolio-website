import Image from "next/image";
import type { CSSProperties } from "react";
import type { SanityImageValue } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

/**
 * A photograph as a plate outside the long read (contract §4, the
 * mockup's site.css 4.26): a mission's cover or its model's poster,
 * inside the grid (5 columns beside copy, at most 8 alone), on the one
 * plate rule (`.photo` in styles/components.css). No plate carries a
 * number. The caption is the owner's words, never an explanation; the
 * credit is its source line (`.caption__src`, the long read's and the
 * hero's mono voice). Returns nothing for an image without an asset.
 */
export default function Plate({
    image,
    caption,
    credit,
    ratio,
    focus,
    sizes,
    width = 1200,
    priority = false,
    className,
    children,
}: {
    image: SanityImageValue | null | undefined;
    caption?: React.ReactNode;
    /** Who made it ("Illustration"), under the caption. */
    credit?: string | null;
    /** A crop, as a CSS aspect ratio ("4 / 5"); the photo's own otherwise. */
    ratio?: string;
    /** `object-position` for the crop. */
    focus?: string;
    sizes: string;
    /** The widest file requested, in pixels. */
    width?: number;
    priority?: boolean;
    className?: string;
    /** Extra parts inside the frame (PR 15: the viewer's controls). */
    children?: React.ReactNode;
}) {
    if (!image?.asset) return null;
    const natural = {
        width: image.dimensions?.width || 1600,
        height: image.dimensions?.height || 1200,
    };
    const src = urlForImage(image)
        .width(Math.min(width, natural.width))
        .fit("max")
        .auto("format")
        .url();
    const style = {
        "--photo-ratio": ratio ?? `${natural.width} / ${natural.height}`,
        ...(focus ? { "--photo-focus": focus } : {}),
    } as CSSProperties;
    return (
        <figure
            className={
                className
                    ? `photo photo--real ${className}`
                    : "photo photo--real"
            }
            style={style}
        >
            <div className="photo__frame">
                <Image
                    className="photo__img"
                    src={src}
                    alt={image.alt || ""}
                    width={natural.width}
                    height={natural.height}
                    sizes={sizes}
                    loading={priority ? "eager" : "lazy"}
                    fetchPriority={priority ? "high" : undefined}
                    {...(image.lqip
                        ? {
                              placeholder: "blur" as const,
                              blurDataURL: image.lqip,
                          }
                        : {})}
                />
                {children}
            </div>
            {caption || credit ? (
                <figcaption className="caption">
                    {caption ? (
                        <span className="caption__body">
                            {caption}
                            {credit ? (
                                <span className="caption__src">{credit}</span>
                            ) : null}
                        </span>
                    ) : credit ? (
                        <span className="caption__src">{credit}</span>
                    ) : null}
                </figcaption>
            ) : null}
        </figure>
    );
}
