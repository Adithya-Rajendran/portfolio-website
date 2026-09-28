import { describe, expect, it } from "vitest";
import {
    H_WIDTH,
    decimalYear,
    horizontalMap,
    orbitModel,
    spreadLabels,
    todayYear,
    verticalMap,
    type OrbitEntry,
} from "@/lib/orbit/geometry";

/** The published timeline as of 2026-09-28 (Sanity profile), oldest last. */
const PUBLISHED: OrbitEntry[] = [
    {
        id: "sjsu",
        kind: "education",
        startDate: "2026-08-01",
        isCurrent: true,
        expectedEndYear: 2028,
    },
    {
        id: "canonical",
        kind: "work",
        startDate: "2024-05-01",
        endDate: "2026-07-01",
        isCurrent: false,
    },
    {
        id: "tcr",
        kind: "work",
        startDate: "2023-12-01",
        endDate: "2024-05-01",
    },
    // The UC Santa Cruz placeholder: start equals end.
    {
        id: "ucsc",
        kind: "education",
        startDate: "2023-06-01",
        endDate: "2023-06-01",
    },
];

const TODAY = "2026-09-28";

function model(entries = PUBLISHED, plannedFrom?: string) {
    const result = orbitModel({ entries, today: TODAY, plannedFrom });
    if (!result) throw new Error("no model");
    return result;
}

describe("time axis", () => {
    it("places a date in the middle of its month, or of its year", () => {
        expect(decimalYear("2024-05-01")).toBeCloseTo(2024 + 4.5 / 12);
        expect(decimalYear("2024-05-17", "month")).toBeCloseTo(2024 + 4.5 / 12);
        expect(decimalYear("2019-01-01", "year")).toBe(2019.5);
        expect(decimalYear("2019")).toBe(2019.5);
        expect(decimalYear(null)).toBeNull();
        expect(decimalYear("soon")).toBeNull();
    });

    it("reads today to the day", () => {
        expect(todayYear("2026-01-01")).toBeCloseTo(2026 + 0.5 / 31 / 12);
        expect(todayYear("2026-09-28")).toBeGreaterThan(
            decimalYear("2026-09-01")!,
        );
    });

    it("spans the entries, today and whole-year ticks", () => {
        const m = model();
        expect(m.min).toBeLessThan(m.orbits[0].from);
        expect(m.max).toBeGreaterThan(m.orbits[3].to);
        expect(m.years).toEqual([2023, 2024, 2025, 2026, 2027, 2028]);
    });
});

describe("the published four entries", () => {
    const m = model();

    it("orders them in time and raises each one a level", () => {
        expect(m.orbits.map((orbit) => orbit.id)).toEqual([
            "ucsc",
            "tcr",
            "canonical",
            "sjsu",
        ]);
        expect(m.orbits.map((orbit) => orbit.number)).toEqual([1, 2, 3, 4]);
        expect(m.orbits.map((orbit) => orbit.level)).toEqual([0, 1, 2, 3]);
        expect(m.orbits.every((orbit) => orbit.host === null)).toBe(true);
    });

    it("draws a zero-length entry fading in before its end, not as a point", () => {
        const ucsc = m.orbits[0];
        expect(ucsc.startKnown).toBe(false);
        expect(ucsc.to).toBeCloseTo(decimalYear("2023-06-01")!);
        expect(ucsc.to - ucsc.from).toBeCloseTo(1);
        expect(horizontalMap(m).orbits[0].fade?.dir).toBe("in");
        expect(verticalMap(m).orbits[0].fade?.dir).toBe("in");
    });

    it("runs the current orbit to its expected end, with today on it", () => {
        const sjsu = m.orbits[3];
        expect(sjsu.current).toBe(true);
        expect(sjsu.to).toBe(2028.5);
        expect(sjsu.now).toBeCloseTo(todayYear(TODAY));
        expect(m.orbits.filter((orbit) => orbit.current)).toHaveLength(1);
    });

    it("burns into each next role at its start: a 6-month coast, none, then a 1-month coast", () => {
        expect(
            m.transfers.map((transfer) => [
                transfer.from,
                transfer.to,
                transfer.coastMonths,
            ]),
        ).toEqual([
            ["ucsc", "tcr", 6],
            ["tcr", "canonical", 0],
            ["canonical", "sjsu", 1],
        ]);
        expect(m.transfers[2].arrive).toBeCloseTo(decimalYear("2026-08-01")!);
    });

    it("has no planned orbit without availability", () => {
        expect(m.planned).toBeNull();
    });
});

