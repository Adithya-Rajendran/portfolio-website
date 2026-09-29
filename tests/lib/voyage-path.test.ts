import { describe, expect, it } from "vitest";
import { cvEntries } from "@/lib/cv";
import { FIXTURE_PROFILE as fixtureProfile } from "@/lib/fixtures";
import { buildRoute, frameAt, trajectoryData } from "@/lib/trajectory";
import {
    buildGeometry,
    cameraAt,
    planTicks,
    shipOn,
} from "@/components/trajectory/voyage-path";

const data = trajectoryData(
    cvEntries(fixtureProfile.timeline).all,
    fixtureProfile.availability,
    "2026-09-29",
);
const route = buildRoute(data);
const geometry = buildGeometry(data, route, { unit: 720, ppy: 420 }, 2.2);
const X = (t: number) => (t - geometry.t0) * geometry.ppy;

describe("voyage path", () => {
    it("reads the plan's dates from the Open To lines", () => {
        expect(planTicks(data)).toEqual([
            { label: "Summer 2027", t: 2027.5 },
            { label: "2028", t: 2028 },
        ]);
        expect(geometry.planned?.s).toBe(2028);
        expect(geometry.t1).toBe(2028.5);
    });

    it("flies one unbroken curve, on the axis at every coast's joints", () => {
        route.segments.forEach((segment, i) => {
            if (segment.kind === "plan") return;
            const next = route.segments[i + 1];
            if (next && next.kind !== "plan") {
                const a = shipOn(geometry, segment, 1, i);
                const b = shipOn(geometry, next, 0, i + 1);
                expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-6);
            }
            if (segment.kind === "coast") {
                expect(shipOn(geometry, segment, 0, i).x).toBeCloseTo(
                    X(segment.t0),
                );
                expect(shipOn(geometry, segment, 1, i).x).toBeCloseTo(
                    X(segment.t1),
                );
            }
        });
    });

    it("moves the camera without jumps as the page scrolls", () => {
        let last = cameraAt(geometry, route, frameAt(route, 0), 60, 3000);
        for (let k = 1; k <= 2000; k++) {
            const cam = cameraAt(
                geometry,
                route,
                frameAt(route, k / 2000),
                60,
                3000,
            );
            expect(Math.abs(cam.x - last.x)).toBeLessThan(40);
            expect(Math.abs(cam.y - last.y)).toBeLessThan(10);
            last = cam;
        }
    });

    it("draws the current chapter as the accent leg", () => {
        expect(geometry.current).toBe(
            data.chapters.findIndex((c) => c.current),
        );
    });
});
