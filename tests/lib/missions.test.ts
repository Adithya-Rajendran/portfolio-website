import { describe, expect, it } from "vitest";
import { FIXTURE_PROJECTS } from "@/lib/fixtures";
import { logEntries, type LogSource } from "@/lib/log-index";
import { splitUnit } from "@/lib/metrics";
import {
    adjacentMissions,
    bodyLinks,
    missionCallouts,
    missionEntries,
    missionName,
    missionOrder,
    originalEntries,
    sitePostSlug,
    statusTally,
    toMission,
    typeList,
} from "@/lib/missions";
import type { ContentBody, ProjectListItem } from "@/lib/sanity-client";
import { buildMission } from "@/lib/structured-data";

const SITE = "https://adithya-rajendran.com";

const project = (fields: Partial<ProjectListItem>): ProjectListItem => ({
    _id: "project-x",
    designation: 1,
    title: "A project",
    slug: "a-project",
    summary: "What it is.",
    status: "active",
    types: ["software"],
    hasModel: false,
    ...fields,
});

const post = (slug: string, publishedAt: string, _id = slug): LogSource => ({
    _id,
    slug,
    title: slug,
    description: "",
    publishedAt,
    wordCount: 400,
});

const ENTRIES = logEntries([
    post("gpu", "2026-03-06", "id-gpu"),
    post("gui", "2026-03-26", "id-gui"),
    post("my-homelab", "2026-03-30", "id-homelab"),
]);
const POST_IDS = new Map([
    ["id-gpu", "gpu"],
    ["id-gui", "gui"],
    ["id-homelab", "my-homelab"],
]);

describe("missionName", () => {
    it("names a mission by its slug's words", () => {
        expect(missionName("homelab")).toBe("Homelab");
        expect(missionName("kubernetes-cluster")).toBe("Kubernetes Cluster");
        expect(missionName("gmail-spam-filter")).toBe("Gmail Spam Filter");
    });
});

describe("toMission", () => {
    it("words a project for the missions pages", () => {
        const mission = toMission(
            project({
                designation: 3,
                slug: "kubernetes-cluster",
                status: "completed",
                types: ["infrastructure"],
                startDate: "2024-01-01",
                endDate: "2025-12-31",
                datePrecision: "year",
                datesApproximate: true,
                _updatedAt: "2026-09-28T18:00:16Z",
                parameters: [
                    { _key: "a", label: "Nodes", value: "3" },
                    { _key: "b", label: " ", value: "empty label" },
                ],
            }),
            SITE,
        );
        expect(mission).toMatchObject({
            designation: "MSN-03",
            name: "Kubernetes Cluster",
            nameChars: 10,
            href: "/portfolio/kubernetes-cluster",
            statusValue: "complete",
            statusLabel: "Complete",
            types: ["Infrastructure"],
            dates: "c. 2024–2025",
            revised: "2026-09-28",
            parameters: [{ id: "a", label: "Nodes", value: "3" }],
        });
    });

    it("leaves unknown values empty rather than guessing", () => {
        const mission = toMission(project({}), SITE);
        expect(mission.dates).toBeNull();
        expect(mission.role).toBeNull();
        expect(mission.statusNote).toBeNull();
        expect(mission.revised).toBeNull();
    });

    it("keeps external links and names them for the register", () => {
        const mission = toMission(
            project({
                links: [
                    {
                        _key: "repo",
                        label: "GitHub repository",
                        url: "https://github.com/owner/repo",
                        kind: "repo",
                    },
                    {
                        _key: "site",
                        label: "example.com",
                        url: "https://example.com",
                        kind: "other",
                    },
                    {
                        _key: "post",
                        label: "The write-up",
                        url: `${SITE}/blog/my-homelab`,
                        kind: "article",
                    },
                    {
                        _key: "mail",
                        label: "Mail",
                        url: "mailto:someone@example.com",
                    },
                ],
            }),
            SITE,
        );
        expect(mission.links).toEqual([
            {
                id: "repo",
                label: "GitHub repository",
                url: "https://github.com/owner/repo",
                short: "Code",
                host: "github.com/owner/repo",
            },
            {
                id: "site",
                label: "example.com",
                url: "https://example.com",
                short: "example.com",
                host: "example.com",
            },
        ]);
    });
});

