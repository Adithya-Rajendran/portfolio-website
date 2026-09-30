"use client";

import { useEffect, useRef } from "react";
import {
    clearance,
    DRIFT_SPEED,
    driftX,
    starCount,
    starLayout,
    type Clearing,
    type Magnitude,
    type Star,
} from "@/lib/sky/stars";
import styles from "./starfield.module.css";

const SEED = 72;
const FRAME_MS = 1000 / 30;
const DPR_CAP = 1.5;
/** Stars fade out this many pixels before a text block. */
const PAD = 28;
const REDUCE = "(prefers-reduced-motion: reduce)";
const LOOK: Record<Magnitude, { r: number; alpha: number }> = {
    1: { r: 1.15, alpha: 0.9 },
    2: { r: 0.8, alpha: 0.6 },
    3: { r: 0.55, alpha: 0.38 },
};

/**
 * The home hero's drifting starfield (plan §2.5.2; the site's only ambient
 * motion). A seeded canvas over the server's static star layer
 * (components/sky/static-stars.tsx), which it hides once it has drawn
 * (Void only; Flight Manual draws no stars).
 * It draws at about 30 fps, with the device pixel ratio capped at 1.5,
 * and only while its zone (`[data-drift-zone]`) is on screen, the tab is
 * visible, the theme is Void and motion is allowed (`html[data-motion=
 * "full"]`, no OS reduce-motion setting): otherwise it holds a still
 * frame. Stars fade out around the zone's text (`[data-clear]`), measured
 * again on resize and once the fonts have loaded. `data-state` reports
 * `running` or `stopped` for tests. Cache Components hides a visited page
 * instead of unmounting it, so the effect's cleanup stops the loop.
 */
export default function Starfield({ className }: { className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const zone = canvas?.closest<HTMLElement>("[data-drift-zone]");
        const context = canvas?.getContext("2d");
        if (!canvas || !zone || !context) return;
        const root = document.documentElement;
        const reduce = window.matchMedia(REDUCE);

        let width = 0;
        let height = 0;
        let ratio = 1;
        let stars: Star[] = [];
        let clearings: Clearing[] = [];
        let colour = "236 232 223";
        let onScreen = true;
        let frame = 0;
        let last = 0;
        let seconds = 0;
        let cancelled = false;

        const running = () =>
            onScreen &&
            document.visibilityState === "visible" &&
            root.dataset.theme !== "manual" &&
            root.dataset.motion === "full" &&
            !reduce.matches;

        function measure() {
            const box = canvas!.getBoundingClientRect();
            width = box.width;
            height = box.height;
            ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
            canvas!.width = Math.max(1, Math.round(width * ratio));
            canvas!.height = Math.max(1, Math.round(height * ratio));
            stars = starLayout(SEED, starCount(width, height), width, height);
            clearings = [
                ...zone!.querySelectorAll<HTMLElement>("[data-clear]"),
            ].flatMap((element) => {
                const rect = element.getBoundingClientRect();
                if (!rect.width || !rect.height) return [];
                return [
                    {
                        x: rect.left - box.left,
                        y: rect.top - box.top,
                        width: rect.width,
                        height: rect.height,
                    },
                ];
            });
            colour =
                getComputedStyle(canvas!)
                    .getPropertyValue("--star-rgb")
                    .trim() || colour;
        }

        function draw() {
            if (!width || !height) return;
            context!.setTransform(ratio, 0, 0, ratio, 0, 0);
            context!.clearRect(0, 0, width, height);
            for (const star of stars) {
                const x = driftX(star.x, seconds, DRIFT_SPEED[star.mag], width);
                const look = LOOK[star.mag];
                const alpha = clearance(x, star.y, clearings, PAD) * look.alpha;
                if (alpha < 0.02) continue;
                context!.fillStyle = `rgb(${colour} / ${alpha.toFixed(3)})`;
                context!.beginPath();
                context!.arc(x, star.y, look.r, 0, Math.PI * 2);
                context!.fill();
            }
            canvas!.dataset.drawn = "";
        }

        function tick(now: number) {
            frame = 0;
            if (!running()) {
                stop();
                return;
            }
            const elapsed = now - last;
            if (elapsed >= FRAME_MS) {
                // A long gap (a background tab) is not a jump.
                seconds += Math.min(elapsed, 200) / 1000;
                last = now;
                draw();
            }
            frame = requestAnimationFrame(tick);
        }

        function stop() {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            canvas!.dataset.state = "stopped";
        }

        function update() {
            if (running()) {
                if (frame) return;
                last = performance.now();
                canvas!.dataset.state = "running";
                frame = requestAnimationFrame(tick);
            } else {
                stop();
            }
        }

        function refresh() {
            measure();
            draw();
            update();
        }

        refresh();
        document.fonts?.ready.then(() => {
            if (!cancelled) refresh();
        });

        const resize = new ResizeObserver(() => refresh());
        resize.observe(zone);
        const visible = new IntersectionObserver(([entry]) => {
            onScreen = entry?.isIntersecting ?? true;
            update();
        });
        visible.observe(zone);
        // The theme and motion controls change these attributes (and a
        // theme switch may apply them after a view transition starts).
        const prefs = new MutationObserver(() => refresh());
        prefs.observe(root, {
            attributes: true,
            attributeFilter: ["data-theme", "data-motion"],
        });
        document.addEventListener("visibilitychange", update);
        reduce.addEventListener("change", update);

        return () => {
            cancelled = true;
            stop();
            resize.disconnect();
            visible.disconnect();
            prefs.disconnect();
            document.removeEventListener("visibilitychange", update);
            reduce.removeEventListener("change", update);
        };
    }, []);

    return (
        <canvas
            ref={ref}
            className={
                className ? `${styles.canvas} ${className}` : styles.canvas
            }
            aria-hidden="true"
            data-starfield
            data-print="hide"
        />
    );
}
