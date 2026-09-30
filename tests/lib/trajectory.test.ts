import { describe, expect, it } from "vitest";
import { FLIGHT_PACING } from "@/components/trajectory/flight-route";
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

    it("paces a renderer's route by its options, and every other by default", () => {
        const route = buildRoute(data);
        expect(buildRoute(data, {})).toEqual(route);
        expect(
            buildRoute(data, {
                transfer: 0.65,
                plan: 1.3,
                open: 0,
                restFirst: 0,
            }),
        ).toEqual(route);

        // The 3D flight: room for its opening, longer transfers and
        // finale, within 600svh.
        const flight = buildRoute(data, FLIGHT_PACING.route);
        const weights = (kind: string) =>
            flight.segments.filter((s) => s.kind === kind).map((s) => s.w);
        expect(weights("transfer")).toEqual([0.95, 0.95, 0.95]);
        expect(weights("plan")).toEqual([1.8]);
        expect(flight.segments[0].w).toBeCloseTo(route.segments[0].w + 0.35);
        expect(100 + flight.weight * 52).toBeLessThanOrEqual(600);
        expect(flight.segments.map((s) => s.kind)).toEqual(
            route.segments.map((s) => s.kind),
        );
        expect(flight.segments.at(-1)!.p1).toBeCloseTo(1);
        // Every card still settles on its own chapter.
        flight.rest.forEach((p, card) =>
            expect(frameAt(flight, p).card).toBe(card),
        );

        // An opening move and a first card that settles into its chapter.
        const opened = buildRoute(data, { open: 0.35, restFirst: 0.6 });
        expect(opened.segments[0].w).toBeCloseTo(route.segments[0].w + 0.35);
        const first = opened.segments[0];
        expect(opened.rest[0]).toBeCloseTo(
            first.p0 + (first.p1 - first.p0) * 0.6,
        );
        expect(frameAt(opened, opened.rest[0]).card).toBe(0);
    });

    it("prints a year-only start without a month", () => {
        const route = buildRoute(data);
        const f = frameAt(route, 0.01);
        expect(missionDate(f.t, data, f)).toMatch(/^\d{4}$/);
        const g = frameAt(route, route.rest[2]);
        expect(missionDate(g.t, data, g)).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    });

    it("never prints a month between a year-only end and the next start", () => {
        const route = buildRoute(data);
        const ucsc = data.chapters[0];
        expect(ucsc.endYearOnly).toBe(true);
        expect(data.chapters[1].endYearOnly).toBe(false);
        // The transfer out of UC Santa Cruz (2019–2023) into TCR (Dec 2023).
        const transfer = route.segments[1];
        expect(transfer.kind).toBe("transfer");
        for (let k = 0; k <= 20; k++) {
            const p = transfer.p0 + ((transfer.p1 - transfer.p0) * k) / 20;
            const f = frameAt(route, p);
            if (f.segment !== transfer) continue;
            expect(missionDate(f.t, data, f)).toBe("2023");
        }
        const arrived = frameAt(route, route.rest[1]);
        expect(missionDate(arrived.t, data, arrived)).toMatch(/ 202[34]$/);
        // Across the whole route, a month is printed only where the record
        // holds one: never in 2019–2023 (UCSC's years).
        for (let k = 0; k <= 400; k++) {
            const f = frameAt(route, k / 400);
            const printed = missionDate(f.t, data, f);
            if (/^[A-Z]/.test(printed))
                expect(printed).not.toMatch(/ (2019|2020|2021|2022)$/);
            if (/ 2023$/.test(printed)) expect(printed).toBe("Dec 2023");
        }
    });

    it("holds a month-dated start's chapter to the year in a year-only end's year", () => {
        const one = trajectoryData(
            cvEntries([
                {
                    _key: "a",
                    _type: "timelineEntry",
                    kind: "work",
                    title: "Engineer",
                    organization: "Example Org",
                    startDate: "2020-09-01",
                    endDate: "2022-01-01",
                    endPrecision: "year",
                },
            ] as never).all,
            null,
            "2026-09-29",
        );
        const route = buildRoute(one);
        const late = frameAt(route, 0.99);
        expect(missionDate(late.t, one, late)).toBe("2022");
        const early = frameAt(route, 0.05);
        expect(missionDate(early.t, one, early)).toMatch(
            /^[A-Z][a-z]{2} 2020$/,
        );
    });

    it("flies an entry whose start is a placeholder, and never dates it", () => {
        // The live record's shape: no short names or employment, and the
        // degree's start stored equal to its end.
        const live = trajectoryData(
            cvEntries([
                {
                    _key: "ms",
                    _type: "timelineEntry",
                    kind: "education",
                    title: "MS Engineering (Interdisciplinary)",
                    organization: "San José State University",
                    isCurrent: true,
                    startDate: "2026-08-01",
                },
                {
                    _key: "intern",
                    _type: "timelineEntry",
                    kind: "work",
                    title: "Cybersecurity Analyst Intern",
                    organization: "Technical Consulting & Research, Inc. (TCR)",
                    startDate: "2023-12-01",
                    endDate: "2024-05-01",
                },
                {
                    _key: "bs",
                    _type: "timelineEntry",
                    kind: "education",
                    title: "Bachelor of Science, Computer Science",
                    organization: "University of California, Santa Cruz",
                    startDate: "2023-06-01",
                    endDate: "2023-06-01",
                },
            ] as never).all,
            null,
            "2026-09-29",
        );
        expect(live.chapters.map((c) => c.id)).toEqual(["bs", "intern", "ms"]);
        const [bs, intern] = live.chapters;
        expect(bs.startKnown).toBe(false);
        expect(bs.year).toBe("2023");
        expect(intern.flyby).toBe(true);
        const route = buildRoute(live);
        for (const p of [0, 0.05, route.rest[0]]) {
            const f = frameAt(route, p);
            expect(missionDate(f.t, live, f)).toBe("Jun 2023");
        }
    });
});
