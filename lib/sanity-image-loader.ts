"use client";

/**
 * next/image's loader (`images.loaderFile` in next.config.mjs): Sanity's
 * image CDN makes each width of a srcset straight from the original, so a
 * photograph is encoded once, not by Sanity and then again by Vercel's
 * optimizer at every width. Every next/image on the site is a Sanity image
 * (`Plate`, `FigurePlate`), whose src is `urlForImage(…)` with the widest
 * file to request as its `w`: a srcset width past it asks for that one.
 * Any other source is returned as given.
 */
export default function sanityImageLoader({
    src,
    width,
    quality,
}: {
    src: string;
    width: number;
    quality?: number;
}): string {
    if (!src.startsWith("https://cdn.sanity.io/images/")) return src;
    const url = new URL(src);
    const widest = Number(url.searchParams.get("w")) || width;
    url.searchParams.set("w", String(Math.min(width, widest)));
    url.searchParams.set("q", String(quality ?? 75));
    return url.href;
}
