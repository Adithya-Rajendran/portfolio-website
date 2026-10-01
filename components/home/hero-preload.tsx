"use client";

import { preload, type PreloadOptions } from "react-dom";

/**
 * The hero photograph's preloads, called from a client component. A
 * server component's `preload()`, or a `<link rel="preload">` it renders,
 * travels as a hint in the RSC payload, and React applies a hint to
 * whatever document is open when the payload arrives: a prefetch of home
 * (the header's brand) fetched the photograph on every page. Here the
 * call runs only where the hero renders: in home's HTML, and when home
 * mounts after a navigation (not in Flight Manual, which never shows the
 * photograph).
 */
export default function HeroPreload({
    images,
}: {
    images: readonly { href: string; options: PreloadOptions }[];
}) {
    if (
        typeof document !== "undefined" &&
        document.documentElement.dataset.theme === "manual"
    )
        return null;
    for (const { href, options } of images) preload(href, options);
    return null;
}
