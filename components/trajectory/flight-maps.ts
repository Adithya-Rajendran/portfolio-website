import type { WorldKind } from "./flight-route";

/**
 * The 3D flight's maps (public/images/trajectory/README.md): which files a
 * screen loads, and the ones its first frame waits for. Its own small
 * module, so the scene can request them at once, beside the renderer's
 * lazy chunk rather than after it, without pulling the flight's geometry
 * into the page's eager code (flight-route.ts re-exports worldKinds).
 */

const DIR = "/images/trajectory/";

/** Earth for the first chapter, Saturn (with its ring) for the last, and
 *  Mars and Jupiter between. */
export function worldKinds(count: number): WorldKind[] {
    const inner: WorldKind[] = ["earth", "mars", "jupiter"];
    return Array.from({ length: count }, (_, i) => {
        if (count > 1 && i === count - 1) return "saturn";
        if (i < 3) return inner[i];
        return (i - 3) % 2 ? "jupiter" : "mars";
    });
}

export interface FlightMaps {
    world: Record<WorldKind, string>;
    ring: string;
    clouds: string;
    night: string;
    /** The night lights of the lands under the sunrise, finer. */
    nightFine: string;
    water: string;
    moon: string;
    sky: string;
}

/** The lands the sunrise looks over (North America to the Caribbean),
 *  which `nightFine` maps: longitudes and latitudes, degrees
 *  (scripts/encode-trajectory-textures.mjs cuts the file to them). */
export const NIGHT_WINDOW = { lon: [-130, -30], lat: [5, 55] } as const;

/** 2k maps and the 4k sky on a wide screen; the 1k maps and the 2k sky on
 *  a phone or a narrow window, where the worlds are drawn small. The night
 *  lights are 2k on both, and the sunrise's lands finer still (3k across
 *  its window on a wide screen, 2k on a phone): the sunrise shows them
 *  large on any screen. */
export function flightMaps(small: boolean): FlightMaps {
    const k = small ? "1k" : "2k";
    return {
        world: {
            earth: `earth-${k}.webp`,
            mars: `mars-${k}.webp`,
            jupiter: `jupiter-${k}.webp`,
            saturn: "saturn-strip-v1.webp",
        },
        ring: "saturn-ring-1k.webp",
        clouds: `earth-clouds-${k}.webp`,
        night: "earth-night-2k.webp",
        nightFine: small
            ? "earth-night-sunrise-2k.webp"
            : "earth-night-sunrise-3k.webp",
        water: "earth-water-1k.webp",
        moon: "moon-1k.webp",
        sky: small ? "milky-way-band-2k.webp" : "milky-way-band-4k.webp",
    };
}

/** The files the first frame waits for with `count` chapters: each
 *  world's map, Saturn's ring, and Earth's layers and its Moon; in Void
 *  the sky too, which the scene adds (Flight Manual never loads it). */
export function firstMaps(maps: FlightMaps, count: number): string[] {
    const kinds = worldKinds(count);
    const files = new Set(kinds.map((k) => maps.world[k]));
    if (kinds.includes("saturn")) files.add(maps.ring);
    if (kinds[0] === "earth")
        for (const f of [
            maps.water,
            maps.night,
            maps.nightFine,
            maps.clouds,
            maps.moon,
        ])
            files.add(f);
    return [...files];
}

/** A map on its way: its pixels, ready to upload, or null if it failed. */
export type MapImage = Promise<ImageBitmap | HTMLImageElement | null>;

/** Whether createImageBitmap honours the options below: three.js's own
 *  test (GLTFLoader: Safari from 17, Firefox from 98). */
function bitmaps(): boolean {
    if (typeof createImageBitmap === "undefined") return false;
    const agent = navigator.userAgent;
    const safari = /^((?!chrome|android).)*safari/i.test(agent)
        ? Number(/Version\/(\d+)/.exec(agent)?.[1] ?? 0)
        : null;
    const firefox = /Firefox\/(\d+)\./.exec(agent);
    if (safari !== null && safari < 17) return false;
    return !firefox || Number(firefox[1]) >= 98;
}

/**
 * Starts a map's download and its decode. The decode runs off the main
 * thread into an ImageBitmap that is uploaded as it is: flipped for the
 * UVs, its colours and alpha untouched (three.js's ImageBitmapLoader
 * options, the same pixels an <img> gave with three's unpack settings).
 * An <img>, which the upload decodes again on the main thread, only where
 * a bitmap cannot be trusted with those options. Fetched at low priority,
 * as an <img> off the page is.
 */
export function requestMap(file: string): MapImage {
    const url = DIR + file;
    if (bitmaps())
        return fetch(url, { priority: "low" })
            .then((response) =>
                response.ok ? response.blob() : Promise.reject(),
            )
            .then((blob) =>
                createImageBitmap(blob, {
                    imageOrientation: "flipY",
                    premultiplyAlpha: "none",
                    colorSpaceConversion: "none",
                }),
            )
            .catch(() => null);
    const image = new Image();
    image.src = url;
    return image.decode().then(
        () => image,
        // A decode can be refused (memory) where the image loaded.
        () => (image.complete && image.naturalWidth > 0 ? image : null),
    );
}
