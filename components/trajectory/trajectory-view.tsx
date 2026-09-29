"use client";

import { trajectoryCopy as copy } from "@/lib/copy";
import type { TrajectoryData } from "@/lib/trajectory";
import { createFlightScene } from "./flight-scene";
import Journey from "./journey";

/**
 * The renderer for /resume/trajectory, option C · Flight: a chase-camera
 * flight through a 3D solar system (flight-scene.ts). The figure line
 * carries the textures' credit (public/images/trajectory/README.md).
 */
export default function TrajectoryView({ data }: { data: TrajectoryData }) {
    const first = data.chapters[0];
    const last = data.chapters.at(-1);
    const span = data.chapters.some((c) => c.current)
        ? `${first?.year} – present`
        : last && last.year !== first?.year
          ? `${first?.year}–${Math.floor(last.end)}`
          : first?.year;
    const figure = [
        "Fig. 1",
        span ? `${copy.tag}, ${span}` : copy.tag,
        "not to scale",
        "Textures: Solar System Scope, CC BY 4.0",
    ].join(" · ");
    return (
        <Journey data={data} createScene={createFlightScene} figure={figure} />
    );
}
