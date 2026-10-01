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
            current: true,
            expected: "Expected 2028",
        });
    });

    it("omits an unknown start: the zero-length placeholder prints its end only", () => {
        const row = cvEntry(
            entry({ startDate: "2023-06-01", endDate: "2023-06-01" }),
        );
        expect(row).toMatchObject({ dates: "Jun 2023" });
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
            orgLabel: "UCSC",
            span: {
                startDate: ucsc.startDate,
                startPrecision: "year",
                endDate: ucsc.endDate,
                endPrecision: "year",
            },
        });
    });

    it("labels employment except degrees and what the title says, and makes a safe fragment", () => {
        expect(cvEntry(entry({ employment: "internship" })).employment).toBe(
            "Internship",
        );
        expect(cvEntry(entry({ employment: "degree" })).employment).toBeNull();
        // "Intern" already says it, on screen and on paper; a word that
        // only starts the same does not.
        expect(
            cvEntry(
                entry({
                    title: "Cybersecurity Analyst Intern",
                    employment: "internship",
                }),
            ).employment,
        ).toBeNull();
        expect(
            cvEntry(
                entry({
                    title: "International Programs Lead",
                    employment: "internship",
                }),
            ).employment,
        ).toBe("Internship");
        expect(
            cvEntry(
                entry({ title: "Research Assistant", employment: "research" }),
            ).employment,
        ).toBeNull();
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

    const SITE = {
        url: "https://adithya-rajendran.com",
        posts: new Set(["gpu"]),
    };

    it("orders projects by mission number and keeps http links only", () => {
        const rows = cvProjects(
            [
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
            ],
            SITE,
        );
        expect(rows.map((row) => row.slug)).toEqual(["a", "b"]);
        // No type line: the title says what kind of project it is.
        expect(rows[0]).not.toHaveProperty("types");
        expect(rows[0]).toMatchObject({
            years: "c. 2023",
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
            cvProjects([project({ status: "planned" })], SITE)[0].years,
        ).toBeNull();
    });

    it("links the site's own posts in place and leaves out its address", () => {
        const [row] = cvProjects(
            [
                project({
                    links: [
                        {
                            _key: "p",
                            label: "The write-up",
                            url: "https://www.adithya-rajendran.com/blog/gpu/",
                        },
                        {
                            _key: "u",
                            label: "An unpublished post",
                            url: "https://adithya-rajendran.com/blog/draft",
                        },
                        {
                            _key: "s",
                            label: "adithya-rajendran.com",
                            url: "https://adithya-rajendran.com",
                        },
                        {
                            _key: "r",
                            label: "GitHub repository",
                            url: "https://github.com/x/y",
                        },
                    ],
                }),
            ],
            SITE,
        );
        expect(row.links).toEqual([
            {
                label: "The write-up",
                url: "/blog/gpu",
                host: "adithya-rajendran.com/blog/gpu",
            },
            {
                label: "GitHub repository",
                url: "https://github.com/x/y",
                host: "github.com/x/y",
            },
        ]);
    });

    it("keeps a talk without a date undated", () => {
        expect(cvTalks(FIXTURE_PROFILE.talksAndPapers)).toEqual([
            {
                id: "talk-navigating-ai-risks",
                title: "Navigating AI Risks for Small Businesses",
                venue: "IGNITE · Bucknell University",
                date: null,
                links: [],
            },
        ]);
    });

    it("lists every credential as the same plain row, current ones first", () => {
        const { current, prior } = cvCredentials(
            FIXTURE_PROFILE.credentials as CredentialListItem[],
        );
        // As the résumé lists them: the span (or the issue date without
        // an expiry), the name and the issuer unless the name says it,
        // linked when the record has a page; no status, never "Expired"
        // or "No expiry".
        expect(current).toEqual([
            {
                id: "credential-mta-security",
                title: "MTA: Security Fundamentals",
                issuer: "Microsoft",
                url: "https://www.credly.com/badges/b0889cff-2fbc-46c0-b16e-f631fefb024b",
                dates: "May 2018",
            },
        ]);
        expect(prior).toEqual([
            {
                id: "credential-aws-saa",
                title: "AWS Certified Solutions Architect – Associate",
                issuer: null,
                url: "https://www.credly.com/badges/80207866-2bf2-41a0-8c92-991295e79063/",
                dates: "Sep 2023 – Sep 2026",
            },
            {
                id: "credential-security-plus",
                title: "CompTIA Security+",
                issuer: null,
                url: "https://www.credly.com/badges/78c2780d-63dc-4c2b-a6df-72138c469271",
                dates: "Aug 2022 – Aug 2025",
            },
        ]);
        // A current credential with an expiry shows its span; one without
        // a page is not linked.
        expect(
            cvCredentials([
                {
                    _key: "k",
                    title: " A current one ",
                    issuer: "Issuer",
                    issuedOn: "2025-01-01",
                    expiresOn: "2028-01-01",
                    lifetime: false,
                    lifecycleStatus: "active",
                    verificationUrl: "javascript:alert(1)",
                },
            ]).current,
        ).toEqual([
            {
                id: "k",
                title: "A current one",
                issuer: "Issuer",
                url: null,
                dates: "Jan 2025 – Jan 2028",
            },
        ]);
        expect(cvCredentials(null)).toEqual({ current: [], prior: [] });
    });
});
