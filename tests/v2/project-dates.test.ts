import { describe, expect, it } from "vitest";
import { formatProjectDates } from "../../lib/project-content";

describe("project date precision", () => {
    it("does not present placeholder January dates as exact dates", () => {
        expect(
            formatProjectDates({
                startDate: "2026-01-01",
                endDate: "2026-01-01",
                datePrecision: "year",
                status: "completed",
            }),
        ).toBe("2026");
    });
    it("shows known months and an ongoing project without inventing an end date", () => {
        expect(
            formatProjectDates({
                startDate: "2026-09-08",
                datePrecision: "month",
                status: "active",
            }),
        ).toBe("Sep 2026 – present");
    });
    it("preserves approximate ranges and does not call completed work ongoing", () => {
        expect(
            formatProjectDates({
                startDate: "2025-01-01",
                endDate: "2026-01-01",
                datePrecision: "year",
                datesApproximate: true,
                status: "completed",
            }),
        ).toBe("c. 2025 – 2026");
        expect(
            formatProjectDates({
                startDate: "2026-09-08",
                status: "completed",
            }),
        ).toBe("Sep 2026");
        expect(formatProjectDates({ status: "active" })).toBeNull();
    });
});
