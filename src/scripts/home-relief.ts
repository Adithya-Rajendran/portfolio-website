import * as T from "three";
import { HOME_SHADOW, HOME_SUN_DIRECTION } from "./home-lighting";
import { homeScenePoint } from "./home-terrain";

/**
 * What the orbital elevation cannot hold, worked out from what it does.
 *
 * The butte north of the outpost is measured every two metres. That keeps
 * its bulk and loses its beds: courses of delta sediment a few metres thick,
 * the hard ones standing as ledges above slopes of their own rubble. The
 * beds here are cut back into the measured slope along its own contours and
 * never add height. They are an interpretation, not a survey.
 */

/**
 * One course of rock, climbing the slope it was cut into: a nearly level
 * tread, then the rubble banked against the face, then the face itself up
 * to its lip. Each part ends at a share of the course's width, having
 * gained a share of its thickness.
 */
export const HOME_BEDS = {
    /** Metres, on average; courses run from two thirds to twice this. */
    thickness: 5.5,
    tread: { ends: 0.76, gained: 0.08 },
    rubble: { ends: 0.93, gained: 0.42 },
} as const;

/** The butte's summit as measured, in metres from the data's centre. */
const SUMMIT = { east: 14.5, north: 425.5 };

export interface HomeBeds {
    /** The ground rebuilt finely enough to hold ledges. */
    left: number;
    right: number;
    back: number;
    front: number;
    /**
     * At a place: metres to cut from the measured ground (never positive),
     * the count of courses below it, and how strongly they show (0 to 1).
     */
    at(x: number, z: number): { cut: number; bed: number; strength: number };
}

const NONE = { cut: 0, bed: 0, strength: 0 };

export function makeHomeBeds(
    measured: (x: number, z: number) => number,
    noise: { noise(x: number, y: number, z: number): number },
): HomeBeds {
    const summit = homeScenePoint(SUMMIT.east, SUMMIT.north);
    const centre = { x: summit.x + 4, z: summit.z + 6 },
        reach = { x: 260, z: 192 };
    const { thickness, tread, rubble } = HOME_BEDS;
    const { smoothstep, lerp } = T.MathUtils;
    return {
        left: centre.x - reach.x,
        right: centre.x + reach.x,
        back: centre.z - reach.z,
        front: centre.z + reach.z,
        at(x, z) {
            // Courses fade out well inside the rebuilt ground, so its edge
            // meets the coarser ground around it at the measured height.
            const within =
                (1 -
                    smoothstep(
                        Math.abs(x - centre.x),
                        reach.x - 48,
                        reach.x - 6,
                    )) *
                (1 -
                    smoothstep(
                        Math.abs(z - centre.z),
                        reach.z - 44,
                        reach.z - 6,
                    ));
            if (within <= 0) return NONE;
            const height = measured(x, z);
            // Below this the slope is buried in what fell from above.
            const raised = smoothstep(height, 12, 24);
            if (raised <= 0) return NONE;
            // Rubble mantles some flanks; hard and soft courses alternate;
            // the cap is hard all round.
            const mantle =
                0.35 +
                0.65 * smoothstep(noise.noise(x / 70, z / 70, 21), -0.25, 0.35);
            const course =
                0.45 +
                0.275 *
                    (1 +
                        Math.sin(
                            height * 0.4 + 4 * noise.noise(x / 140, z / 140, 5),
                        ));
            const cap = smoothstep(height, 44, 54);
            const strength = within * raised * lerp(mantle * course, 1, cap);
            // Beds dip gently and wander, and their edges are broken at
            // the scale of a rockfall.
            const level =
                height +
                0.012 * (x - summit.x) -
                0.006 * (z - summit.z) +
                2 * noise.noise(x / 85, z / 85, 3) +
                0.35 * noise.noise(x / 9, z / 9, 7) +
                0.9 * noise.noise(x / 34, z / 34, 13);
            // Thick and thin courses alternate: `beds` counts them at a
            // level, and `rate` is its slope, which never reaches zero.
            const beds = (at: number) =>
                    at / thickness + 0.3 * Math.sin(at * 0.31),
                rate = (at: number) =>
                    1 / thickness + 0.093 * Math.cos(at * 0.31);
            const bed = beds(level);
            const along = bed - Math.floor(bed);
            const climbed =
                along < tread.ends
                    ? (tread.gained * along) / tread.ends
                    : along < rubble.ends
                      ? lerp(
                            tread.gained,
                            rubble.gained,
                            (along - tread.ends) / (rubble.ends - tread.ends),
                        )
                      : lerp(
                            rubble.gained,
                            1,
                            (along - rubble.ends) / (1 - rubble.ends),
                        );
            // The cut surface stands at the level whose count is the
            // course's foot plus what its profile has climbed. Courses vary
            // in thickness within themselves, so that level is solved for
            // rather than scaled from here; three steps settle it.
            const wanted = bed - along + climbed;
            let cutLevel = level + (wanted - bed) / rate(level);
            for (let step = 0; step < 3; step++)
                cutLevel -= (beds(cutLevel) - wanted) / rate(cutLevel);
            return {
                cut: strength * Math.min(0, cutLevel - level),
                bed,
                strength,
            };
        },
    };
}

const glsl = (value: number) => value.toFixed(5);

