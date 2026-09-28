/**
 * The pure parts of the sky: a seeded PRNG and the static star layout.
 * Seeded, so the server renders the same stars on every build and no
 * `Math.random()` runs in render. The canvas starfield (PR 13) reuses the
 * PRNG. Keep this module free of imports.
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
