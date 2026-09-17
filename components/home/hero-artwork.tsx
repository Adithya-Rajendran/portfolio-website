import { preload } from "react-dom";
import artwork from "@/lib/hero-artwork.json";

const mobileMedia = "(max-width: 480px)";
const landscapeMedia = "not all and (max-width: 480px)";
const landscapeSizes =
    "(max-width: 620px) max(100vw, 854px, calc(177.78svh - 416px)), max(100vw, 960px, calc(177.78svh - 469px))";
const mobileSizes = "max(100vw, 480px, calc(100svh - 234px))";

function sourceSet(
    variants: typeof artwork.landscape,
    format: "avif" | "webp",
) {
    return variants
        .map((variant) => `${variant[format]} ${variant.width}w`)
        .join(", ");
}

const landscapeAvif = sourceSet(artwork.landscape, "avif");
const mobileAvif = sourceSet(artwork.mobile, "avif");
const landscapeWebp = sourceSet(artwork.landscape, "webp");
const mobileWebp = sourceSet(artwork.mobile, "webp");
const landscapeFallback = artwork.landscape.at(-1)!;
const mobileFallback = artwork.mobile.at(-1)!;

export function preloadHeroArtwork() {
    // Preload only one supported format and one matching viewport. Preloading
    // the WebP fallback too would download both images in AVIF-capable browsers.
    preload(landscapeFallback.avif, {
        as: "image",
        type: "image/avif",
        media: landscapeMedia,
        imageSrcSet: landscapeAvif,
        imageSizes: landscapeSizes,
        fetchPriority: "high",
    });
    preload(mobileFallback.avif, {
        as: "image",
        type: "image/avif",
        media: mobileMedia,
        imageSrcSet: mobileAvif,
        imageSizes: mobileSizes,
        fetchPriority: "high",
    });
}

export default function HeroArtwork() {
    return (
        <picture
            className="fj-artwork"
            style={{ backgroundImage: `url("${artwork.preview}")` }}
        >
            <source
                type="image/avif"
                media={mobileMedia}
                srcSet={mobileAvif}
                sizes={mobileSizes}
            />
            <source
                type="image/avif"
                srcSet={landscapeAvif}
                sizes={landscapeSizes}
            />
            <source
                type="image/webp"
                media={mobileMedia}
                srcSet={mobileWebp}
                sizes={mobileSizes}
            />
            {/* Assets are pre-encoded with matching preloads; no runtime image transform is needed. */}
            <img
                className="fj-art"
                src={landscapeFallback.webp}
                srcSet={landscapeWebp}
                sizes={landscapeSizes}
                width={3840}
                height={2160}
                alt="Two distant figures standing together at an observation railing, overlooking an imagined lunar settlement beneath Earth and a quiet starfield"
                loading="eager"
                fetchPriority="high"
                decoding="async"
            />
        </picture>
    );
}
