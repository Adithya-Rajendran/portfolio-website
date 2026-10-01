import { starLayout, starPaths } from "@/lib/sky/stars";

const WIDTH = 1600;
const HEIGHT = 1000;
// Seeded, so every build draws the same sky; three paths for the field.
const PATHS = starPaths(starLayout(1990, 240, WIDTH, HEIGHT));

/**
 * The home hero's server star layer: a seeded field of dots in three
 * magnitudes filling its positioned parent, drawn without JavaScript. It
 * never moves; the drifting canvas (components/sky/starfield.tsx) is a
 * separate island that replaces it once it has drawn. Void only: Flight
 * Manual draws no stars (styles/los.css), and no page head, reading page
 * or index carries any.
 */
export default function StaticStars() {
    return (
        <svg
            className="static-stars"
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
