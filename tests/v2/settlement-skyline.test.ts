import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inSight, readSkyline } from "../../src/scripts/settlement-skyline";

// The module's own limits, in metres (see settlement-skyline.ts).
const OWN = 14,
    LOW = 4,
    CLEAR = 1.5;

const encode = (bytes: number[]) => btoa(String.fromCharCode(...bytes));

/**
 * A grid of 40 squares a side, 2 m each and 80 m across. Each wall fills a
 * whole column: column c spans x = -40 + 2c to -38 + 2c.
 */
function gridWith(walls: Record<number, number>) {
    const cells = 40,
        step = 0.25;
    const bytes = new Array<number>(cells * cells).fill(0);
    for (const [column, height] of Object.entries(walls))
        for (let row = 0; row < cells; row++)
            bytes[row * cells + Number(column)] = Math.round(height / step);
    const skyline = readSkyline({ cells, step, data: encode(bytes) }, 80);
    if (!skyline) throw new Error("grid did not read");
    return skyline;
}

const from = [-35, 2, 0],
    to = [35, 2, 0];

describe("reading a skyline", () => {
    it("refuses data that is not cells squared", () => {
        expect(
            readSkyline({ cells: 4, step: 0.25, data: encode([1, 2, 3]) }, 8),
        ).toBeUndefined();
    });

    it("scales bytes by the step and lays the grid over the metres", () => {
        const data = encode(Array.from({ length: 16 }, (_, i) => i * 4));
        const skyline = readSkyline({ cells: 4, step: 0.25, data }, 512);
        expect(skyline).toBeDefined();
        expect(skyline!.square).toBe(128);
        expect(skyline!.half).toBe(256);
        expect(skyline!.cells).toBe(4);
        expect(Array.from(skyline!.tall)).toEqual(
            Array.from({ length: 16 }, (_, i) => i),
        );
    });
});

describe("sight over a skyline", () => {
    it("sees along an open line", () => {
        expect(inSight(gridWith({}), from, to)).toBe(true);
    });

    it("loses a low target behind a tall wall", () => {
        expect(inSight(gridWith({ 10: 20 }), from, to)).toBe(false);
    });

    it("keeps a target the line clears by more than the clearance", () => {
        // Both ends are at 10 m, so the line is at 10 m over every column.
        const high = [35, 10, 0],
            low = [-35, 10, 0];
        expect(inSight(gridWith({ 10: 10 - CLEAR - 0.25 }), low, high)).toBe(
            true,
        );
        expect(inSight(gridWith({ 10: 10 - CLEAR + 0.25 }), low, high)).toBe(
            false,
        );
    });

    it("ignores hardware within the target's own bulk", () => {
        // Column 37 spans x 34 to 36, within OWN of the target at x 35.
        expect(inSight(gridWith({ 37: 30 }), from, to)).toBe(true);
        // Column 25 spans x 10 to 12, over 14 m short of the target.
        expect(35 - 12).toBeGreaterThan(OWN);
        expect(inSight(gridWith({ 25: 30 }), from, to)).toBe(false);
    });

    it("is not hidden by kerb-height hardware", () => {
        expect(inSight(gridWith({ 10: LOW - 0.25 }), from, to)).toBe(true);
        expect(inSight(gridWith({ 10: LOW }), from, to)).toBe(false);
    });

    it("steps over points outside the grid without throwing", () => {
        const grid = gridWith({});
        expect(() => inSight(grid, [-500, 5, 0], [500, 5, 0])).not.toThrow();
        expect(inSight(grid, [-500, 5, 0], [500, 5, 0])).toBe(true);
        expect(() => inSight(grid, [0, 5, -900], [0, 5, 900])).not.toThrow();
    });
});

describe.each(["moon", "mars"])("the %s site's skyline", (world) => {
    const site = JSON.parse(
        readFileSync(
            new URL(
                `../../public/terrain/${world}-site-v1/site.json`,
                import.meta.url,
            ),
            "utf8",
        ),
    );

    it("is a 128 square grid of quarter-metre steps", () => {
        expect(site.heights.cells).toBe(128);
        expect(site.heights.step).toBe(0.25);
        expect(atob(site.heights.data).length).toBe(128 * 128);
    });

    it("reads, with a tallest structure between 20 and 64 m", () => {
        const skyline = readSkyline(site.heights, site.metres);
        expect(skyline).toBeDefined();
        const tallest = Math.max(...skyline!.tall);
        expect(tallest).toBeGreaterThanOrEqual(20);
        expect(tallest).toBeLessThanOrEqual(64);
    });

    it("holds every landmark inside the grid", () => {
        const skyline = readSkyline(site.heights, site.metres)!;
        expect(site.landmarks.length).toBeGreaterThan(0);
        for (const landmark of site.landmarks) {
            expect(Math.abs(landmark.x)).toBeLessThan(skyline.half);
            expect(Math.abs(landmark.z)).toBeLessThan(skyline.half);
        }
    });
});
