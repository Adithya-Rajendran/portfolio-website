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
    water: string;
    moon: string;
    sky: string;
}

/** 2k maps and the 4k sky on a wide screen; the 1k maps and the 2k sky on
 *  a phone or a narrow window, where the worlds are drawn small. The night
 *  lights are 2k on both: the sunrise shows them large on any screen. */
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
        water: "earth-water-1k.webp",
        moon: "moon-1k.webp",
        sky: small ? "milky-way-band-2k.webp" : "milky-way-band-4k.webp",
    };
}

/** The files the first frame waits for with `count` chapters: each
 *  world's map, Saturn's ring, and Earth's layers and its Moon. The sky
 *  follows (Void only). */
export function firstMaps(maps: FlightMaps, count: number): string[] {
    const kinds = worldKinds(count);
    const files = new Set(kinds.map((k) => maps.world[k]));
    if (kinds.includes("saturn")) files.add(maps.ring);
    if (kinds[0] === "earth")
        for (const f of [maps.water, maps.night, maps.clouds, maps.moon])
            files.add(f);
    return [...files];
}

/** Starts a map's download (its decode waits for `image.decode()`). */
export function requestMap(file: string): HTMLImageElement {
    const image = new Image();
    image.src = DIR + file;
    return image;
}
