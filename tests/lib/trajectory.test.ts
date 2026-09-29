import { describe, expect, it } from "vitest";
import { cvEntries } from "@/lib/cv";
import { FIXTURE_PROFILE as fixtureProfile } from "@/lib/fixtures";
import {
    buildRoute,
    frameAt,
    missionDate,
    splitTitle,
    trajectoryData,
} from "@/lib/trajectory";

const data = trajectoryData(
    cvEntries(fixtureProfile.timeline).all,
    fixtureProfile.availability,
    "2026-09-29",
);

describe("trajectory", () => {
    it("moves a long parenthetical out of the title only", () => {
        expect(
            splitTitle(
                "Field Software Engineer I (promoted from Associate Field Engineer after the first year)",
            ),
        ).toEqual([
            "Field Software Engineer I",
            "Promoted from Associate Field Engineer after the first year",
        ]);
        expect(splitTitle("M.S. Engineering (Interdisciplinary)")).toEqual([
            "M.S. Engineering (Interdisciplinary)",
            null,
        ]);
    });

    it("flies the timeline oldest first, internships as flybys", () => {
        expect(data.chapters.map((c) => c.orgLabel)).toEqual([
            "UCSC",
            "TCR",
            "Canonical",
            "SJSU",
        ]);
        expect(data.chapters.map((c) => c.flyby)).toEqual([
            false,
            true,
            false,
            false,
        ]);
        expect(data.planned?.lines).toEqual([
            "Summer 2027 internships",
            "Full-time opportunities in 2028",
        ]);
    });

    it("maps progress onto segments that cover 0…1", () => {
        const route = buildRoute(data);
        expect(route.segments[0].p0).toBe(0);
        expect(route.segments.at(-1)!.p1).toBeCloseTo(1);
        expect(route.segments.map((s) => s.kind)).toEqual([
            "coast",
            "transfer",
            "flyby",
            "transfer",
            "coast",
            "transfer",
            "coast",
            "plan",
        ]);
        expect(frameAt(route, 0).card).toBe(0);
        expect(frameAt(route, 1).card).toBe(4);
        expect(route.rest).toHaveLength(5);
    });

    it("prints a year-only start without a month", () => {
        const route = buildRoute(data);
        const f = frameAt(route, 0.01);
        expect(missionDate(f.t, data, f)).toMatch(/^\d{4}$/);
        const g = frameAt(route, route.rest[2]);
        expect(missionDate(g.t, data, g)).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    });
});
