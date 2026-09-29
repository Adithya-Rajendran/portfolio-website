import { describe, expect, it } from "vitest";
import { directoryRows, profileRows } from "@/lib/directory";
import { FIXTURE_PROFILE } from "@/lib/fixtures";

describe("directoryRows", () => {
    it("leads to each section that has something to show, by its plain name", () => {
        const rows = directoryRows(
            ["experience", "skills", "certifications", "missions", "contact"],
            { profile: FIXTURE_PROFILE, projects: 4 },
        );
        expect(rows.map((row) => [row.key, row.href])).toEqual([
            ["experience", "/resume#experience"],
            ["skills", "/resume#skills"],
            ["certifications", "/resume#certifications"],
            ["missions", "/portfolio"],
            ["contact", "/contact"],
        ]);
        expect(rows.every((row) => row.id === undefined)).toBe(true);
        expect(rows[3]).toEqual({
            key: "missions",
            href: "/portfolio",
            plain: "Projects",
            blurb: "Projects and case studies.",
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
        expect(rows.map((row) => row.key)).toEqual(["experience"]);
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

describe("profileRows", () => {
    it("lists the profile's web links with their addresses", () => {
        const rows = profileRows({
            ...FIXTURE_PROFILE,
            socialLinks: [
                {
                    _key: "gh",
                    label: "GitHub",
                    url: "https://github.com/example/",
                },
                {
                    _key: "li",
                    label: "LinkedIn",
                    url: "https://www.linkedin.com/in/example",
                },
                { _key: "x", label: "Other", url: "ftp://example.com" },
            ],
        });
        expect(rows).toEqual([
            {
                key: "gh",
                href: "https://github.com/example/",
                plain: "GitHub",
                blurb: "github.com/example",
                external: true,
            },
            {
                key: "li",
                href: "https://www.linkedin.com/in/example",
                plain: "LinkedIn",
                blurb: "linkedin.com/in/example",
                external: true,
            },
        ]);
    });
});
