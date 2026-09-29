import { describe, expect, it } from "vitest";
import {
    crewRecord,
    nowGroups,
    openTo,
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

    it("says what the owner is open to only while availability is set", () => {
        expect(openTo(FIXTURE_PROFILE)).toEqual({
            text: "Summer 2027 internships · Full-time opportunities in 2028",
            updated: { date: "2026-09-24", label: "24 Sep 2026" },
        });
        expect(openTo(profile({ availability: null }))).toBeNull();
        expect(
            openTo(
                profile({
                    availability: {
                        status: "closed",
                        seeking: [{ _key: "a", label: "Anything" }],
                        updatedAt: "2026-01-01",
                    },
                }),
            ),
        ).toBeNull();
    });
});

describe("questions", () => {
    it("numbers the questions and links the ones that point somewhere", () => {
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
            rows.map(({ num, href, external, note }) => ({
                num,
                href,
                external,
                note,
            })),
        ).toEqual([
            { num: "Q1", href: null, external: false, note: "A note." },
            { num: "Q2", href: "/blog/a-post", external: false, note: null },
            {
                num: "Q3",
                href: "/portfolio/a-project",
                external: false,
                note: null,
            },
            {
                num: "Q4",
                href: "https://example.com",
                external: true,
                note: null,
            },
            { num: "Q5", href: null, external: false, note: null },
        ]);
    });
});

describe("nowGroups", () => {
    it("groups the Now list by kind, questions first, each numbered from one", () => {
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
                group.items.map((item) => `${item.num} ${item.title}`),
            ]),
        ).toEqual([
            ["question", ["Q1 Why?", "Q2 How?"]],
            ["building", ["01 A rig"]],
            ["reading", ["01 A book", "02 A paper"]],
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
        expect(cells.map((cell) => [cell.id, cell.span])).toEqual([
            ["name", 4],
            ["studying", 4],
            ["previously", 4],
            ["openTo", 5],
            ["links", 5],
            ["updated", 2],
        ]);
        expect(
            crewRecord({
                ...FIXTURE_PROFILE,
                focusAreas: ["Robotic vision", "Robotics & AI"],
            }).map((cell) => [cell.id, cell.span]),
        ).toEqual([
            ["name", 4],
            ["studying", 4],
            ["previously", 4],
            ["focus", 3],
            ["openTo", 3],
            ["links", 4],
            ["updated", 2],
        ]);
        expect(cells[0]).toMatchObject({
            value: "Adithya Rajendran",
            accent: true,
        });
        expect(cells[1].note).toBe(
            "San José State University · Aug 2026 – present · Expected 2028",
        );
        expect(cells[2]).toMatchObject({
            value: "Field Software Engineer I",
            note: "Canonical Ltd (Ubuntu) · May 2024 – Jul 2026",
        });
        expect(cells.find((cell) => cell.id === "updated")).toMatchObject({
            value: "11 Jul 2026",
            date: "2026-07-11",
        });
    });

    it("leaves out what the profile does not say, and closes the rows", () => {
        const cells = crewRecord(
            profile({
                socialLinks: [
                    { _key: "l", label: "LinkedIn", url: "https://x.test/me" },
                    { _key: "m", label: "Mail", url: "mailto:a@b.test" },
                ],
            }),
        );
        expect(cells.map((cell) => [cell.id, cell.span])).toEqual([
            ["name", 12],
            ["links", 12],
        ]);
        expect(cells[1].links).toEqual([
            { label: "LinkedIn", url: "https://x.test/me", host: "x.test/me" },
        ]);
        expect(crewRecord(null)).toEqual([]);
    });
});