describe("sitePostSlug", () => {
    it("recognises this site's entries, relative or absolute", () => {
        expect(sitePostSlug("/blog/my-homelab", SITE)).toBe("my-homelab");
        expect(sitePostSlug(`${SITE}/blog/my-homelab`, SITE)).toBe(
            "my-homelab",
        );
        expect(
            sitePostSlug("https://www.adithya-rajendran.com/blog/gpu/", SITE),
        ).toBe("gpu");
    });

    it("ignores other sites and other pages", () => {
        expect(sitePostSlug("https://example.com/blog/x", SITE)).toBeNull();
        expect(sitePostSlug("/blog/archive", SITE)).toBeNull();
        expect(sitePostSlug("/blog/tags/homelab", SITE)).toBeNull();
        expect(sitePostSlug("/portfolio/homelab", SITE)).toBeNull();
    });
});

describe("missionOrder and adjacentMissions", () => {
    it("puts the featured slots first, then keeps the list's order", () => {
        const order = missionOrder([
            { slug: "a" },
            { slug: "b", featured: 2 },
            { slug: "c" },
            { slug: "d", featured: 1 },
        ]);
        expect(order.map((item) => item.slug)).toEqual(["d", "b", "a", "c"]);
    });

    it("pages through the files by mission number", () => {
        const missions = [
            { slug: "b", number: 2 },
            { slug: "a", number: 1 },
            { slug: "c", number: 3 },
        ];
        expect(adjacentMissions(missions, "a")).toEqual({
            previous: null,
            next: { slug: "b", number: 2 },
        });
        expect(adjacentMissions(missions, "b")).toEqual({
            previous: { slug: "a", number: 1 },
            next: { slug: "c", number: 3 },
        });
        expect(adjacentMissions(missions, "zzz")).toEqual({
            previous: null,
            next: null,
        });
    });
});

describe("typeList and statusTally", () => {
    const missions = FIXTURE_PROJECTS.slice(0, 4).map((item) =>
        toMission(item, SITE),
    );

    it("lists the types in the order they appear", () => {
        expect(typeList(missions)).toBe("software and infrastructure");
        expect(typeList([])).toBe("");
        expect(typeList([{ types: ["Research"] }])).toBe("research");
    });

    it("counts the missions under each status", () => {
        expect(statusTally(missions)).toEqual([
            { value: "active", label: "Active", count: 2 },
            { value: "complete", label: "Complete", count: 2 },
        ]);
    });
});

describe("missionEntries", () => {
    it("finds the original entry and every related one", () => {
        const body = [
            {
                _type: "block",
                _key: "p1",
                markDefs: [
                    { _key: "l1", _type: "contentLink", href: "/blog/gui" },
                ],
            },
        ] as unknown as ContentBody;
        const { original, related } = missionEntries({
            entries: ENTRIES,
            postIds: POST_IDS,
            referencing: [],
            links: [
                {
                    _key: "w",
                    label: "The write-up",
                    url: `${SITE}/blog/my-homelab`,
                    kind: "article",
                },
            ],
            body,
            hotspots: [
                {
                    _key: "h",
                    label: "1",
                    title: "A part",
                    anchor: { heading: "gpu-section", postId: "id-gpu" },
                },
            ],
            siteUrl: SITE,
        });
        expect(original?.slug).toBe("my-homelab");
        expect(related.map((entry) => entry.designation)).toEqual([
            "LOG 003",
            "LOG 002",
            "LOG 001",
        ]);
    });

    it("falls back to the oldest post that references the mission", () => {
        const { original, related } = missionEntries({
            entries: ENTRIES,
            postIds: POST_IDS,
            referencing: ["my-homelab", "gpu"],
            links: null,
            body: null,
            hotspots: null,
            siteUrl: SITE,
        });
        expect(original?.slug).toBe("gpu");
        expect(related.map((entry) => entry.slug)).toEqual([
            "my-homelab",
            "gpu",
        ]);
    });

    it("has nothing when nothing is linked", () => {
        expect(
            missionEntries({
                entries: ENTRIES,
                postIds: POST_IDS,
                referencing: ["unpublished"],
                links: [],
                body: [],
                hotspots: [],
                siteUrl: SITE,
            }),
        ).toEqual({ original: null, related: [] });
    });
});

describe("originalEntries", () => {
    it("maps each mission to its write-up, from the list data alone", () => {
        const originals = originalEntries(
            [
                project({
                    _id: "linked",
                    links: [
                        {
                            _key: "w",
                            label: "The write-up",
                            url: `${SITE}/blog/my-homelab`,
                        },
                    ],
                }),
                project({ _id: "cited" }),
                project({ _id: "alone" }),
            ],
            [
                { slug: "gpu", projectIds: ["cited"] },
                { slug: "gui", projectIds: ["cited"] },
            ],
            ENTRIES,
            SITE,
        );
        expect(originals.get("linked")?.slug).toBe("my-homelab");
        expect(originals.get("cited")?.slug).toBe("gpu");
        expect(originals.has("alone")).toBe(false);
    });
});

