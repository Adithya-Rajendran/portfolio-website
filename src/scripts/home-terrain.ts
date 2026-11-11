import * as T from "three";
import { readPngSamples } from "../lib/png-samples";

/**
 * The ground is Jezero crater as the HiRISE camera measured it: three nested
 * elevation grids (2 m, 16 m and 64 m posts) around a point on the crater
 * floor south of an isolated butte of the western delta, with the orbital
 * image's fine tone and the 1 m surface normals for the innermost kilometre.
 * See public/terrain/jezero-v1/CREDITS.md and pack.json for the sources.
 */
const ROOT = "/terrain/jezero-v1/";
/** Shared range of the three height files, metres on the Mars geoid. */
const LOWEST = -2660.8,
    HIGHEST = -2271.9;
const LEVELS = [
    { file: "height-0.png", size: 512, post: 2 },
    { file: "height-1.png", size: 512, post: 16 },
    { file: "height-2.png", size: 256, post: 64 },
] as const;
/** Half-widths, in metres, of the fine tone and normal maps and the broad tone map. */
export const HOME_TERRAIN_FINE = 512,
    HOME_TERRAIN_BROAD = 4096;

/**
 * Where the scene's origin stands, in metres east and north of the data's
 * centre, and the compass bearing its -Z axis looks along. The butte then
 * rises ahead and to the right of the composed views, lit from the right.
 */
export const HOME_SITE = { east: -262, north: 96, heading: 50 };

/** The scene position of a point given in metres from the data's centre. */
export function homeScenePoint(east: number, north: number) {
    const bearing = T.MathUtils.degToRad(HOME_SITE.heading),
        cos = Math.cos(bearing),
        sin = Math.sin(bearing);
    const byEast = east - HOME_SITE.east,
        byNorth = north - HOME_SITE.north;
    return {
        x: byEast * cos - byNorth * sin,
        z: -byEast * sin - byNorth * cos,
    };
}

/**
 * The skyline beyond the elevation grids, from the scene's origin: how high
 * the land stands above the level horizon at each of 2048 compass bearings,
 * and how far off, in three ranges. Rows are the angles for 1.5 to 6 km, 6 to
 * 20 km and farther, then the three distances. Angles span -1 to 15 degrees
 * and distances 0 to 160 km over the 16 bits.
 */
const SKYLINE = { file: "skyline.png", width: 2048, rows: 6 };

