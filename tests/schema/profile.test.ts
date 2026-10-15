import { describe, expect, it } from "vitest";
import { CONTACT_TOPICS } from "@/lib/contact";
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
            "Site copy",
            "About",
            "Right Now",
            "Portfolio",
            "Talks & Papers",
        ]);
        expect(fieldsInGroup("status")).toEqual(["availability", "launch"]);
        expect(fieldsInGroup("talks")).toEqual(["talksAndPapers"]);
    });

    it("gathers every page introduction and the contact routes under Site copy", () => {
        expect(fieldsInGroup("copy")).toEqual([
            "workSummary",
            "writingDescription",
            "contactInvitation",
            "projectsIntro",
            "contactIntro",
            "contactRoutes",
        ]);
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

describe("profile copy fields", () => {
    type Field = {
        name: string;
        type: string;
        description?: string;
        fields?: Field[];
        of?: { name?: string; fields?: Field[] }[];
        validation?: unknown;
    };
    const fields = profile.fields as unknown as Field[];
    const field = (name: string) => fields.find((item) => item.name === name);

    it("keeps the location an optional city and region, and holds no image of the owner", () => {
        const location = field("location");
        expect(location?.type).toBe("string");
        expect(location?.description).toBe(
            "City and region, e.g. San José, California; shown only in the Person structured data",
        );
        // The rule's calls, recorded: a length cap, never `required`.
        const calls: string[] = [];
        const rule: object = new Proxy(
            {},
            {
                get: (_, name) => () => {
                    calls.push(String(name));
                    return rule;
                },
            },
        );
        (location?.validation as (rule: object) => unknown)(rule);
        expect(calls).toEqual(["max"]);
        expect(field("portrait")).toBeUndefined();
        expect(fields.filter((item) => item.type === "image")).toEqual([]);
    });

    it("words one route per contact topic, in route order", () => {
        const routes = field("contactRoutes");
        expect(routes?.fields?.map((item) => item.name)).toEqual([
            ...CONTACT_TOPICS,
        ]);
        expect(
            routes?.fields?.every((item) => item.type === "contactRoute"),
        ).toBe(true);
    });

    it("keeps availability as one line per opening", () => {
        const availability = field("availability");
        const seeking = availability?.fields?.find(
            (item) => item.name === "seeking",
        );
        expect(seeking?.type).toBe("array");
        expect(seeking?.of?.[0]?.name).toBe("opening");
        expect(seeking?.of?.[0]?.fields?.map((item) => item.name)).toEqual([
            "label",
        ]);
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
