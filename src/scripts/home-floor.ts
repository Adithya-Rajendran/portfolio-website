import * as T from "three";

/**
 * The crater floor at the scale of a boot, which no orbiter resolves: slabs
 * of fractured bedrock, the sand that fills their joints and drifts over
 * them in rippled sheets, and the stones that lie on both. It is one square
 * of ground that repeats without a seam, made by
 * scripts/artwork/make-home-floor.mjs. It is an interpretation of such
 * ground as the rovers' cameras show it, not a survey of this place.
 *
 * Because the scene's sun never moves, the square carries the shadow each
 * slab edge and pebble throws under that sun.
 */
const ROOT = "/terrain/floor-v1/";

/** Metres along a side of the square, and the range its slopes are stored over. */
export const HOME_FLOOR = { metres: 8, steepest: 2.5 };

export interface HomeFloor {
    /** Red and green: slope along x and z. Blue: how much sun reaches. */
    relief: T.Texture;
    colour: T.Texture;
    dispose(): void;
}

const square = (
    texels: Uint8Array<ArrayBuffer>,
    size: number,
    anisotropy: number,
    colour = false,
) => {
    const texture = new T.DataTexture(texels, size, size, T.RGBAFormat);
    if (colour) texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.magFilter = T.LinearFilter;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
};

/** Level, sunlit and of one tone: the ground before its detail arrives. */
export function plainHomeFloor(): HomeFloor {
    const relief = square(new Uint8Array([128, 128, 255, 255]), 1, 1),
        colour = square(new Uint8Array([140, 127, 111, 255]), 1, 1, true);
    return {
        relief,
        colour,
        dispose() {
            relief.dispose();
            colour.dispose();
        },
    };
}

/**
 * Fetches the square. `fine` asks for the larger set, which a touch device
 * has neither the screen nor the memory to use.
 */
export const loadHomeFloor = (fine: boolean, anisotropy: number) =>
    loadFloor(ROOT, fine, anisotropy);

/** The same for any square kept as these four pictures under `root`. */
export async function loadFloor(
    root: string,
    fine: boolean,
    anisotropy: number,
): Promise<HomeFloor> {
    const set = fine ? "" : "half/";
    const picture = async (file: string) => {
        const response = await fetch(root + set + file);
        if (!response.ok)
            throw new Error(`${file} answered ${response.status}`);
        // Measurements, not pictures: no colour conversion.
        return createImageBitmap(await response.blob(), {
            colorSpaceConversion: "none",
            premultiplyAlpha: "none",
        });
    };
    const pictures = await Promise.all(
        ["slope-x.webp", "slope-z.webp", "sun.webp", "colour.webp"].map(
            picture,
        ),
    );
    try {
        const size = pictures[0].width;
        if (
            pictures.some((each) => each.width !== size || each.height !== size)
        )
            throw new Error("the floor's files do not match");
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("no canvas to read the floor with");
        const read = (index: number) => {
            context.drawImage(pictures[index], 0, 0);
            return context.getImageData(0, 0, size, size).data;
        };
        // Three grey pictures become the channels of one texture.
        const shape = new Uint8Array(size * size * 4).fill(255);
        for (let channel = 0; channel < 3; channel++) {
            const grey = read(channel);
            for (let at = channel; at < shape.length; at += 4)
                shape[at] = grey[at - channel];
        }
        const relief = square(shape, size, anisotropy),
            colour = square(new Uint8Array(read(3)), size, anisotropy, true);
        canvas.width = canvas.height = 0;
        return {
            relief,
            colour,
            dispose() {
                relief.dispose();
                colour.dispose();
            },
        };
    } finally {
        pictures.forEach((each) => each.close());
    }
}
