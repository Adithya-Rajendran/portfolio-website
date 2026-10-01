"use client";

import { trajectoryCopy as copy } from "@/lib/copy";
import type { TrajectoryData } from "@/lib/trajectory";
import { OPEN_LENS, OPEN_LIMB, SUN_LIFT } from "./flight-opening";
import { FLIGHT_PACING } from "./flight-pacing";
import { createFlightScene } from "./flight-scene";
import Journey from "./journey";
import styles from "./flight.module.css";

/**
 * The flight, Experience's Timeline view (components/cv/experience-views.tsx):
 * a chase-camera flight through a 3D solar system (flight-scene.ts), paced
 * for its camera moves (FLIGHT_PACING). The figure line says what is not
 * to scale and carries the maps' credit
 * (public/images/trajectory/README.md). `active` and `onEntry` are the
 * journey's (journey.tsx).
 */
export default function TrajectoryView({
    data,
    active,
    onEntry,
}: {
    data: TrajectoryData;
    active?: boolean;
    onEntry?: (href: string) => void;
}) {
    // Each part stays whole and keeps its separator, so a narrow stage
    // breaks the line after a "·", never before one.
    const figure = copy.figure
        .split(" · ")
        .map((part) => part.replaceAll(" ", "\u00a0"))
        .join(" · ");
    return (
        <Journey
            data={data}
            createScene={createFlightScene}
            figure={figure}
            pacing={FLIGHT_PACING}
            poster={POSTER}
            active={active}
            onEntry={onEntry}
        />
    );
}

/** The air over the limb, thinning outward: [height, width, opacity]. */
const AIR_BANDS = [
    [3, 6, 0.9],
    [9, 8, 0.45],
    [18, 12, 0.18],
] as const;

/** The limb where the opening frames it (flight-opening.ts), in
 *  thousandths of the stage's height about the Sun: a dark globe, the air
 *  over it and its rim. */
function Limb({ at }: { at: "wide" | "narrow" }) {
    const { cx, cy, r } = OPEN_LIMB[at];
    return (
        <g className={styles[at]}>
            <circle className={styles.globe} cx={cx} cy={cy} r={r} />
            {AIR_BANDS.map(([up, width, opacity]) => (
                <circle
                    key={up}
                    className={styles.air}
                    cx={cx}
                    cy={cy}
                    r={r + up}
                    stroke="url(#flight-poster-air)"
                    strokeWidth={width}
                    strokeOpacity={opacity}
                />
            ))}
            <circle
                className={styles.rim}
                cx={cx}
                cy={cy}
                r={r}
                stroke="url(#flight-poster-air)"
            />
        </g>
    );
}

/** A glow about the Sun: a radial gradient of [offset, colour, opacity]
 *  stops, in the poster's units. */
function Glow({
    id,
    r,
    stops,
}: {
    id: string;
    r: number;
    stops: [number, string, number][];
}) {
    return (
        <radialGradient
            id={id}
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r={r}
        >
            {stops.map(([offset, color, opacity]) => (
                <stop
                    key={offset}
                    offset={offset}
                    stopColor={color}
                    stopOpacity={opacity}
                />
            ))}
        </radialGradient>
    );
}

/** The Sun's corona over the limb: warm white, never orange. */
const CORONA: [number, string, number][] = [
    [0, "#fff6ea", 1],
    [0.08, "#fff2e4", 0.7],
    [0.3, "#ffefe0", 0.2],
    [0.65, "#ffeede", 0.04],
    [1, "#ffeede", 0],
];
/** The air along the limb, brightest under the Sun. */
const AIR: [number, string, number][] = [
    [0, "#f4f7ff", 1],
    [0.15, "#c2d4ff", 0.75],
    [0.5, "#7a9cf0", 0.3],
    [1, "#5a80e0", 0],
];

/** The printed ☉'s sixteen ray ticks, as the scene's Sun draws them. */
const RAYS = Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8);

/**
 * The stage's still frame, rendered with the page, until the scene draws
 * (and while a lost WebGL context is away): the opening shot's sunrise
 * over Earth's limb, so the scene's arrival sharpens it rather than
 * cutting to it. Void: the Sun's glow over a dark globe and its air;
 * Flight Manual: the limb in ink under the printed ☉. A still flight
 * (reduced motion) opens on the map, so its poster is a hint of orbits.
 */
const POSTER = (
    <div
        className={styles.poster}
        data-poster
        style={
            {
                "--wx": `${OPEN_LENS.wide.x * 100}%`,
                "--wy": `${OPEN_LENS.wide.y * 100}%`,
                "--nx": `${OPEN_LENS.narrow.x * 100}%`,
                "--ny": `${OPEN_LENS.narrow.y * 100}%`,
                "--lift": `${SUN_LIFT}px`,
            } as React.CSSProperties
        }
    >
        <div className={styles.opening}>
            <svg
                className={styles.sunrise}
                viewBox="-2000 -500 3000 1500"
                focusable="false"
            >
                <defs>
                    <Glow id="flight-poster-corona" r={380} stops={CORONA} />
                    <Glow id="flight-poster-air" r={1150} stops={AIR} />
                </defs>
                <circle
                    className={styles.corona}
                    r="380"
                    fill="url(#flight-poster-corona)"
                />
                <Limb at="wide" />
                <Limb at="narrow" />
            </svg>
            <svg
                className={styles.sunMark}
                viewBox="-20 -20 40 40"
                focusable="false"
            >
                <circle r="9" />
                <circle className={styles.sunDot} r="1.1" />
                {RAYS.map((a) => (
                    <line
                        key={a}
                        x1={(13.5 * Math.cos(a)).toFixed(2)}
                        y1={(13.5 * Math.sin(a)).toFixed(2)}
                        x2={(18 * Math.cos(a)).toFixed(2)}
                        y2={(18 * Math.sin(a)).toFixed(2)}
                    />
                ))}
            </svg>
        </div>
        <svg
            className={styles.hint}
            viewBox="-500 -210 1000 420"
            focusable="false"
        >
            <ellipse rx="112" ry="44" />
            <ellipse rx="176" ry="70" />
            <ellipse rx="252" ry="100" />
            <ellipse rx="340" ry="136" />
            <ellipse className={styles.hintPlan} rx="450" ry="180" />
            <circle className={styles.hintSun} r="3.5" />
        </svg>
    </div>
);
