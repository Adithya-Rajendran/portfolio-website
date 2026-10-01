import { describe, expect, it } from "vitest";
import {
    crewRecord,
    nowGroups,
    previousRole,
    questions,
    taglineOf,
} from "@/lib/crew";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import type { ProfileData, TimelineEntry } from "@/lib/sanity-client";

const entry = (fields: Partial<TimelineEntry>): TimelineEntry => ({
    _key: "k",
    kind: "work",
    title: "Role",
    organization: "Org",
    ...fields,
});

const profile = (fields: Partial<ProfileData>): ProfileData => ({
    _id: "profile",
    name: "Ada Example",
    headline: "Engineer",
    introduction: "",
    bio: "",
    ...fields,
});

describe("the previous role", () => {
    const timeline = [
        entry({
            _key: "study",
            kind: "education",
            title: "MS Engineering",
            organization: "A University",
            startDate: "2026-08-01",
            isCurrent: true,
            expectedEndYear: 2028,
        }),
        entry({
            _key: "old",
            title: "Intern",
            startDate: "2023-12-01",
            endDate: "2024-05-01",
        }),
        entry({
            _key: "last",
            title: "Engineer",
            organization: "A Company",
            startDate: "2024-05-01",
            endDate: "2026-07-01",
        }),
    ];

    it("takes the finished role that ended last as Previously", () => {
        expect(previousRole(timeline)?.id).toBe("last");
        expect(previousRole([timeline[0]])).toBeNull();
    });
});

describe("the home page's lines", () => {
    it("uses the tagline, else the introduction's first sentence", () => {
        expect(taglineOf(profile({ tagline: "  One line.  " }))).toBe(
            "One line.",
        );
        expect(
            taglineOf(
                profile({
                    introduction:
                        "I’m exploring how robots perceive the world. Here I share notes.",
                }),
            ),
        ).toBe("I’m exploring how robots perceive the world.");
        expect(taglineOf(profile({ introduction: "No full stop" }))).toBe(
            "No full stop",
        );
        expect(taglineOf(profile({ introduction: "" }))).toBeNull();
        expect(taglineOf(null)).toBeNull();
    });
});

describe("questions", () => {
    it("lists the questions unnumbered and links the ones that point somewhere", () => {
        const rows = questions(
            [
                { _key: "a", title: "Plain?", note: " A note. " },
                { _key: "b", title: "About a post?", postId: "p1" },
                { _key: "c", title: "About a project?", projectId: "x1" },
                { _key: "d", title: "Out there?", url: "https://example.com" },
                { _key: "e", title: "Unpublished?", postId: "gone" },
                { _key: "f", title: "  " },
            ],
            [{ _id: "p1", slug: "a-post" }],
            [{ _id: "x1", slug: "a-project" }],
        );
        expect(
            rows.map(({ title, href, external, note }) => ({
                title,
                href,
                external,
                note,
            })),
        ).toEqual([
            { title: "Plain?", href: null, external: false, note: "A note." },
            {
                title: "About a post?",
                href: "/blog/a-post",
                external: false,
                note: null,
            },
            {
                title: "About a project?",
                href: "/portfolio/a-project",
                external: false,
                note: null,
            },
            {
                title: "Out there?",
                href: "https://example.com",
                external: true,
                note: null,
            },
            { title: "Unpublished?", href: null, external: false, note: null },
        ]);
    });
});

