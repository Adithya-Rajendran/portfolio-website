import { trajectoryCopy as copy } from "@/lib/copy";
import type { Frame } from "@/lib/trajectory";
import type { FlightGL } from "./flight-gl";
import type { Box } from "./flight-route";
import type { CreateScene } from "./journey";
import styles from "./flight.module.css";

/**
 * Option C · Flight: the timeline as a chase-camera flight through a
 * heliocentric 3D scene (flight-route.ts places it, flight-gl.ts draws it
 * with three.js). This part is small and synchronous: it shows a still
 * poster at once, then imports the renderer and three.js as one lazy
 * chunk, so the page never waits for WebGL. Without WebGL the poster
 * stays.
 */

const POSTER = `<svg class="${styles.hint}" viewBox="-500 -210 1000 420" aria-hidden="true" focusable="false">
<ellipse rx="112" ry="44"/><ellipse rx="176" ry="70"/><ellipse rx="252" ry="100"/><ellipse rx="340" ry="136"/>
<ellipse class="${styles.hintPlan}" rx="450" ry="180"/><circle class="${styles.hintSun}" r="3.5"/></svg>`;

export const createFlightScene: CreateScene = (host, data, route) => {
    host.classList.add(styles.host);
    const poster = document.createElement("div");
    poster.className = styles.poster;
    poster.innerHTML = POSTER;
    const scrim = document.createElement("div");
    scrim.className = styles.scrim;
    const layer = document.createElement("div");
    layer.className = styles.labels;
    host.append(poster, scrim, layer);

    let gl: FlightGL | null = null;
    let disposed = false;
    let size: [number, number, boolean, number?, Box?] | null = null;
    // On a phone nothing is drawn below the record's top edge (its date
    // row's rule), measured here, where layout reads belong.
    const recordTop = () => {
        const row =
            host.parentElement?.querySelector("[data-date]")?.parentElement;
        if (!row) return undefined;
        return (
            row.getBoundingClientRect().top - host.getBoundingClientRect().top
        );
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

    import("./flight-gl")
        .then(({ mountFlight }) => {
            if (disposed) return;
            gl = mountFlight(host, data, route, {
                labels: layer,
                classes: {
                    label: styles.label,
                    name: styles.name,
                    dates: styles.dates,
                    now: styles.now,
                    target: styles.target,
                    world: styles.world,
                    leader: styles.leader,
                },
                openTo: copy.openTo,
                ready: () => {
                    host.dataset.ready = "";
                },
            });
            if (!gl) return;
            if (size) gl.resize(...size);
            if (last) gl.render(last);
        })
        .catch(() => {
            // The chunk failed to load (offline): the poster stays.
        });

    return {
        resize(width, height, wide) {
            const record = wide ? undefined : recordTop();
            size = [width, height, wide, record, captionBox()];
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
            gl?.dispose();
            gl = null;
            poster.remove();
            scrim.remove();
            layer.remove();
            host.classList.remove(styles.host);
            host.style.removeProperty("--record");
            delete host.dataset.ready;
        },
    };
};
