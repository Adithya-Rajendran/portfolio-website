import { describe, expect, it } from "vitest";
import { PROJECT_ESSAY_FIXTURE } from "@/lib/fixtures";
import {
    isLifetime,
    parseLegacyDate,
    parseLegacyRange,
} from "@/migrations/personal-site-profile/legacyDate";

describe("personal-site-profile legacy dates", () => {
    it("normalizes every legacy month format used by production content", () => {
        expect(parseLegacyDate("May 2024")).toBe("2024-05-01");
        expect(parseLegacyDate("September 2023")).toBe("2023-09-01");
        expect(parseLegacyDate("2023-06-01")).toBe("2023-06-01");
        expect(parseLegacyDate("2026-03-30T09:45:00Z")).toBe("2026-03-30");
        expect(parseLegacyDate("June 2023")).toBe("2023-06-01");
    });

    it("parses open and closed experience ranges", () => {
        expect(parseLegacyRange("May 2024 - Present")).toEqual({
            startDate: "2024-05-01",
            endDate: undefined,
            openEnded: true,
        });
        expect(parseLegacyRange("December 2023 - May 2024")).toEqual({
            startDate: "2023-12-01",
            endDate: "2024-05-01",
            openEnded: false,
        });
    });

    it("recognizes explicit non-expiring values", () => {
        expect(isLifetime("No expiry")).toBe(true);
        expect(isLifetime("lifetime")).toBe(true);
        expect(isLifetime("August 2025")).toBe(false);
    });
});

describe("project essay fixture", () => {
    it("covers every contentBody member without becoming a listed project", () => {
        expect(
            new Set(PROJECT_ESSAY_FIXTURE.body.map((block) => block._type)),
        ).toEqual(
            new Set([
                "block",
                "callout",
                "gallery",
                "image",
                "code",
                "mediaEmbed",
            ]),
        );
        expect(PROJECT_ESSAY_FIXTURE.body.every((block) => block._key)).toBe(
            true,
        );
    });

    it("gives nested object-array members stable keys", () => {
        const gallery = PROJECT_ESSAY_FIXTURE.body.find(
            (block) => block._type === "gallery",
        );
        expect(gallery?.images).toEqual([
            expect.objectContaining({ _key: "fixture-gallery-image" }),
        ]);
    });
});
