import { describe, expect, it } from "vitest";
import profile from "@/sanity/schemas/profile";
import timelineEntry from "@/sanity/schemas/objects/timelineEntry";

function fieldsInGroup(group: string) {
    return profile.fields
        .filter((field) => [field.group].flat().includes(group))
        .map((field) => field.name);
}

describe("profile schema groups", () => {
    it("adds Status and Talks & Papers to the Studio groups", () => {
        expect(profile.groups?.map((group) => group.title)).toEqual([
            "Identity",
            "Status",
            "Homepage & Writing",
            "About",
            "Right Now",
            "Portfolio",
            "Talks & Papers",
        ]);
        expect(fieldsInGroup("status")).toEqual(["availability", "launch"]);
        expect(fieldsInGroup("talks")).toEqual(["talksAndPapers"]);
    });

    it("assigns every field to a group that exists", () => {
        const names = new Set(profile.groups?.map((group) => group.name));
        for (const field of profile.fields) {
            for (const group of [field.group].flat()) {
                expect(names, `${field.name} → ${group}`).toContain(group);
            }
        }
    });
});

describe("timeline entry schema", () => {
    type Field = {
        name: string;
        options?: { list?: { value: string }[] };
        hidden?: (context: { parent?: Record<string, unknown> }) => boolean;
    };
    const fields = timelineEntry.fields as unknown as Field[];
    const field = (name: string) => fields.find((item) => item.name === name);

    it("records a year-only precision for the start and the end", () => {
        for (const [precision, date] of [
            ["startPrecision", "startDate"],
            ["endPrecision", "endDate"],
        ] as const) {
            expect(
                field(precision)?.options?.list?.map((item) => item.value),
                precision,
            ).toEqual(["month", "year"]);
            // Shown only once its date is set.
            expect(field(precision)?.hidden?.({ parent: {} })).toBe(true);
            expect(
                field(precision)?.hidden?.({
                    parent: { [date]: "2023-06-01" },
                }),
            ).toBe(false);
        }
    });
});
