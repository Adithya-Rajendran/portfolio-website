import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sunrise from "@/lib/hero-sunrise.json";
import { actNumber, homeActs } from "@/lib/home";

describe("the home acts", () => {
    it("shows every act that has something to show, in order", () => {
        const acts = homeActs({
            now: true,
            missions: 4,
            entries: 3,
            roles: 4,
            profile: true,
        });
        expect(acts).toEqual([
            "now",
            "missions",
            "log",
            "trajectory",
            "crew",
            "comms",
        ]);
        expect(acts.map((act) => actNumber(acts, act))).toEqual([
            "00.1",
            "00.2",
            "00.3",
            "00.4",
            "00.5",
            "00.6",
        ]);
    });

    it("leaves an empty act out and numbers the rest without a gap", () => {
        const acts = homeActs({
            now: false,
            missions: 0,
            entries: 2,
            roles: 0,
            profile: false,
        });
        expect(acts).toEqual(["log", "comms"]);
        expect(actNumber(acts, "comms")).toBe("00.2");
    });
});

describe("the hero photograph", () => {
    it("is credited, and every encode it lists is in public/", () => {
        expect(sunrise.credit).toBe("Photo: NASA / Expedition 72");
        expect(sunrise.source).toBe(
            "https://images.nasa.gov/details/iss072e030246",
        );
        for (const crop of [sunrise.desktop, sunrise.mobile]) {
            const widths = crop.sources.map((source) => source.width);
            expect(widths).toEqual([...widths].sort((a, b) => a - b));
            expect(widths.at(-1)).toBe(crop.width);
            for (const source of crop.sources) {
                for (const file of [source.avif, source.webp]) {
                    expect(file).toMatch(/^\/images\/hero-sunrise-v\d+\//);
                    expect(existsSync(join("public", file))).toBe(true);
                }
            }
            expect(crop.preview).toMatch(/^data:image\/webp;base64,/);
        }
    });

    it("keeps the drawn limb and the sun inside each crop", () => {
        for (const crop of [sunrise.desktop, sunrise.mobile]) {
            const { limb, surface, sun } = crop;
            // The sun sits in the lower half, on the limb.
            expect(sun.x).toBeGreaterThan(0);
            expect(sun.x).toBeLessThan(crop.width);
            expect(sun.y / crop.height).toBeGreaterThan(0.5);
            expect(sun.y).toBeLessThan(crop.height);
            // The top of the atmosphere crosses the frame below the name
            // zone, and the surface lies under it.
            const top = limb.cy - limb.r;
            expect(top / crop.height).toBeGreaterThan(0.55);
            expect(top).toBeLessThan(crop.height);
            expect(surface.cy - surface.r).toBeGreaterThan(top);
        }
    });
});
