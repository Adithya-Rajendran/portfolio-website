import { describe, expect, it } from "vitest";
import {
    cvAnchor,
    cvCredentials,
    cvEntries,
    cvEntry,
    cvProjects,
    cvTalks,
} from "@/lib/cv";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import type {
    CredentialListItem,
    ProjectListItem,
    TimelineEntry,
} from "@/lib/sanity-client";

const entry = (fields: Partial<TimelineEntry>): TimelineEntry => ({
    _key: "k",
    kind: "work",
    title: "Role",
    organization: "Org",
    ...fields,
});

describe("timeline rows", () => {
    it("words a finished role's months, and derives no length from them", () => {
        const row = cvEntry(
            entry({
                startDate: "2024-05-01",
                endDate: "2026-07-01",
                isCurrent: false,
                location: "Remote",
            }),
        );
        expect(row).toMatchObject({
            dates: "May 2024 – Jul 2026",
            years: "2024–2026",
            current: false,
            location: "Remote",
            expected: null,
        });
        // The dates are the résumé's; a "2 yr 3 mo" would be a derived
        // figure it does not state.
        expect(row).not.toHaveProperty("duration");
    });

    it("words the current entry as running to the present, with its expected end", () => {
        const row = cvEntry(
            entry({
                kind: "education",
                startDate: "2026-08-01",
                isCurrent: true,
                expectedEndYear: 2028,
            }),
        );
        expect(row).toMatchObject({
            dates: "Aug 2026 – present",
            years: "Since 2026",
            current: true,
            expected: "Expected 2028",
        });
    });

    it("omits an unknown start: the zero-length placeholder prints its end only", () => {
        const row = cvEntry(
            entry({ startDate: "2023-06-01", endDate: "2023-06-01" }),
        );
        expect(row).toMatchObject({
            dates: "Jun 2023",
            years: "2023",
        });
        expect(
            cvEntry(entry({ startDate: null, isCurrent: true })).dates,
        ).toBeNull();
    });

    it("prints year-only dates as years", () => {
        const ucsc = FIXTURE_PROFILE.timeline!.find(
            (item) => item.orgShort === "UCSC",
        )!;
        expect(cvEntry(ucsc)).toMatchObject({
            dates: "2019–2023",
            years: "2019–2023",
            orgLabel: "UCSC",
        });
    });

    it("labels employment except degrees, and makes a safe fragment", () => {
        expect(cvEntry(entry({ employment: "internship" })).employment).toBe(
            "Internship",
        );
        expect(cvEntry(entry({ employment: "degree" })).employment).toBeNull();
        expect(cvAnchor("timeline-1 a/b")).toBe("cv-timeline-1-a-b");
    });

    it("splits the timeline into education and experience in the owner's order", () => {
        const { all, education, experience } = cvEntries(
            FIXTURE_PROFILE.timeline,
        );
        expect(all).toHaveLength(4);
        expect(education.map((row) => row.orgLabel)).toEqual(["SJSU", "UCSC"]);
        expect(experience.map((row) => row.orgLabel)).toEqual([
            "Canonical",
            "TCR",
        ]);
        expect(cvEntries(null).all).toEqual([]);
    });
});

describe("projects, talks and credentials", () => {
    const project = (fields: Partial<ProjectListItem>): ProjectListItem => ({
        _id: "p",
        designation: 2,
        title: "Homelab",
        slug: "homelab",
        summary: "A summary.",
        status: "active",
        types: ["infrastructure"],
        hasModel: false,
        ...fields,
    });

    it("orders projects by mission number and keeps http links only", () => {
        const rows = cvProjects([
            project({ _id: "b", designation: 3, slug: "b" }),
            project({
                _id: "a",
                designation: 1,
                slug: "a",
                status: "completed",
                startDate: "2023-01-01",
                endDate: "2023-12-31",
                datesApproximate: true,
                highlights: ["Built it."],
                links: [
                    {
                        _key: "r",
                        label: "GitHub repository",
                        url: "https://github.com/x/y",
                    },
                    { _key: "m", label: "Mail", url: "mailto:a@b.c" },
                ],
            }),
        ]);
        expect(rows.map((row) => row.designation)).toEqual([
            "MSN-01",
            "MSN-03",
        ]);
        expect(rows[0]).toMatchObject({
            years: "c. 2023",
            types: "Infrastructure",
            lines: ["Built it."],
            links: [
                {
                    label: "GitHub repository",
                    url: "https://github.com/x/y",
                    host: "github.com/x/y",
                },
            ],
        });
        // No highlights: the summary stands in; no dates on an active
        // project: "Ongoing".
        expect(rows[1]).toMatchObject({
            lines: ["A summary."],
            years: "Ongoing",
        });
        // Without dates, only an active project says Ongoing.
        expect(
            cvProjects([project({ status: "planned" })])[0].years,
        ).toBeNull();
    });

    it("keeps a talk without a date undated", () => {
        expect(cvTalks(FIXTURE_PROFILE.talksAndPapers)).toEqual([
            {
                id: "talk-navigating-ai-risks",
                title: "Navigating AI Risks for Small Businesses",
                kind: "Talk",
                venue: "IGNITE · Bucknell University",
                date: null,
                links: [],
            },
        ]);
    });

    it("keeps current credentials as rows and expired ones as prior lines", () => {
        const { current, prior } = cvCredentials(
            FIXTURE_PROFILE.credentials as CredentialListItem[],
        );
        expect(current.map((row) => [row.title, row.statusLabel])).toEqual([
            ["MTA: Security Fundamentals", "No expiry"],
        ]);
        expect(current[0].meta).toBe("Issued May 2018");
        // As the résumé lists them: the name and the span, never "Expired".
        expect(prior).toEqual([
            {
                id: "credential-aws-saa",
                title: "AWS Certified Solutions Architect – Associate",
                dates: "Sep 2023 – Sep 2026",
            },
            {
                id: "credential-security-plus",
                title: "CompTIA Security+",
                dates: "Aug 2022 – Aug 2025",
            },
        ]);
        expect(cvCredentials(null)).toEqual({ current: [], prior: [] });
    });
});
