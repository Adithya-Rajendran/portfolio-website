import { starLayout, starPaths } from "@/lib/sky/stars";

const WIDTH = 1600;
const HEIGHT = 1000;
// Seeded, so every build draws the same sky; three paths for the field.
const PATHS = starPaths(starLayout(1990, 240, WIDTH, HEIGHT));

/**
 * The server star layer: a seeded field of dots in three magnitudes,
 * drawn without JavaScript and without the visibly repeating tile of the
 * old design. It never moves; the drifting canvas
 * (components/sky/starfield.tsx) is a separate island that replaces it in
 * the home hero once it has drawn.
 *
 * - `fixed` fills the viewport behind the page: the Loss of Signal and
 *   error pages.
 * - `band` sits behind a page head and fades out before the first
 *   section (contract §1): its parent is `position: relative` with
 *   `isolation: isolate`. Never behind a long read.
 * - `field` fills its positioned parent: the home hero, under the canvas.
 */
export default function StaticStars({
    variant = "fixed",
}: {
    variant?: "fixed" | "band" | "field";
}) {
    return (
        <svg
            className={
                variant === "fixed"
                    ? "static-stars"
                    : `static-stars static-stars--${variant}`
            }
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            focusable="false"
            data-print="hide"
        >
            <path className="static-stars__faint" d={PATHS[3]} />
            <path className="static-stars__mid" d={PATHS[2]} />
            <path className="static-stars__bright" d={PATHS[1]} />
        </svg>
    );
}
