import { starLayout, starPaths } from "@/lib/sky/stars";

const WIDTH = 1600;
const HEIGHT = 1000;
// Seeded, so every build draws the same sky; three paths for the field.
const PATHS = starPaths(starLayout(1990, 240, WIDTH, HEIGHT));

/**
 * The server star layer: a fixed, seeded field of dots in three
 * magnitudes behind the page, drawn without JavaScript and without the
 * visibly repeating tile of the old design. It never moves; the drifting
 * canvas (PR 13) is a separate island. Used by the Loss of Signal and
 * error pages, never on reading pages.
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