describe("nowGroups", () => {
    it("groups the Now list by kind, questions first", () => {
        const groups = nowGroups(
            [
                { _key: "r1", kind: "reading", title: "A book" },
                { _key: "q1", kind: "question", title: "Why?" },
                { _key: "b1", kind: "building", title: "A rig", postId: "p1" },
                // Saved before kinds existed: a question.
                { _key: "q2", title: "How?" },
                { _key: "r2", kind: "reading", title: "A paper" },
                { _key: "blank", kind: "learning", title: " " },
            ],
            [{ _id: "p1", slug: "a-post" }],
        );
        expect(
            groups.map((group) => [
                group.kind,
                group.items.map((item) => item.title),
            ]),
        ).toEqual([
            ["question", ["Why?", "How?"]],
            ["building", ["A rig"]],
            ["reading", ["A book", "A paper"]],
        ]);
        expect(groups[1].items[0].href).toBe("/blog/a-post");
    });

    it("is empty without items", () => {
        expect(nowGroups(null)).toEqual([]);
        expect(nowGroups([{ _key: "x", title: "" }])).toEqual([]);
    });

    it("matches the plain questions when every item is a question", () => {
        const items = FIXTURE_PROFILE.currentCuriosities;
        expect(nowGroups(items)).toEqual([
            { kind: "question", items: questions(items) },
        ]);
    });
});

describe("crewRecord", () => {
    it("draws the owner's record on two rows of twelve columns", () => {
        const cells = crewRecord(FIXTURE_PROFILE);
        // No Open To (the hero's and the heads') and no edit date.
        // No name: the header's wordmark and the footer carry it.
        expect(cells.map((cell) => [cell.id, cell.span])).toEqual([
            ["studying", 6],
            ["previously", 6],
            ["links", 12],
        ]);
        expect(
            crewRecord({
                ...FIXTURE_PROFILE,
                focusAreas: ["Robotic vision", "Robotics & AI"],
            }).map((cell) => [cell.id, cell.span]),
        ).toEqual([
            ["studying", 6],
            ["previously", 6],
            ["focus", 6],
            ["links", 6],
        ]);
        // The facts in whole parts, so a wrapped line never ends on a dot.
        expect(cells[0]).toMatchObject({
            facts: [
                "San José State University",
                "Aug 2026 – present",
                "Expected 2028",
            ],
            note: null,
        });
        expect(cells[1]).toMatchObject({
            value: "Field Software Engineer I",
            facts: ["Canonical Ltd (Ubuntu)", "May 2024 – Jul 2026"],
        });
        // A title's long parenthetical is its own quiet line, as on
        // /resume.
        const promoted = crewRecord({
            ...FIXTURE_PROFILE,
            timeline: FIXTURE_PROFILE.timeline?.map((entry) =>
                entry.title === "Field Software Engineer I"
                    ? {
                          ...entry,
                          title: "Field Software Engineer I (promoted from Associate Field Engineer after the first year)",
                      }
                    : entry,
            ),
        }).find((cell) => cell.id === "previously");
        expect(promoted).toMatchObject({
            value: "Field Software Engineer I",
            note: "Promoted from Associate Field Engineer after the first year",
        });
    });

    it("leaves out what the profile does not say, and closes the rows", () => {
        const cells = crewRecord(
            profile({
                socialLinks: [
                    {
                        _key: "l",
                        label: "LinkedIn",
                        url: "https://www.linkedin.com/in/me",
                    },
                    { _key: "m", label: "Mail", url: "mailto:a@b.test" },
                ],
            }),
        );
        expect(cells.map((cell) => [cell.id, cell.span])).toEqual([
            ["links", 12],
        ]);
        expect(cells[0].links).toEqual([
            {
                label: "LinkedIn",
                url: "https://www.linkedin.com/in/me",
                host: "linkedin.com/in/me",
            },
        ]);
        expect(crewRecord(null)).toEqual([]);
    });

    it("links LinkedIn and GitHub only, the profiles beside the facts", () => {
        const cells = crewRecord(
            profile({
                socialLinks: [
                    {
                        _key: "c",
                        label: "Credly",
                        url: "https://www.credly.com/users/me",
                    },
                    {
                        _key: "g",
                        label: "GitHub",
                        url: "https://github.com/me",
                    },
                    {
                        _key: "l",
                        label: "LinkedIn",
                        url: "https://www.linkedin.com/in/me",
                    },
                ],
            }),
        );
        const links = cells.find((cell) => cell.id === "links")?.links;
        expect(links?.map((link) => link.label)).toEqual([
            "LinkedIn",
            "GitHub",
        ]);
    });
});