/**
 * GLSL for a course at `along` (0 at the foot of its tread, 1 at its lip):
 * which part a point stands on (0 tread, 1 rubble, 2 face), and how much
 * that part multiplies the measured slope.
 */
export const HOME_BEDS_GLSL = `
    float homeBedPart(float along) {
        return step(${glsl(HOME_BEDS.tread.ends)}, along) + step(${glsl(HOME_BEDS.rubble.ends)}, along);
    }
    float homeBedSlope(float along) {
        return along < ${glsl(HOME_BEDS.tread.ends)}
            ? ${glsl(HOME_BEDS.tread.gained / HOME_BEDS.tread.ends)}
            : along < ${glsl(HOME_BEDS.rubble.ends)}
              ? ${glsl((HOME_BEDS.rubble.gained - HOME_BEDS.tread.gained) / (HOME_BEDS.rubble.ends - HOME_BEDS.tread.ends))}
              : ${glsl((1 - HOME_BEDS.rubble.gained) / (1 - HOME_BEDS.rubble.ends))};
    }`;

interface ShadowGrid {
    origin: { x: number; z: number };
    step: number;
    columns: number;
    rows: number;
    top: Float32Array;
    /** The height below which a place is shaded; far below ground past the edge. */
    at(x: number, z: number): number;
}

const OPEN = -2000;

/**
 * Sweeps the ground once, away from the sun, carrying the shadow's upper
 * surface from each cell to the next in its column.
 */
function sweep(
    left: number,
    right: number,
    back: number,
    front: number,
    step: number,
    height: (x: number, z: number) => number,
    entering?: (x: number, z: number) => number,
): ShadowGrid {
    const sun = HOME_SUN_DIRECTION;
    // The sun stands toward -z, so columns run from the back row forward.
    const lean = sun.x / sun.z,
        fall = (sun.y / Math.hypot(sun.x, sun.z)) * step * Math.hypot(1, lean);
    const depth = front - back;
    const origin = { x: left - Math.max(0, lean * depth), z: back };
    const columns =
            Math.ceil((right - left + Math.abs(lean * depth)) / step) + 1,
        rows = Math.ceil(depth / step) + 1;
    const top = new Float32Array(columns * rows);
    const ground = new Float32Array(columns);
    for (let row = 0; row < rows; row++) {
        const z = back + row * step;
        for (let column = 0; column < columns; column++) {
            const x = origin.x + column * step + lean * (z - back);
            const at = row * columns + column;
            top[at] = row
                ? Math.max(ground[column], top[at - columns]) - fall
                : (entering?.(x, z) ?? OPEN);
            ground[column] = height(x, z);
        }
    }
    return {
        origin,
        step,
        columns,
        rows,
        top,
        at(x, z) {
            const row = (z - back) / step,
                column = (x - origin.x - lean * (z - back)) / step;
            if (row < 0 || column < 0 || row > rows - 1 || column > columns - 1)
                return OPEN;
            const r = Math.max(0, Math.min(rows - 2, Math.floor(row))),
                c = Math.max(0, Math.min(columns - 2, Math.floor(column))),
                v = row - r,
                u = column - c,
                i = r * columns + c;
            return (
                (top[i] * (1 - u) + top[i + 1] * u) * (1 - v) +
                (top[i + columns] * (1 - u) + top[i + columns + 1] * u) * v
            );
        },
    };
}

/**
 * The sun's shadow across the scene's ground, published for every material
 * that calls `applyHomeHaze`. `ground` is the finished surface within the
 * given bounds; `beyond` is the measured terrain out to the crater rim, whose
 * shadows enter the scene along its sunward edge.
 */
export function makeHomeShadow(
    bounds: { left: number; right: number; back: number; front: number },
    ground: (x: number, z: number) => number,
    beyond: (x: number, z: number) => number,
) {
    const far = sweep(-8200, 8200, -8200, 8200, 64, beyond);
    const near = sweep(
        bounds.left,
        bounds.right,
        bounds.back,
        bounds.front,
        3,
        ground,
        far.at,
    );
    const texels = new Uint16Array(near.top.length);
    for (let i = 0; i < texels.length; i++)
        texels[i] = T.DataUtils.toHalfFloat(
            T.MathUtils.clamp(near.top[i], OPEN, -OPEN),
        );
    const texture = new T.DataTexture(
        texels,
        near.columns,
        near.rows,
        T.RedFormat,
        T.HalfFloatType,
    );
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    HOME_SHADOW.homeShadow.value = texture;
    HOME_SHADOW.homeShadowFrame.value.set(
        near.origin.x,
        near.origin.z,
        HOME_SUN_DIRECTION.x / HOME_SUN_DIRECTION.z,
        near.step,
    );
    HOME_SHADOW.homeShadowSize.value.set(near.columns, near.rows);
    return {
        /** The height below which a place is in shadow. */
        topAt: (x: number, z: number) => {
            const close = near.at(x, z);
            return close > OPEN ? close : far.at(x, z);
        },
        dispose() {
            texture.dispose();
            // A later scene may already have published its own.
            if (HOME_SHADOW.homeShadow.value !== texture) return;
            HOME_SHADOW.homeShadow.value = null;
            HOME_SHADOW.homeShadowSize.value.set(0, 0);
        },
    };
}
