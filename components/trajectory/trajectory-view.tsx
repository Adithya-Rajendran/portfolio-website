"use client";

import type { Frame, TrajectoryData } from "@/lib/trajectory";
import Journey, { type CreateScene, type Scene } from "./journey";

/**
 * Option B, the voyage (components/trajectory/voyage-scene.ts): a
 * horizontal flight along time over NASA photographs. The scene's code
 * loads after the page; until it arrives the stage shows the record alone,
 * and the calls it missed (the size, the last frame) are replayed.
 */
const createScene: CreateScene = (host, data, route) => {
    let scene: Scene | null = null;
    let size: [number, number, boolean] | null = null;
    let frame: Frame | null = null;
    let disposed = false;
    import("./voyage-scene")
        .then(({ default: createVoyage }) => {
            if (disposed) return;
            scene = createVoyage(host, data, route);
            if (size) scene.resize(...size);
            if (frame) scene.render(frame);
        })
        .catch(() => {
            // The record stands on its own without the scene.
        });
    return {
        resize(width, height, wide) {
            size = [width, height, wide];
            scene?.resize(width, height, wide);
        },
        render(next) {
            frame = next;
            scene?.render(next);
        },
        theme() {
            scene?.theme?.();
        },
        dispose() {
            disposed = true;
            scene?.dispose();
            scene = null;
        },
    };
};

export default function TrajectoryView({ data }: { data: TrajectoryData }) {
    const first = data.chapters[0];
    const current = data.chapters.some((chapter) => chapter.current);
    const figure = first
        ? `Fig. 1 · Trajectory, ${first.year}${current ? " – present" : ""} · time to scale · Images: NASA`
        : undefined;
    return <Journey data={data} createScene={createScene} figure={figure} />;
}
