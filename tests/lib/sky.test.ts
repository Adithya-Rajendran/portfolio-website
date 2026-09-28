import { describe, expect, it } from "vitest";
import {
    clearance,
    driftX,
    mulberry32,
    starCount,
    starLayout,
    starPaths,
} from "@/lib/sky/stars";
import { TRACE_AXIS, TRACE_LOS, carrierTrace } from "@/lib/sky/trace";

describe("the seeded sky", () => {
    it("repeats the same sequence for the same seed", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const first = Array.from({ length: 5 }, () => a());
        expect(Array.from({ length: 5 }, () => b())).toEqual(first);
        expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
        expect(mulberry32(43)()).not.toBe(first[0]);
    });

    it("lays out stars inside the field, mostly faint", () => {
        const stars = starLayout(1990, 240, 1600, 1000);
        expect(stars).toHaveLength(240);
        expect(
            stars.every(({ x, y }) => x >= 0 && x < 1600 && y >= 0 && y < 1000),
        ).toBe(true);
        const count = (mag: number) =>
            stars.filter((star) => star.mag === mag).length;
        expect(count(3)).toBeGreaterThan(count(2));
        expect(count(2)).toBeGreaterThan(count(1));
        expect(count(1)).toBeGreaterThan(0);
        expect(starLayout(1990, 240, 1600, 1000)).toEqual(stars);
    });

    it("draws each magnitude as one path of dots", () => {
        const paths = starPaths([
            { x: 1, y: 2, mag: 1 },
            { x: 3.25, y: 4, mag: 3 },
            { x: 5, y: 6, mag: 3 },
        ]);
        expect(paths).toEqual({
            1: "M1.0 2.0h0",
            2: "",
            3: "M3.3 4.0h0M5.0 6.0h0",
        });
    });
});

describe("the drifting starfield", () => {
    const text = [{ x: 100, y: 100, width: 200, height: 40 }];

    it("keeps stars off text and fades them in around it", () => {
        expect(clearance(150, 120, text, 20)).toBe(0);
        expect(clearance(310, 120, text, 20)).toBeCloseTo(0.5);
        expect(clearance(100, 70, text, 20)).toBe(1);
        expect(clearance(10, 10, [], 20)).toBe(1);
    });

    it("drifts left and wraps around the field", () => {
        expect(driftX(100, 10, 2, 1000)).toBe(80);
        expect(driftX(10, 10, 2, 1000)).toBe(990);
        expect(driftX(10, 1000, 2, 1000)).toBe(10);
        expect(driftX(10, 5, 2, 0)).toBe(10);
    });

    it("scales the number of stars with the field, within bounds", () => {
        expect(starCount(1440, 828)).toBe(213);
        expect(starCount(10, 10)).toBe(40);
        expect(starCount(10000, 10000)).toBe(420);
    });
});

describe("the carrier trace", () => {
    it("runs from the left edge to LOS, then drops to the axis", () => {
        const { signal, grid } = carrierTrace();
        expect(signal.startsWith("M0 30 L4 ")).toBe(true);
        expect(signal.endsWith(` L${TRACE_LOS} ${TRACE_AXIS}`)).toBe(true);
        const ys = [...signal.matchAll(/L(\d+) ([\d.]+)/g)]
            .slice(0, -1)
            .map((match) => Number(match[2]));
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(6);
        expect(Math.max(...ys)).toBeLessThanOrEqual(88);
        expect(grid.match(/M/g)).toHaveLength(21);
    });

    it("is the same on every build", () => {
        expect(carrierTrace()).toEqual(carrierTrace());
        expect(carrierTrace(1).signal).not.toBe(carrierTrace().signal);
    });
});