describe("bodyLinks", () => {
    it("collects links at any depth", () => {
        const body = [
            {
                _type: "callout",
                _key: "c",
                body: [
                    {
                        _type: "block",
                        _key: "b",
                        markDefs: [
                            { _type: "contentLink", _key: "x", href: "/a" },
                        ],
                    },
                ],
            },
        ] as unknown as ContentBody;
        expect(bodyLinks(body)).toEqual(["/a"]);
        expect(bodyLinks(null)).toEqual([]);
    });
});

describe("missionCallouts", () => {
    it("links each callout to its section, in a post or in the essay", () => {
        const callouts = missionCallouts({
            hotspots: [
                {
                    _key: "a",
                    label: "1",
                    title: " Tier 0 ",
                    body: "Three Pis.",
                    anchor: { heading: "tier-0", postId: "id-homelab" },
                },
                {
                    _key: "b",
                    label: "2",
                    title: "In the essay",
                    anchor: { heading: "own-section" },
                },
                {
                    _key: "c",
                    label: "3",
                    title: "An unpublished post",
                    anchor: { heading: "x", postId: "id-draft" },
                },
                {
                    _key: "d",
                    label: "4",
                    title: "A missing essay heading",
                    anchor: { heading: "nowhere" },
                },
            ],
            entries: ENTRIES,
            postIds: POST_IDS,
            essayHeadings: new Set(["own-section"]),
        });
        expect(callouts).toEqual([
            {
                id: "a",
                label: "1",
                title: "Tier 0",
                body: "Three Pis.",
                href: "/blog/my-homelab#tier-0",
                entry: "LOG 003",
            },
            {
                id: "b",
                label: "2",
                title: "In the essay",
                body: null,
                href: "#own-section",
                entry: null,
            },
            {
                id: "c",
                label: "3",
                title: "An unpublished post",
                body: null,
                href: null,
                entry: null,
            },
            {
                id: "d",
                label: "4",
                title: "A missing essay heading",
                body: null,
                href: null,
                entry: null,
            },
        ]);
    });
});

describe("splitUnit", () => {
    it("sets a unit apart only after a number and a space", () => {
        expect(splitUnit("195.1 W")).toEqual({ amount: "195.1", unit: "W" });
        expect(splitUnit("12 TB")).toEqual({ amount: "12", unit: "TB" });
        expect(splitUnit("0.4 ms")).toEqual({ amount: "0.4", unit: "ms" });
        expect(splitUnit("90%")).toEqual({ amount: "90%", unit: "" });
        expect(splitUnit("3 × MS-01")).toEqual({
            amount: "3 × MS-01",
            unit: "",
        });
        expect(splitUnit("Okta OIDC")).toEqual({
            amount: "Okta OIDC",
            unit: "",
        });
        expect(splitUnit("CIS Level 1")).toEqual({
            amount: "CIS Level 1",
            unit: "",
        });
    });
});

describe("buildMission", () => {
    it("describes a mission file as a CreativeWork", () => {
        const mission = toMission(
            project({
                slug: "gmail-spam-filter",
                designation: 1,
                title: "Gmail spam detection with machine learning",
                technologies: ["Gmail API"],
                links: [
                    {
                        _key: "repo",
                        label: "GitHub repository",
                        url: "https://github.com/owner/repo",
                        kind: "repo",
                    },
                ],
                _updatedAt: "2026-09-28T00:00:00Z",
            }),
            SITE,
        );
        expect(buildMission(mission)).toEqual({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: "Gmail spam detection with machine learning",
            alternateName: "Gmail Spam Filter",
            identifier: "MSN-01",
            url: `${SITE}/portfolio/gmail-spam-filter`,
            description: "What it is.",
            genre: "Software",
            keywords: "Gmail API",
            dateModified: "2026-09-28",
            creator: {
                "@type": "Person",
                name: "Adithya Rajendran",
                url: SITE,
            },
            isPartOf: {
                "@type": "CollectionPage",
                "@id": `${SITE}/portfolio`,
            },
            sameAs: ["https://github.com/owner/repo"],
        });
    });
});
