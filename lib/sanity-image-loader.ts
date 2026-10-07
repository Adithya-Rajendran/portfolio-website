"use client";

/**
 * next/image's loader (`images.loaderFile` in next.config.mjs): Sanity's
 * image CDN makes each width of a srcset straight from the original, so a
 * photograph is encoded once, not by Sanity and then again by Vercel's
 * optimizer at every width. Every next/image on the site is a Sanity image
 * (`Plate`, `FigurePlate`), whose src is `urlForImage(…)` with the widest
 * file to request as its `w`: a srcset width past it asks for that one.
 * Any other source is returned as given.
 *
 * The quality defaults to 60, not the 75 Vercel's optimizer used: at the
 * same number Sanity's encoder sends about 40-50% more bytes (a 640w AVIF
 * was 46.5 KB at 75 and 30.6 KB at 60, where Vercel's was 33.6 KB at 75),
 * so 60 keeps a photograph's weight where it was. A quality a caller
 * passes is kept.
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
    url.searchParams.set("q", String(quality ?? 60));
    return url.href;
}
