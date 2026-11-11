import * as THREE from "three";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
    OUTPOST_SCALE,
    curveSurfacePoint,
    outpostCamera,
    settlementMayShow,
    surfaceUpright,
} from "../../src/scripts/planetary-outposts";

describe("a settlement laid on its globe", () => {
    const radius = 1 / OUTPOST_SCALE;

    it("lowers a point by the globe's fall beneath it and moves it no other way", () => {
        expect(curveSurfacePoint(new Vector3(0, 3, 0)).toArray()).toEqual([
            0, 3, 0,
        ]);
        const far = curveSurfacePoint(new Vector3(90, 5, -120));
        expect(far.x).toBe(90);
        expect(far.z).toBe(-120);
        expect(far.y).toBeCloseTo(
            5 + Math.sqrt(radius ** 2 - 150 ** 2) - radius,
            6,
        );
        expect(far.y).toBeLessThan(5);
    });

    it("seats a moving part square to the ground under it", () => {
        const up = new Vector3();
        expect(surfaceUpright(new Vector3(0, 0, 0), up).toArray()).toEqual([
            0, 1, 0,
        ]);
        // Rising ground behind, falling ground ahead: the upright leans
        // outward, at right angles to the lowered surface.
        const at = new Vector3(-109, 0, -80);
        surfaceUpright(at, up);
        expect(up.length()).toBeCloseTo(1, 9);
        expect(up.x).toBeLessThan(0);
        expect(up.z).toBeLessThan(0);
        const step = 0.01,
            here = curveSurfacePoint(at.clone()),
            east = curveSurfacePoint(at.clone().add(new Vector3(step, 0, 0))),
            south = curveSurfacePoint(at.clone().add(new Vector3(0, 0, step)));
        expect(east.sub(here).normalize().dot(up)).toBeCloseTo(0, 4);
        expect(south.sub(here).normalize().dot(up)).toBeCloseTo(0, 4);
    });
});

describe("settlement horizon test", () => {
    const reach = 0.25,
        height = 0.08;

    it("keeps a settlement facing the camera", () => {
        expect(settlementMayShow(1, 3.45, reach, height)).toBe(true);
        expect(settlementMayShow(0.4, 3.45, reach, height)).toBe(true);
    });

    it("keeps one on the limb, including its height and footprint", () => {
        const limb = Math.acos(1 / 3.45);
        expect(settlementMayShow(Math.cos(limb), 3.45, 0, 0)).toBe(true);
        // A tall footprint centred slightly beyond the limb can still show.
        expect(
            settlementMayShow(Math.cos(limb + 0.3), 3.45, reach, height),
        ).toBe(true);
    });

    it("hides one behind the globe from the camera", () => {
        expect(settlementMayShow(-1, 3.45, reach, height)).toBe(false);
        expect(settlementMayShow(-0.9, 3.45, reach, height)).toBe(false);
    });

    it("never hides anything from a camera on the surface", () => {
        expect(settlementMayShow(-1, 1, reach, height)).toBe(true);
        expect(settlementMayShow(Number.NaN, 0, reach, height)).toBe(true);
    });

    it("matches an exact line-of-sight check for a single point", () => {
        // A point at radius r hides behind the unit sphere exactly when the
        // segment from the camera passes through it.
        const camera = [3.45, 0, 0];
        for (const [angle, radius] of [
            [1.7, 1.0016],
            [1.9, 1.0016],
            [2.2, 1.05],
            [2.6, 1.05],
        ]) {
            const point = [radius * Math.cos(angle), radius * Math.sin(angle)];
            const d = [point[0] - camera[0], point[1]];
            const length = Math.hypot(d[0], d[1]);
            // Closest approach of the segment to the origin.
            const t = Math.min(
                length,
                Math.max(0, -(camera[0] * d[0]) / length),
            );
            const closest = Math.hypot(
                camera[0] + (d[0] / length) * t,
                (d[1] / length) * t,
            );
            const visible = closest >= 1;
            expect(
                settlementMayShow(Math.cos(angle), camera[0], 0, radius - 1),
            ).toBe(visible);
        }
    });
});

describe.each(["moon", "mars"] as const)("the %s camera tour", (world) => {
    const group = new THREE.Group();
    const at = (second: number) => outpostCamera(THREE, group, world, second);

    it("stays finite and names a place, short enough to caption", () => {
        for (let second = 0; second <= 36; second += 0.25) {
            const view = at(second);
            expect(view.position.toArray().every(Number.isFinite)).toBe(true);
            expect(view.target.toArray().every(Number.isFinite)).toBe(true);
            expect(view.landmark).toMatch(/^[^·]+ · .+$/);
            expect(view.landmark.length).toBeLessThanOrEqual(64);
        }
    });

    it("closes its loop", () => {
        const start = at(0),
            end = at(36);
        expect(end.position.distanceTo(start.position)).toBeLessThan(1e-9);
        expect(end.target.distanceTo(start.target)).toBeLessThan(1e-9);
        expect(end.landmark).toBe(start.landmark);
    });
});
