import { describe, expect, it } from "vitest";
import { directoryRows } from "@/lib/directory";
import { FIXTURE_PROFILE } from "@/lib/fixtures";

describe("directoryRows", () => {
    it("leads to each section that has something to show, numbered in order", () => {
        const rows = directoryRows(
            ["experience", "skills", "certifications", "missions", "contact"],
            { profile: FIXTURE_PROFILE, projects: 4 },
        );
        expect(rows.map((row) => [row.num, row.key, row.href])).toEqual([
            ["01", "experience", "/resume#experience"],
            ["02", "skills", "/resume#skills"],
            ["03", "certifications", "/resume#certifications"],
            ["04", "missions", "/portfolio"],
            ["05", "contact", "/contact"],
        ]);
        expect(rows.every((row) => row.id === undefined)).toBe(true);
        expect(rows[3]).toMatchObject({
            themed: "Missions",
            plain: "Projects",
        });
    });

    it("leaves out a row whose destination is empty", () => {
        const rows = directoryRows(
            ["experience", "skills", "certifications", "missions", "writing"],
            {
                profile: {
                    ...FIXTURE_PROFILE,
                    skillGroups: [],
                    credentials: [],
                },
                posts: 0,
                projects: 0,
            },
        );
        expect(rows.map((row) => [row.num, row.key])).toEqual([
            ["01", "experience"],
        ]);
        expect(directoryRows(["experience"], { profile: null })).toEqual([]);
    });

    it("carries the old /portfolio fragments when asked", () => {
        const rows = directoryRows(
            ["experience", "skills", "certifications", "writing", "contact"],
            { profile: FIXTURE_PROFILE, posts: 3 },
            { anchors: true },
        );
        expect(rows.map((row) => row.id)).toEqual([
            "experience",
            "skills",
            "certifications",
            "engineering-writing",
            "contact",
        ]);
    });
});
