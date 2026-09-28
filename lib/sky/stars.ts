/**
 * The pure parts of the sky: a seeded PRNG, the static star layout and
 * the drifting starfield's geometry (density, drift and the clearings
 * that keep stars off text). Seeded, so the server renders the same stars
 * on every build and no `Math.random()` runs in render; the canvas
 * (components/sky/starfield.tsx) draws from the same layout. Keep this
 * module free of imports.
 */

/** mulberry32: a small, fast, seeded PRNG returning [0, 1). */
export function mulberry32(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 1 is the brightest; most stars are faint. */
export type Magnitude = 1 | 2 | 3;

export interface Star {
    x: number;
    y: number;
    mag: Magnitude;
}

/**
 * `count` stars scattered over a `width` × `height` field: about 5 % of
 * magnitude 1, 25 % of magnitude 2 and the rest faint.
 */
export function starLayout(
    seed: number,
    count: number,
    width: number,
    height: number,
): Star[] {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => {
        const x = random() * width;
        const y = random() * height;
        const roll = random();
        const mag: Magnitude = roll < 0.05 ? 1 : roll < 0.3 ? 2 : 3;
        return { x, y, mag };
    });
}

/**
 * One SVG path per magnitude, each star a zero-length segment that a round
 * line cap draws as a dot: three elements for the whole field.
 */
export function starPaths(stars: readonly Star[]): Record<Magnitude, string> {
    const paths: Record<Magnitude, string[]> = { 1: [], 2: [], 3: [] };
    for (const { x, y, mag } of stars) {
        paths[mag].push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
    }
    return { 1: paths[1].join(""), 2: paths[2].join(""), 3: paths[3].join("") };
}

/** A box in the field's pixels, as measured from a text block. */
export interface Clearing {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * How visible a star at (x, y) is among the clearings kept around text:
 * 0 inside a clearing, rising linearly to 1 at `pad` pixels beyond its
 * edge, so a drifting star fades out before it reaches a letter.
 */
export function clearance(
    x: number,
    y: number,
    clearings: readonly Clearing[],
    pad: number,
): number {
    let alpha = 1;
    for (const box of clearings) {
        const dx = Math.max(box.x - x, 0, x - (box.x + box.width));
        const dy = Math.max(box.y - y, 0, y - (box.y + box.height));
        const distance = Math.hypot(dx, dy);
        if (distance === 0) return 0;
        if (distance < pad) alpha = Math.min(alpha, distance / pad);
    }
    return alpha;
}

/** Drift in pixels per second: nearer (brighter) stars move faster. */
export const DRIFT_SPEED: Readonly<Record<Magnitude, number>> = {
    1: 4.2,
    2: 2.6,
    3: 1.4,
};

/**
 * A star's x after `seconds` of drift to the left at `speed`, wrapping
 * inside [0, width): the field is a loop, so it never runs out.
 */
export function driftX(
    x: number,
    seconds: number,
    speed: number,
    width: number,
): number {
    if (width <= 0) return x;
    const moved = (x - seconds * speed) % width;
    return moved < 0 ? moved + width : moved;
}

/** Stars for a field of this size: one per ~5,600 px², within bounds. */
export function starCount(width: number, height: number): number {
    const count = Math.round((Math.max(0, width) * Math.max(0, height)) / 5600);
    return Math.min(420, Math.max(40, count));
}
