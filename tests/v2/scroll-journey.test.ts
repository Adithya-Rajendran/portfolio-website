import { describe, expect, it } from "vitest";
import {
    createScrollJourney,
    experienceWorld,
} from "../../src/lib/scroll-journey";

const knots = [0, 1000, 2000, 3000, 4000];
const viewport = 800;

describe("scroll journey reading regions", () => {
    it("keeps Moon selected throughout a broad reading region", () => {
        const journey = createScrollJourney();
        expect(journey.update(700, knots, viewport)).toBe(1);
        for (const position of [800, 1000, 1200, 1400]) {
            expect(journey.update(position, knots, viewport)).toBe(1);
        }
        expect(journey.current).toBe(1);
    });

    it("advances naturally with wheel-sized increments and resists boundary jitter", () => {
        const journey = createScrollJourney();
        for (let y = 0; y <= 550; y += 50)
            expect(journey.update(y, knots, viewport)).toBe(0);
        expect(journey.update(600, knots, viewport)).toBe(1);
        for (const y of [570, 520, 490, 460, 520])
            expect(journey.update(y, knots, viewport)).toBe(1);
        expect(journey.update(400, knots, viewport)).toBe(0);
    });

    it("handles rapid forward and reverse skips without getting stuck", () => {
        const journey = createScrollJourney();
        expect(journey.update(3900, knots, viewport)).toBe(4);
        expect(journey.update(1100, knots, viewport)).toBe(1);
        expect(journey.update(0, knots, viewport)).toBe(0);
    });

    it("keeps short uneven chapters reachable in a tall viewport", () => {
        const journey = createScrollJourney();
        const shortStops = [0, 100, 160, 400];
        expect(journey.update(100, shortStops, 1800)).toBe(1);
        expect(journey.update(160, shortStops, 1800)).toBe(2);
        expect(journey.update(400, shortStops, 1800)).toBe(3);
        expect(journey.update(100, shortStops, 1800)).toBe(1);
    });

    it("uses explicit selection as the hysteresis starting point", () => {
        const journey = createScrollJourney();
        journey.select(1);
        expect(journey.current).toBe(1);
        expect(journey.update(520, knots, viewport)).toBe(1);
        expect(journey.update(390, knots, viewport)).toBe(0);
        journey.select(3);
        expect(journey.current).toBe(3);
        expect(journey.update(3200, knots, viewport)).toBe(3);
    });
});

describe("experience organization mapping", () => {
    it.each([
        [{ organization: "San José State University" }, "earth"],
        [{ organization: "University", orgShort: "SJSU" }, "earth"],
        [{ organization: "Canonical Ltd (Ubuntu)" }, "moon"],
        [{ organization: "Technical Consulting & Research, Inc." }, "mars"],
        [{ organization: "Other", orgShort: "TCR" }, "mars"],
        [{ organization: "University of California, Santa Cruz" }, "jupiter"],
        [
            {
                organization: "Universidad de California, Santa Cruz",
                orgShort: "UCSC",
            },
            "jupiter",
        ],
        [{ organization: "Unrelated Laboratory" }, undefined],
    ])("maps %o to %s", (entry, expected) => {
        expect(experienceWorld(entry)).toBe(expected);
    });
});
