import Image from "next/image";
import type { CSSProperties } from "react";
import type { SanityImageValue } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";

/**
 * A photograph as a numbered plate outside the long read (contract §4,
 * the mockup's site.css 4.26): a mission's cover or its model's poster,
 * inside the grid (5 columns beside copy, at most 8 alone). The image
 * dissolves into the dark in Void and is mounted with crop marks in
 * Flight Manual (`.photo` in styles/components.css). The plate number is
 * printed on the photograph for sighted readers and leads the caption for
 * everyone; the caption is the owner's words, never an explanation.
 * Returns nothing for an image without an asset.
 */
export default function Plate({
    image,
    label,
    tag,
    caption,
    ratio,
    focus,
    sizes,
    width = 1200,
    priority = false,
    className,
    children,
}: {
    image: SanityImageValue | null | undefined;
    /** "Pl. I". */
    label: string;
    /** Printed on the plate after its number: "MSN-02". */
    tag?: string;
    caption?: React.ReactNode;
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
                <span className="photo__plate" aria-hidden="true">
                    {tag ? `${label} · ${tag}` : label}
                </span>
                {children}
            </div>
            <figcaption className="caption caption--plate">
                <span className="caption__num">{label}</span>
                {caption ? (
                    <span className="caption__body">{caption}</span>
                ) : null}
            </figcaption>
        </figure>
    );
}
