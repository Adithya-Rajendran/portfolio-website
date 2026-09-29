"use client";

import type { TrajectoryData } from "@/lib/trajectory";
import Journey from "./journey";
import { createPlotScene } from "./plot-scene";

/** Option A · Plot: the route as a line-art mission plot. */
export default function TrajectoryView({ data }: { data: TrajectoryData }) {
    const first = data.chapters[0];
    const current = data.chapters.some((chapter) => chapter.current);
    const figure = first
        ? `Fig. 1 · Trajectory, ${first.year}${current ? " – present" : ""} · not to scale`
        : undefined;
    return (
        <Journey data={data} createScene={createPlotScene} figure={figure} />
    );
}
