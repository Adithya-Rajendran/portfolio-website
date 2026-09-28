import { describe, expect, it } from "vitest";
import { formatMet } from "@/lib/clock";

describe("mission elapsed time", () => {
    it("counts years, months and days from an exact launch", () => {
        expect(formatMet({ date: "2019-01-01" }, "2026-09-28")).toEqual({
            short: "MET 7Y 08M 27D",
            long: "Mission elapsed time: 7 years, 8 months, 27 days since launch on 1 January 2019",
        });
    });

    it("borrows days from the previous month", () => {
        expect(formatMet({ date: "2020-01-31" }, "2020-03-01")?.short).toBe(
            "MET 0Y 01M 01D",
        );
        expect(formatMet({ date: "2019-09-28" }, "2026-09-28")?.long).toBe(
            "Mission elapsed time: 7 years, 0 months, 0 days since launch on 28 September 2019",
        );
    });

    it("never prints a day for a month-precision launch", () => {
        expect(
            formatMet({ date: "2019-09-01", precision: "month" }, "2026-08-31"),
        ).toEqual({
            short: "MET 6Y 11M",
            long: "Mission elapsed time: 6 years, 11 months since launch in September 2019",
        });
    });

    it("gives approximate whole years for a year-only launch", () => {
        expect(
            formatMet({ date: "2019-01-01", precision: "year" }, "2026-09-28"),
        ).toEqual({
            short: "MET c. 7Y",
            long: "Mission elapsed time: about 7 years since launch in 2019",
        });
        expect(
            formatMet({ date: "2026-01-01", precision: "year" }, "2026-09-28")
                ?.long,
        ).toBe("Mission elapsed time: about 0 years since launch in 2026");
    });

    it("says nothing without a launch, or for one in the future", () => {
        expect(formatMet(null, "2026-09-28")).toBeNull();
        expect(formatMet({ date: "" }, "2026-09-28")).toBeNull();
        expect(formatMet({ date: "2027-01-01" }, "2026-09-28")).toBeNull();
        expect(
            formatMet({ date: "2027-01-01", precision: "year" }, "2026-09-28"),
        ).toBeNull();
    });
});
