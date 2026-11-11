import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SETTLEMENTS } from "../../src/scripts/settlement-places";

const worlds = ["moon", "mars"] as const;

describe.each(worlds)("what stands in the %s settlement", (world) => {
    const settlement = SETTLEMENTS[world];
    const keys = settlement.places.flatMap((place) => place.at);

    it("says what each structure is for, in a sentence", () => {
        expect(settlement.plan).toMatch(/\.$/);
        for (const place of settlement.places) {
            // The name hangs over the structure in the picture.
            expect(place.name.length, place.name).toBeLessThanOrEqual(18);
            expect(place.at.length, place.name).toBeGreaterThan(0);
            expect(place.job, place.name).toMatch(/^[A-Z].{18,200}\.$/);
            if (place.after)
                expect(place.after, place.name).toMatch(/^[A-Z0-9].{8,260}\.$/);
        }
    });

    it("names no landmark twice", () => {
        expect(new Set(keys).size).toBe(keys.length);
        const names = settlement.places.map((place) => place.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it.each(["", "half/"])(
        "knows every landmark in the %ssite description",
        (detail) => {
            const site = JSON.parse(
                readFileSync(
                    `public/terrain/${world}-site-v1/${detail}site.json`,
                    "utf8",
                ),
            ) as {
                landmarks: { name: string; x: number; y: number; z: number }[];
            };
            // Most of what the page lists can be found in the picture.
            expect(site.landmarks.length).toBeGreaterThanOrEqual(14);
            for (const mark of site.landmarks) {
                expect(keys, mark.name).toContain(mark.name);
                // Inside the settlement, and above its ground.
                expect(Math.hypot(mark.x, mark.z), mark.name).toBeLessThan(200);
                expect(mark.y, mark.name).toBeGreaterThan(0);
                expect(mark.y, mark.name).toBeLessThan(60);
            }
        },
    );
});
