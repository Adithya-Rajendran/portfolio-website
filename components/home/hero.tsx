import Link from "next/link";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import MotionToggle from "@/components/chrome/motion-toggle";
import StaticStars from "@/components/sky/static-stars";
import Starfield from "@/components/sky/starfield";
import { OpenToItems } from "@/components/ui/availability";
import { Icon } from "@/components/ui/icon";
import { LinkArrow, Status } from "@/components/ui/marks";
import { homeCopy as copy } from "@/lib/copy";
import sunrise from "@/lib/hero-sunrise.json";
import { siteRoutes } from "@/lib/navigation";
import styles from "./hero.module.css";

/**
 * The home hero (contract §9): the only full-bleed image on the site.
 * NASA's orbital sunrise (ISS072-E-30246) is screen-blended over the
 * drifting starfield in Void; under it, and alone in Flight Manual and in
 * print, the same limb is drawn as SVG from the circles fitted to the
 * photograph (lib/hero-sunrise.json), so the first paint is right before
 * the photograph arrives, and without it. Centred over the black above
 * the limb: the name (the page's h1), the profile's one-line headline,
 * what the owner is open to (the profile's availability, only when set),
 * one action (CV, a hairline button over the photograph) and one quiet
 * link down to the selected projects. The headline's and the Open To
 * line's parts are kept whole, and stack on phones. At the foot, the
 * credit with the frame's NASA ID, and Pause motion. The header's
 * wordmark steps aside while the hero's name shows below the header (the
 * starfield sets `html[data-hero]`). Everything is server-rendered;
 * the starfield and the motion control are the only islands.
 */

type Crop = "desktop" | "mobile";

const MOBILE = "(max-width: 47.99rem)";
const DESKTOP = "(min-width: 48rem)";
const SIZES = "100vw";

function srcSet(crop: Crop, format: "avif" | "webp"): string {
    return sunrise[crop].sources
        .map((source) => `${source[format]} ${source.width}w`)
        .join(", ");
}

/** One size of one format for the viewport in use, fetched early. */
export function preloadHeroPhoto() {
    for (const [crop, media] of [
        ["desktop", DESKTOP],
        ["mobile", MOBILE],
    ] as const) {
        preload(sunrise[crop].sources.at(-1)!.avif, {
            as: "image",
            type: "image/avif",
            media,
            imageSrcSet: srcSet(crop, "avif"),
            imageSizes: SIZES,
            fetchPriority: "high",
        });
    }
}

/** How far below the surface line the drawn parallels run, in CSS pixels
 *  at the crop's reference width: closer together toward the horizon. */
const PARALLELS: Record<Crop, readonly number[]> = {
    desktop: [20, 46, 80],
    mobile: [22, 52, 96],
};

/**
 * The limb drawn on the photograph's own geometry: the night side (which
 * hides the stars behind the planet), the top of the atmosphere and the
 * surface under it as hairlines, the planet's parallels, and the sun, an
 * identity mark (`data-identity`: orange, outside the accent's budget).
 * The viewBox is the crop's largest encode, and `xMidYMax slice` matches
 * the photograph's `object-fit: cover` anchored to the bottom.
 */
function Alignment({ crop }: { crop: Crop }) {
    const { width, height, limb, surface, sun } = sunrise[crop];
    // A 1440px-wide desktop crop draws at 0.375 of its encode: sizes are
    // in the encode's pixels.
    const unit = width / (crop === "desktop" ? 1440 : 390);
    return (
        <svg
            className={crop === "desktop" ? styles.alignD : styles.alignM}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
            focusable="false"
        >
            <circle
                className={styles.body}
                cx={limb.cx}
                cy={limb.cy}
                r={limb.r}
            />
            <circle
                className={styles.surface}
                cx={surface.cx}
                cy={surface.cy}
                r={surface.r}
            />
            <g className={styles.parallels}>
                {PARALLELS[crop].map((depth) => (
                    <circle
                        key={depth}
                        cx={surface.cx}
                        cy={surface.cy}
                        r={surface.r - depth * unit}
                    />
                ))}
            </g>
            <circle
                className={styles.rim}
                cx={limb.cx}
                cy={limb.cy}
                r={limb.r}
            />
            <circle
                className={styles.halo}
                cx={sun.x}
                cy={sun.y}
                r={17 * unit}
            />
            <circle
                className={styles.sun}
                cx={sun.x}
                cy={sun.y}
                r={5.5 * unit}
                data-identity
            />
        </svg>
    );
}

