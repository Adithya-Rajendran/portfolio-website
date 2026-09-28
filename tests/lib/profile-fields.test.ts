import { describe, expect, expectTypeOf, it } from "vitest";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import { formatTimelineDate } from "@/lib/profile-content";
import {
    checkAvailabilityOpenTo,
    checkTimelineRange,
} from "@/lib/profile-fields";
import type { ProfileData } from "@/lib/sanity-client";
import type { PROFILE_QUERY_RESULT } from "@/sanity.types";

describe("profile schema rules", () => {
    it("requires Open To unless availability is closed", () => {
        expect(checkAvailabilityOpenTo("open", undefined)).toEqual(
            expect.any(String),
        );
        expect(checkAvailabilityOpenTo("selective", "   ")).toEqual(
            expect.any(String),
        );
        expect(checkAvailabilityOpenTo("open", "Summer 2027 internships")).toBe(
            true,
        );
        expect(checkAvailabilityOpenTo("closed", undefined)).toBe(true);
        // Status has its own required rule; do not double-report.
        expect(checkAvailabilityOpenTo(undefined, undefined)).toBe(true);
    });

    it("warns when a timeline entry starts and ends on the same date", () => {
        expect(checkTimelineRange("2023-06-01", "2023-06-01")).toEqual(
            expect.stringContaining("point"),
        );
        expect(checkTimelineRange("2019-01-01", "2023-06-01")).toBe(true);
        expect(checkTimelineRange(undefined, "2023-06-01")).toBe(true);
        expect(checkTimelineRange("2026-08-01", undefined)).toBe(true);
    });
});

describe("PROFILE_QUERY result", () => {
    it("matches the hand-written ProfileData type", () => {
        // Fails `pnpm typecheck` when the query, the schema or ProfileData
        // drift apart. The all-null member is Sanity's placeholder for a
        // profile document without fields.
        type SavedProfile = Extract<
            NonNullable<PROFILE_QUERY_RESULT>,
            { name: string }
        >;
        expectTypeOf<SavedProfile>().toExtend<ProfileData>();
    });
});

describe("fixture profile", () => {
    const ucsc = FIXTURE_PROFILE.timeline?.find(
        (entry) => entry.orgShort === "UCSC",
    );

    it("prints the year-only UC Santa Cruz dates without a month", () => {
        expect(ucsc?.startPrecision).toBe("year");
        expect(formatTimelineDate(ucsc?.startDate, ucsc?.startPrecision)).toBe(
            "2019",
        );
        expect(ucsc?.endPrecision).toBe("year");
        expect(formatTimelineDate(ucsc?.endDate, ucsc?.endPrecision)).toBe(
            "2023",
        );
        expect(
            checkTimelineRange(
                ucsc?.startDate ?? undefined,
                ucsc?.endDate ?? undefined,
            ),
        ).toBe(true);
    });

    it("uses the résumé's availability line", () => {
        expect(FIXTURE_PROFILE.availability?.openTo).toBe(
            "Summer 2027 internships · Full-time opportunities in 2028",
        );
        expect(FIXTURE_PROFILE.availability?.consultingOpen).toBe(false);
    });

    it("publishes no email address or phone number", () => {
        const text = JSON.stringify(FIXTURE_PROFILE);
        expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
        expect(text).not.toMatch(/mailto:|tel:/i);
    });
});
