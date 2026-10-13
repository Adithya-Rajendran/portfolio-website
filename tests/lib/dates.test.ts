import { describe, expect, it } from "vitest";
import { dateOnly, MONTHS, monthYear } from "@/lib/dates";
import { formatEntryDate } from "@/lib/log-index";
import { formatTimelineDate } from "@/lib/profile-content";

describe("dateOnly", () => {
    it("keeps the day a date or a datetime starts with", () => {
        expect(dateOnly("2026-03-30")).toBe("2026-03-30");
        expect(dateOnly("2026-03-30T09:15:00Z")).toBe("2026-03-30");
    });

    it("is null for anything else", () => {
        expect(dateOnly(null)).toBeNull();
        expect(dateOnly(undefined)).toBeNull();
        expect(dateOnly("")).toBeNull();
        expect(dateOnly("2026-03")).toBeNull();
        expect(dateOnly("30 Mar 2026")).toBeNull();
    });
});

describe("monthYear", () => {
    it("words a month counted from 1, as every date on the site does", () => {
        expect(monthYear(2024, 3)).toBe("Mar 2024");
        expect(monthYear(2024, 9)).toBe("Sep 2024");
        expect(MONTHS).toHaveLength(12);
    });

    it("gives the entry, the record and the readout one month's name", () => {
        expect(formatEntryDate("2024-09-14")).toBe("14 Sep 2024");
        expect(formatTimelineDate("2024-09-01")).toBe(monthYear(2024, 9));
    });
});