function Photo() {
    const style = {
        "--preview-d": `url("${sunrise.desktop.preview}")`,
        "--preview-m": `url("${sunrise.mobile.preview}")`,
    } as CSSProperties;
    const fallback = sunrise.desktop.sources[1] ?? sunrise.desktop.sources[0];
    return (
        <picture className={styles.picture} style={style}>
            <source
                type="image/avif"
                media={MOBILE}
                srcSet={srcSet("mobile", "avif")}
                sizes={SIZES}
            />
            <source
                type="image/webp"
                media={MOBILE}
                srcSet={srcSet("mobile", "webp")}
                sizes={SIZES}
            />
            <source
                type="image/avif"
                srcSet={srcSet("desktop", "avif")}
                sizes={SIZES}
            />
            {/* Pre-encoded with a matching preload: no runtime transform.
                Decorative; the credit is in the text below. */}
            <img
                className={styles.img}
                src={fallback.webp}
                srcSet={srcSet("desktop", "webp")}
                sizes={SIZES}
                width={sunrise.desktop.width}
                height={sunrise.desktop.height}
                alt=""
                loading="eager"
                fetchPriority="high"
                decoding="async"
            />
        </picture>
    );
}

export default function Hero({
    name,
    headline,
    openTo,
    projects,
}: {
    name: string;
    headline: string | null;
    /** The availability line: "Summer 2027 internships · …". */
    openTo: string | null;
    /** Whether there are projects to link down to. */
    projects: boolean;
}) {
    const words = name.split(/\s+/).filter(Boolean);
    return (
        <section
            className={styles.hero}
            aria-labelledby="hero-name"
            data-drift-zone
        >
            <div className={styles.sky}>
                <Starfield />
                <StaticStars />
                <div className={styles.photo}>
                    <Alignment crop="desktop" />
                    <Alignment crop="mobile" />
                    <Photo />
                </div>
            </div>

            <div className={`shell ${styles.frame}`}>
                <div className={styles.centre}>
                    <h1 className={styles.name} id="hero-name" data-clear>
                        {words.map((word, index) => (
                            <span key={`${word}-${index}`}>
                                {index ? " " : null}
                                <span className={styles.word}>{word}</span>
                            </span>
                        ))}
                    </h1>
                    {headline ? (
                        <p className={`open-to ${styles.headline}`} data-clear>
                            <OpenToItems text={headline} />
                        </p>
                    ) : null}
                    {openTo ? (
                        <p className={styles.status} data-clear>
                            <Status value="active">{copy.openTo}</Status>{" "}
                            <span className={`open-to ${styles.openTo}`}>
                                <OpenToItems text={openTo} />
                            </span>
                        </p>
                    ) : null}
                    <nav
                        className={styles.routes}
                        aria-label={copy.routesLabel}
                        data-clear
                    >
                        <Link className="btn" href={siteRoutes.resume}>
                            <span>{copy.cv}</span>
                            <Icon name="arrow" className="icon--nudge" />
                        </Link>
                        {projects ? (
                            <LinkArrow
                                className={styles.down}
                                href="#home-projects"
                                icon="arrow-down"
                            >
                                {copy.projectsAct.title}
                            </LinkArrow>
                        ) : null}
                    </nav>
                </div>

                <div className={styles.foot}>
                    <p className={styles.credit} data-clear>
                        <a
                            href={sunrise.source}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {sunrise.credit}{" "}
                            <span className={styles.creditSep}>· </span>
                            <span className={styles.creditId}>
                                {sunrise.id}
                            </span>
                        </a>
                    </p>
                    <MotionToggle className={styles.motion} />
                </div>
            </div>
        </section>
    );
}
