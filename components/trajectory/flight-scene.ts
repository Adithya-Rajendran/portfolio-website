import { trajectoryCopy as copy } from "@/lib/copy";
import type { Frame } from "@/lib/trajectory";
import type { FlightGL } from "./flight-gl";
import {
    firstMaps,
    flightMaps,
    requestMap,
    type MapImage,
} from "./flight-maps";
import type { Box } from "./flight-route";
import type { CreateScene } from "./journey";
import styles from "./flight.module.css";

/**
 * Option C · Flight: the timeline as a chase-camera flight through a
 * heliocentric 3D scene (flight-route.ts places it, flight-gl.ts draws it
 * with three.js). This part is small and synchronous: it picks the maps
 * for the screen and requests the ones the first frame needs, then
 * imports the renderer and three.js as one lazy chunk, so the page never
 * waits for WebGL and the maps arrive with it; without a WebGL2 context it
 * does neither. Until the scene draws, and
 * without WebGL or while a lost context is away, the poster rendered with
 * the page (trajectory-view.tsx) shows: the canvas goes under it, and it
 * fades out as the canvas fades in.
 */

export const createFlightScene: CreateScene = (host, data, route) => {
    host.classList.add(styles.host);
    const scrim = document.createElement("div");
    scrim.className = styles.scrim;
    const layer = document.createElement("div");
    layer.className = styles.labels;
    host.append(scrim, layer);

    let gl: FlightGL | null = null;
    let disposed = false;
    let size: [number, number, boolean, number?, Box?, number?] | null = null;
    // The record (its column): on a phone nothing is drawn below its top
    // edge; on a wide stage the scene keeps right of its right edge.
    // Measured here, where layout reads belong.
    const recordEdge = (edge: "top" | "right") => {
        const row = host.parentElement?.querySelector("[data-record]");
        if (!row) return undefined;
        const h = host.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        return edge === "top" ? r.top - h.top : r.right - h.left;
    };
    // The figure's caption on a wide stage (the record grid's own
    // paragraph), which no line or label enters.
    const captionBox = (): Box | undefined => {
        const caption = host.parentElement?.querySelector(
            ":scope > div:not([data-scene]) > div > p",
        );
        const r = caption?.getBoundingClientRect();
        if (!r || r.width === 0) return undefined;
        const h = host.getBoundingClientRect();
        return {
            x0: r.left - h.left,
            y0: r.top - h.top,
            x1: r.right - h.left,
            y1: r.bottom - h.top,
        };
    };
    let last: Frame | null = null;
    // The context first: without WebGL2 nothing is fetched and the poster
    // stays. The renderer draws on this canvas (one context per mount).
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
        antialias: true,
        alpha: false,
        stencil: false,
        powerPreference: "default",
    });
    // Phones and narrow windows take the smaller maps (flight-maps.ts).
    const maps = flightMaps(!window.matchMedia("(min-width: 960px)").matches);
    const images = new Map<string, MapImage>();
    if (context) {
        for (const f of firstMaps(maps, data.chapters.length))
            images.set(f, requestMap(f));
        // Void's sky too (Flight Manual never shows it): the first frame
        // waits for it, so its upload never lands mid-scroll.
        if (document.documentElement.dataset.theme !== "manual")
            images.set(maps.sky, requestMap(maps.sky));

        import("./flight-gl")
            .then(({ mountFlight }) => {
                if (disposed) return;
                gl = mountFlight(host, data, route, {
                    context,
                    labels: layer,
                    scrim,
                    classes: {
                        label: styles.label,
                        name: styles.name,
                        now: styles.now,
                        target: styles.target,
                        world: styles.world,
                        leader: styles.leader,
                    },
                    openTo: copy.future,
                    maps,
                    images,
                    ready: () => {
                        host.dataset.ready = "";
                    },
                    lost: () => {
                        delete host.dataset.ready;
                    },
                });
                if (!gl) return;
                if (size) gl.resize(...size);
                if (last) gl.render(last);
            })
            .catch(() => {
                // The chunk failed to load (offline): the poster stays.
            });
    }

    return {
        resize(width, height, wide) {
            const record = wide ? undefined : recordEdge("top");
            const column = wide ? recordEdge("right") : undefined;
            size = [width, height, wide, record, captionBox(), column];
            // The canvas is cut at the record's top edge (see the CSS).
            if (record === undefined) host.style.removeProperty("--record");
            else host.style.setProperty("--record", `${record.toFixed(1)}px`);
            gl?.resize(...size);
        },
        render(frame) {
            last = frame;
            gl?.render(frame);
        },
        theme() {
            gl?.theme();
        },
        dispose() {
            disposed = true;
            // The renderer frees its context; one it never took is let go.
            if (gl) gl.dispose();
            else context?.getExtension("WEBGL_lose_context")?.loseContext();
            gl = null;
            // The decoded maps are let go at once, drawn or not.
            for (const image of images.values())
                image.then((bitmap) => {
                    if (bitmap instanceof ImageBitmap) bitmap.close();
                });
            images.clear();
            scrim.remove();
            layer.remove();
            host.classList.remove(styles.host);
            host.style.removeProperty("--record");
            delete host.dataset.ready;
        },
    };
};
