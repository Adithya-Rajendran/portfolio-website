/**
 * How tall a settlement's solid hardware stands over each square of its
 * site, and whether one point can be seen from another past it. Everything
 * here is in the settlement's metres as built, before its ground is curved.
 */
export interface Skyline {
    /** Squares along a side. */
    cells: number;
    /** Metres along a side of one square. */
    square: number;
    /** Metres from the settlement's centre to the grid's edge. */
    half: number;
    /** Height over each square in metres, row by row from the least z and x. */
    tall: Float32Array;
}

export function readSkyline(
    heights: { cells: number; step: number; data: string },
    metres: number,
): Skyline | undefined {
    const bytes = atob(heights.data);
    if (bytes.length !== heights.cells * heights.cells) return undefined;
    const tall = new Float32Array(bytes.length);
    for (let i = 0; i < bytes.length; i++)
        tall[i] = bytes.charCodeAt(i) * heights.step;
    return {
        cells: heights.cells,
        square: metres / heights.cells,
        half: metres / 2,
        tall,
    };
}

/**
 * The top of a structure cannot hide itself, nor can the rest of its own
 * bulk: hardware this near the far end of a sight line is left out, in
 * metres.
 */
const OWN = 14;
/** Kerbs, pipes and vehicles hide nothing worth naming: nothing this low. */
const LOW = 4;
/**
 * The line has to pass this far over anything taller. A top that only just
 * shows over a nearer roof would have its name read as that roof's.
 */
const CLEAR = 1.5;

/**
 * Whether `to` can be seen from `from`: no solid hardware stands over the
 * straight line between them. Each point is [x, y, z].
 */
export function inSight(
    skyline: Skyline,
    from: readonly number[],
    to: readonly number[],
) {
    const across = Math.hypot(to[0] - from[0], to[2] - from[2]);
    // Twice to a square, so no square the line crosses is stepped over.
    const steps = Math.ceil(across / (skyline.square * 0.5));
    for (let step = 1; step < steps; step++) {
        const along = step / steps;
        if ((1 - along) * across < OWN) break;
        const column = Math.floor(
                (from[0] + (to[0] - from[0]) * along + skyline.half) /
                    skyline.square,
            ),
            row = Math.floor(
                (from[2] + (to[2] - from[2]) * along + skyline.half) /
                    skyline.square,
            );
        if (
            column < 0 ||
            row < 0 ||
            column >= skyline.cells ||
            row >= skyline.cells
        )
            continue;
        const tall = skyline.tall[row * skyline.cells + column];
        if (tall < LOW) continue;
        if (tall > from[1] + (to[1] - from[1]) * along - CLEAR) return false;
    }
    return true;
}