describe("flybys and the planned orbit", () => {
    it("arcs an internship inside another entry over it, without a level", () => {
        const m = model([
            {
                id: "degree",
                kind: "education",
                startDate: "2019-09-01",
                endDate: "2023-06-01",
            },
            {
                id: "summer",
                kind: "work",
                employment: "internship",
                startDate: "2022-06-01",
                endDate: "2022-08-01",
            },
            { id: "job", kind: "work", startDate: "2023-07-01" },
        ]);
        const summer = m.orbits.find((orbit) => orbit.id === "summer")!;
        expect(summer.host).toBe("degree");
        expect(summer.level).toBe(0);
        expect(m.orbits.find((orbit) => orbit.id === "job")!.level).toBe(1);
        expect(m.transfers).toHaveLength(1);
        expect(m.transfers[0]).toMatchObject({ from: "degree", to: "job" });
        const flyby = horizontalMap(m).orbits.find(
            (shape) => shape.id === "summer",
        )!;
        expect(flyby.flyby).toBe(true);
        expect(flyby.label.place).toBe("above");
    });

    it("keeps an internship that only overlaps as its own orbit", () => {
        const m = model([
            {
                id: "job",
                kind: "work",
                startDate: "2022-01-01",
                endDate: "2022-07-01",
            },
            {
                id: "intern",
                kind: "work",
                employment: "internship",
                startDate: "2022-06-01",
                endDate: "2022-09-01",
            },
        ]);
        expect(m.orbits.map((orbit) => [orbit.id, orbit.host])).toEqual([
            ["job", null],
            ["intern", null],
        ]);
    });

    it("draws the planned orbit one level above, from availability", () => {
        const m = model(PUBLISHED, "2027-06-01");
        expect(m.planned).toMatchObject({ level: 4, after: "sjsu" });
        expect(m.planned!.from).toBeCloseTo(decimalYear("2027-06-01")!);
        const h = horizontalMap(m);
        expect(h.planned?.fade.dir).toBe("out");
        expect(h.planned?.link).toMatch(/^M[\d. ]+L/);
        const v = verticalMap(m);
        expect(v.planned).not.toBeNull();
    });
});

describe("guards", () => {
    it("returns null when nothing can be placed", () => {
        expect(orbitModel({ entries: [], today: TODAY })).toBeNull();
        expect(
            orbitModel({
                entries: [{ id: "x", kind: "work", isCurrent: false }],
                today: TODAY,
            }),
        ).toBeNull();
        expect(
            orbitModel({ entries: PUBLISHED, today: "not a date" }),
        ).toBeNull();
    });

    it("treats a start after the end as unknown", () => {
        const m = model([
            {
                id: "odd",
                kind: "work",
                startDate: "2024-09-01",
                endDate: "2024-03-01",
            },
        ]);
        expect(m.orbits[0].startKnown).toBe(false);
        expect(m.orbits[0].from).toBeLessThan(m.orbits[0].to);
    });

    it("fades out an entry with a start and no end that is not current", () => {
        const m = model([
            {
                id: "open",
                kind: "work",
                startDate: "2024-01-01",
                isCurrent: false,
            },
        ]);
        expect(m.orbits[0].endKnown).toBe(false);
        expect(horizontalMap(m).orbits[0].fade?.dir).toBe("out");
    });
});

describe("projections", () => {
    const m = model();

    it("keeps the horizontal map on a 1000-unit width, inside its padding", () => {
        const h = horizontalMap(m);
        expect(h.width).toBe(H_WIDTH);
        expect(h.axis.x1).toBeGreaterThan(0);
        expect(h.axis.x2).toBeLessThan(H_WIDTH);
        for (const tick of h.ticks) {
            expect(tick.at).toBeGreaterThan(h.axis.x1);
            expect(tick.at).toBeLessThan(h.axis.x2);
        }
        // Each level up is higher on the page; labels hang below.
        const levels = h.orbits.map((shape) => shape.label.y);
        expect([...levels].sort((a, b) => b - a)).toEqual(levels);
        expect(h.orbits.every((shape) => shape.label.place === "below")).toBe(
            true,
        );
    });

    it("puts today on the current orbit, on its flown arc's end", () => {
        for (const map of [horizontalMap(m), verticalMap(m)]) {
            const current = map.orbits[3];
            expect(current.now).not.toBeNull();
            expect(current.flown).toContain(
                `${Math.round(current.now!.x * 10) / 10} ${Math.round(current.now!.y * 10) / 10}`,
            );
            expect(map.orbits.filter((shape) => shape.flown)).toHaveLength(1);
        }
    });

    it("draws the zero-month transfer straight up and marks every burn on the axis", () => {
        const h = horizontalMap(m);
        expect(h.transfers[1].d).toMatch(/^M[\d. ]+L[\d. ]+$/);
        expect(h.transfers[0].d).toContain("C");
        expect(h.transfers.map((transfer) => transfer.coast)).toEqual([
            true,
            false,
            true,
        ]);
        for (const transfer of h.transfers) {
            expect(transfer.burn.y).toBe(h.axis.y1);
        }
    });

    it("runs the vertical map upwards in pixels, labels at least 52px apart", () => {
        const v = verticalMap(m);
        expect(v.axis.y1).toBeGreaterThan(v.axis.y2);
        expect(v.ticks[0].at).toBeGreaterThan(v.ticks[1].at);
        const ys = v.orbits.map((shape) => shape.label.y).sort((a, b) => a - b);
        for (let i = 1; i < ys.length; i += 1) {
            expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(52);
        }
        // The TCR → Canonical transfer has no length on a vertical map.
        expect(v.transfers[1].d).toBeNull();
    });
});

describe("spreadLabels", () => {
    it("keeps order and pushes crowded labels apart within the range", () => {
        expect(spreadLabels([10, 20, 100], 30, 0, 200)).toEqual([10, 40, 100]);
        expect(spreadLabels([100, 20, 10], 30, 0, 200)).toEqual([100, 40, 10]);
        expect(spreadLabels([180, 190, 195], 30, 0, 200)).toEqual([
            140, 170, 200,
        ]);
    });
});
