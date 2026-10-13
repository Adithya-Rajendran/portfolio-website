import { mulberry32 } from "@/lib/sky/stars";

/**
 * The Loss of Signal page's strip-chart carrier trace, which
 * weakens and drops to the axis at LOS (ported from the mockup's
 * writing.js `traceSVG`). Drawn in a 1000 × 100 box, seeded so it is the
 * same on every build.
 */

export const TRACE_WIDTH = 1000;
export const TRACE_HEIGHT = 100;
/** The x where the signal is lost. */
export const TRACE_LOS = 684;
/** The axis the dead carrier lies on. */
export const TRACE_AXIS = 92;

interface CarrierTrace {
    /** The live signal, from x = 0 to the drop at LOS. */
    signal: string;
    /** The vertical grid, every 50 units. */
    grid: string;
}

export function carrierTrace(seed = 404): CarrierTrace {
    const random = mulberry32(seed);
    let signal = "M0 30";
    let drift = 0;
    for (let x = 4; x < TRACE_LOS; x += 4) {
        drift += (random() - 0.5) * 2.2;
        drift *= 0.92;
        // The signal weakens before it goes.
        const fade = x > 560 ? (x - 560) / (TRACE_LOS - 560) : 0;
        const y =
            30 +
            drift * 3 +
            (random() - 0.5) * (9 + 10 * fade) +
            fade * fade * 34;
        signal += ` L${x} ${Math.max(6, Math.min(88, y)).toFixed(1)}`;
    }
    signal += ` L${TRACE_LOS} ${TRACE_AXIS}`;
    let grid = "";
    for (let x = 0; x <= TRACE_WIDTH; x += 50) grid += `M${x} 4V${TRACE_AXIS}`;
    return { signal, grid };
}
