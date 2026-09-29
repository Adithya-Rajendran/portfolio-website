"use client";

import type { TrajectoryData } from "@/lib/trajectory";
import Journey, { type CreateScene } from "./journey";

/**
 * The renderer for /resume/trajectory. The base draws no scene: each
 * option branch (plot, voyage, flight) replaces this file with its own.
 */
const createScene: CreateScene = () => ({
    resize() {},
    render() {},
    dispose() {},
});

export default function TrajectoryView({ data }: { data: TrajectoryData }) {
    return <Journey data={data} createScene={createScene} />;
}
