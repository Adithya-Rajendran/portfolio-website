import Link from "next/link";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import MotionToggle from "@/components/chrome/motion-toggle";
import StaticStars from "@/components/sky/static-stars";
import Starfield from "@/components/sky/starfield";
import { Icon } from "@/components/ui/icon";
import { Status } from "@/components/ui/marks";
import { homeCopy as copy } from "@/lib/copy";
import sunrise from "@/lib/hero-sunrise.json";
import styles from "./hero.module.css";

/**
 * The home hero (§ 00, contract §9): the only full-bleed image on the
 * site. NASA's orbital sunrise (ISS072-E-30246) is screen-blended over the
 * drifting starfield in Void; under it, and alone in Flight Manual and in
 * print, the same limb is drawn as SVG from the circles fitted to the
 * photograph (lib/hero-sunrise.json), so the first paint is right before
 * the photograph arrives, and without it. Centred over the black above
 * the limb: the headline, the name (the page's h1), the tagline, the
 * status line and three quick links, CV first. At the foot, the credit
 * and Pause motion. Everything is server-rendered; the starfield and the
 * motion control are the only islands.
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
 * surface under it as hairlines, the planet's parallels, and the sun as
 * the one orange mark. The viewBox is the crop's largest encode, and
 * `xMidYMax slice` matches the photograph's `object-fit: cover` anchored
 * to the bottom.
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

export interface HeroStatus {
    /** The current role: "MS Engineering (Interdisciplinary) · San José
     *  State University". */
    now: string | null;
    openTo: string | null;
    /** `YYYY-MM-DD` and its words ("24 Sep 2026"). */
    updated: { date: string; label: string } | null;
}

export default function Hero({
    name,
    headline,
    tagline,
    status,
    routes,
}: {
    name: string;
    headline: string | null;
    tagline: string | null;
    status: HeroStatus;
    /** Which quick links have somewhere to go. */
    routes: { cv: boolean; work: boolean; blog: boolean };
}) {
    const words = name.split(/\s+/).filter(Boolean);
    const hasStatus = Boolean(status.now || status.openTo || status.updated);
    return (
        <section
            className={styles.hero}
            aria-labelledby="hero-name"
            data-drift-zone
        >
            <div className={styles.sky}>
                <Starfield />
                <StaticStars variant="field" />
                <div className={styles.photo}>
                    <Alignment crop="desktop" />
                    <Alignment crop="mobile" />
                    <Photo />
                </div>
            </div>

            <div className={`shell ${styles.frame}`}>
                <div className={styles.centre}>
                    {headline ? (
                        <p className={styles.headline} data-clear>
                            {headline}
                        </p>
                    ) : null}
                    <h1 className={styles.name} id="hero-name" data-clear>
                        {words.map((word, index) => (
                            <span key={`${word}-${index}`}>
                                {index ? " " : null}
                                <span className={styles.word}>{word}</span>
                            </span>
                        ))}
                    </h1>
                    {tagline ? (
                        <p className={styles.tagline} data-clear>
                            {tagline}
                        </p>
                    ) : null}
                    {hasStatus ? (
                        <p className={styles.status} data-clear>
                            {status.now ? (
                                <span className={styles.statusNow}>
                                    <Status value="active">{copy.now}</Status>{" "}
                                    <span>{status.now}</span>
                                </span>
                            ) : null}
                            {status.openTo ? (
                                <span className={styles.statusOpen}>
                                    <span className={styles.statusKey}>
                                        {copy.openTo}
                                    </span>{" "}
                                    {status.openTo}
                                </span>
                            ) : null}
                            {status.updated ? (
                                <span className={styles.statusUpdated}>
                                    {copy.updated}{" "}
                                    <time dateTime={status.updated.date}>
                                        {status.updated.label}
                                    </time>
                                </span>
                            ) : null}
                        </p>
                    ) : null}
                    {routes.cv || routes.work || routes.blog ? (
                        <nav
                            className={styles.routes}
                            aria-label={copy.routesLabel}
                            data-clear
                        >
                            {routes.cv ? (
                                <Link className="btn" href="/resume">
                                    <span>{copy.cv}</span>
                                    <Icon
                                        name="arrow"
                                        className="icon--nudge"
                                    />
                                </Link>
                            ) : null}
                            {routes.work ? (
                                <a className="btn" href="#missions">
                                    <span>{copy.work}</span>
                                    <Icon
                                        name="arrow-down"
                                        className="icon--nudge"
                                    />
                                </a>
                            ) : null}
                            {routes.blog ? (
                                <Link className="btn" href="/blog">
                                    <span>{copy.blog}</span>
                                    <Icon
                                        name="arrow"
                                        className="icon--nudge"
                                    />
                                </Link>
                            ) : null}
                        </nav>
                    ) : null}
                </div>

                <div className={styles.foot}>
                    <p className={styles.credit} data-clear>
                        <a
                            href={sunrise.source}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {sunrise.credit}
                        </a>
                    </p>
                    <MotionToggle className={styles.motion} />
                </div>
            </div>
        </section>
    );
}
