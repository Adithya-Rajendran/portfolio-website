import { describe, expect, it } from "vitest";
import profile from "@/sanity/schemas/profile";

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