async function skyline() {
    const response = await fetch(ROOT + SKYLINE.file);
    if (!response.ok)
        throw new Error(`${SKYLINE.file} answered ${response.status}`);
    const png = await readPngSamples(await response.arrayBuffer());
    if (
        png.width !== SKYLINE.width ||
        png.height !== SKYLINE.rows ||
        png.channels !== 1 ||
        !(png.samples instanceof Uint16Array)
    )
        throw new Error(`${SKYLINE.file} is not the expected table`);
    // The nearest range lies inside the grids and is drawn as ground. One
    // texel per bearing holds the other two: degrees, degrees, km, km.
    const texels = new Uint16Array(SKYLINE.width * 4);
    const row = (index: number, column: number) =>
        png.samples[index * SKYLINE.width + column] / 65535;
    for (let column = 0; column < SKYLINE.width; column++) {
        texels[column * 4] = T.DataUtils.toHalfFloat(row(1, column) * 16 - 1);
        texels[column * 4 + 1] = T.DataUtils.toHalfFloat(
            row(2, column) * 16 - 1,
        );
        texels[column * 4 + 2] = T.DataUtils.toHalfFloat(row(4, column) * 160);
        texels[column * 4 + 3] = T.DataUtils.toHalfFloat(row(5, column) * 160);
    }
    const texture = new T.DataTexture(
        texels,
        SKYLINE.width,
        1,
        T.RGBAFormat,
        T.HalfFloatType,
    );
    texture.wrapS = T.RepeatWrapping;
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

export interface HomeTerrain {
    /** Real ground height under a scene position, zero at the origin. */
    heightAt(x: number, z: number): number;
    /** cos and sin of the heading, then the origin's east and north. */
    frame: T.Vector4;
    fineTone: T.Texture;
    broadTone: T.Texture;
    normals: T.Texture;
    /**
     * Across its width, the compass bearings from north through east. Red
     * and green are the skyline's height in degrees 6 to 20 km off and
     * beyond; blue and alpha are how far off each stands, in kilometres.
     */
    skyline: T.Texture;
    dispose(): void;
}

async function heights(level: (typeof LEVELS)[number]) {
    const response = await fetch(ROOT + level.file);
    if (!response.ok)
        throw new Error(`${level.file} answered ${response.status}`);
    const png = await readPngSamples(await response.arrayBuffer());
    if (
        png.width !== level.size ||
        png.height !== level.size ||
        png.channels !== 3
    )
        throw new Error(`${level.file} is not the expected grid`);
    // Red and green are the high and low bytes of one 16-bit height.
    const metres = new Float32Array(level.size * level.size);
    const scale = (HIGHEST - LOWEST) / 65535;
    for (let i = 0; i < metres.length; i++)
        metres[i] =
            LOWEST +
            ((png.samples[i * 3] << 8) | png.samples[i * 3 + 1]) * scale;
    return metres;
}

export async function loadHomeTerrain(): Promise<HomeTerrain> {
    const loader = new T.TextureLoader();
    const map = async (file: string) => {
        const texture = await loader.loadAsync(ROOT + file);
        // Measurements, not pictures: no colour conversion.
        texture.colorSpace = T.NoColorSpace;
        return texture;
    };
    const [grids, fineTone, broadTone, normals, rim] = await Promise.all([
        Promise.all(LEVELS.map(heights)),
        map("detail-0.webp"),
        map("detail-1.webp"),
        map("normal-0.webp"),
        skyline(),
    ]);
    const bearing = T.MathUtils.degToRad(HOME_SITE.heading),
        cos = Math.cos(bearing),
        sin = Math.sin(bearing);
    /** Bilinear height from one grid; positions past its edge hold the edge. */
    const sample = (index: number, east: number, north: number) => {
        const { size, post } = LEVELS[index];
        const grid = grids[index];
        const column = T.MathUtils.clamp(
                east / post + size / 2 - 0.5,
                0,
                size - 1.001,
            ),
            row = T.MathUtils.clamp(
                size / 2 - 0.5 - north / post,
                0,
                size - 1.001,
            );
        const c = Math.floor(column),
            r = Math.floor(row),
            u = column - c,
            v = row - r,
            at = r * size + c;
        return (
            (grid[at] * (1 - u) + grid[at + 1] * u) * (1 - v) +
            (grid[at + size] * (1 - u) + grid[at + size + 1] * u) * v
        );
    };
    /** How much of a grid applies: all of it inside, none at its edge. */
    const within = (index: number, east: number, north: number) => {
        const half = (LEVELS[index].size * LEVELS[index].post) / 2;
        return (
            1 -
            T.MathUtils.smoothstep(
                Math.max(Math.abs(east), Math.abs(north)) / half,
                0.84,
                0.97,
            )
        );
    };
    const measured = (east: number, north: number) => {
        let height = sample(2, east, north);
        const middle = within(1, east, north);
        if (middle > 0)
            height = T.MathUtils.lerp(height, sample(1, east, north), middle);
        const inner = within(0, east, north);
        if (inner > 0)
            height = T.MathUtils.lerp(height, sample(0, east, north), inner);
        return height;
    };
    const base = measured(HOME_SITE.east, HOME_SITE.north);
    return {
        heightAt: (x, z) =>
            measured(
                HOME_SITE.east + x * cos - z * sin,
                HOME_SITE.north - x * sin - z * cos,
            ) - base,
        frame: new T.Vector4(cos, sin, HOME_SITE.east, HOME_SITE.north),
        fineTone,
        broadTone,
        normals,
        skyline: rim,
        dispose() {
            fineTone.dispose();
            broadTone.dispose();
            normals.dispose();
            rim.dispose();
        },
    };
}
