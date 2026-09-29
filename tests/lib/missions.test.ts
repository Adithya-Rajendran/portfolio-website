import { describe, expect, it } from "vitest";
import { FIXTURE_PROJECTS } from "@/lib/fixtures";
import { logEntries, type LogSource } from "@/lib/log-index";
import { isQuantity, splitUnit } from "@/lib/metrics";
import {
    adjacentMissions,
    bodyLinks,
    essayAdds,
    headStats,
    inStack,
    missionCallouts,
    missionEntries,
    missionLayout,
    missionName,
    missionOrder,
    missionTiers,
    noteLines,
    originalEntries,
    resultRows,
    sitePostSlug,
    splitParameters,
    toMission,
    writeUpHref,
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
            stats: [{ id: "a", label: "Nodes", value: "3" }],
            specs: [],
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
    it("puts the featured slots first, then goes by mission number", () => {
        const order = missionOrder([
            { slug: "a", designation: 4 },
            { slug: "b", featured: 2, designation: 5 },
            { slug: "c", designation: 1 },
            { slug: "d", featured: 1, designation: 2 },
            { slug: "e" },
        ]);
        expect(order.map((item) => item.slug)).toEqual([
            "d",
            "b",
            "c",
            "a",
            "e",
        ]);
    });

    it("keeps the list's order between missions without a number", () => {
        const order = missionOrder<{ slug: string; featured?: number }>([
            { slug: "a" },
            { slug: "b" },
        ]);
        expect(order.map((item) => item.slug)).toEqual(["a", "b"]);
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

describe("missionTiers", () => {
    type Project = { slug: string; featured?: number };

    it("stages the flagship, gives the next ones room and lists the rest last", () => {
        const ordered = missionOrder(
            FIXTURE_PROJECTS.slice(0, 4).map((item) => ({
                slug: item.slug,
                featured: item.featured,
                designation: item.designation,
            })),
        );
        const { flagship, rows, also } = missionTiers(ordered, 2);
        expect(flagship?.slug).toBe("homelab");
        expect(rows.map((item) => item.slug)).toEqual([
            "gmail-spam-filter",
            "kubernetes-cluster",
        ]);
        // The owner's last project is the least prominent.
        expect(also.map((item) => item.slug)).toEqual(["personal-website"]);
    });

    it("stages the first project when none is featured", () => {
        const { flagship, rows, also } = missionTiers<Project>(
            [{ slug: "a" }, { slug: "b" }],
            2,
        );
        expect(flagship?.slug).toBe("a");
        expect(rows.map((item) => item.slug)).toEqual(["b"]);
        expect(also).toEqual([]);
        expect(missionTiers([], 2)).toEqual({
            flagship: null,
            rows: [],
            also: [],
        });
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

describe("isQuantity", () => {
    it("takes a value that starts with a number or a number word", () => {
        for (const value of ["195.1 W", "3 × MS-01", "90%", "0.4 ms", "Zero"])
            expect(isQuantity(value), value).toBe(true);
        for (const value of [
            "Okta OIDC",
            "CIS Level 1",
            "Next.js + React",
            "MLP",
            "Gmail API",
            "Oneida",
        ])
            expect(isQuantity(value), value).toBe(false);
    });
});

describe("splitParameters", () => {
    const param = (id: string, label: string, value: string) => ({
        id,
        label,
        value,
    });

    it("sets quantities as stats and names the stack lacks as specs", () => {
        const { stats, specs } = splitParameters(
            [
                param("a", "Nodes", "3"),
                param("b", "Downtime during upgrades", "Zero"),
                param("c", "Hardening", "CIS Level 1"),
                param("d", "Identity", "Okta OIDC"),
                param("e", "Feed", "RSS"),
            ],
            ["Kubernetes", "NFS", "Okta OIDC", "CIS Level 1"],
        );
        expect(stats.map((item) => item.id)).toEqual(["a", "b"]);
        expect(specs.map((item) => item.id)).toEqual(["e"]);
    });

    it("finds a name in the stack by its parts or a whole word", () => {
        const stack = [
            "Next.js",
            "React",
            "Sanity",
            "Multilayer perceptron (MLP)",
            "Gmail API",
        ];
        expect(inStack("Next.js + React", stack)).toBe(true);
        expect(inStack("MLP", stack)).toBe(true);
        expect(inStack("Gmail API", stack)).toBe(true);
        expect(inStack("sanity", stack)).toBe(true);
        expect(inStack("Next.js + Vue", stack)).toBe(false);
        expect(inStack("API", ["Gmail APIs"])).toBe(false);
        expect(inStack("", stack)).toBe(false);
    });

    it("keeps the results that have a metric and a value", () => {
        expect(
            resultRows([
                { metric: "Accuracy", value: "99.55%" },
                { metric: " ", value: "1" },
                { metric: "Spam missed", value: "" },
            ]),
        ).toEqual([{ metric: "Accuracy", value: "99.55%" }]);
        expect(resultRows(null)).toEqual([]);
    });

    it("sets no stats in a head that has a results table", () => {
        const mission = { stats: [param("a", "Held-out accuracy", "99.55%")] };
        expect(headStats(mission, [])).toEqual(mission.stats);
        expect(headStats(mission, [{ metric: "Accuracy" }])).toEqual([]);
    });
});

describe("the short project note", () => {
    const block = (key: string, text: string) => ({
        _type: "block",
        _key: key,
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: `${key}s`, text, marks: [] }],
    });
    const body = (...blocks: object[]) => blocks as unknown as ContentBody;
    const kubernetes = FIXTURE_PROJECTS.find(
        (item) => item.slug === "kubernetes-cluster",
    )!;

    it("lays out a project with evidence as a file, and one without as a note", () => {
        const layouts = Object.fromEntries(
            FIXTURE_PROJECTS.slice(0, 4).map((item) => [
                item.slug,
                missionLayout(item),
            ]),
        );
        expect(layouts).toEqual({
            // Results with their note.
            "gmail-spam-filter": "file",
            // The brief, the lessons and the rack's callouts.
            homelab: "file",
            // The summary, two highlights and an essay that restates them.
            "kubernetes-cluster": "note",
            // The brief.
            "personal-website": "file",
        });
        expect(
            missionLayout({
                ...kubernetes,
                body: body({
                    _type: "block",
                    _key: "h",
                    style: "h2",
                    markDefs: [],
                    children: [{ _type: "span", _key: "hs", text: "Setup" }],
                }),
            }),
        ).toBe("file");
        expect(missionLayout({ ...kubernetes, lessons: [" "], next: [] })).toBe(
            "note",
        );
    });

    it("leaves out a highlight that only repeats the summary", () => {
        expect(
            noteLines(kubernetes.summary, kubernetes.highlights ?? []),
        ).toEqual([
            "Applied CIS Level 1 hardening and integrated Okta OIDC authentication with NFS persistent storage.",
        ]);
        expect(noteLines("Something else.", ["A line."])).toEqual(["A line."]);
    });

    it("keeps an essay only when it says more than the summary and highlights", () => {
        const lines = [kubernetes.summary, ...(kubernetes.highlights ?? [])];
        // "I built …" restates "Built …".
        expect(essayAdds(kubernetes.body, lines)).toBe(false);
        expect(
            essayAdds(
                body(
                    block("a", "I built a cluster."),
                    block("b", "It ran for a year."),
                ),
                ["Built a cluster"],
            ),
        ).toBe(true);
        expect(
            essayAdds(body({ _type: "image", _key: "i" }), ["Built it."]),
        ).toBe(true);
        expect(essayAdds(null, ["Built it."])).toBe(false);
    });

    it("sends Read the write-up to the entry, else to a file's own essay", () => {
        const homelab = FIXTURE_PROJECTS.find(
            (item) => item.slug === "homelab",
        )!;
        const mission = { href: "/portfolio/homelab" };
        expect(writeUpHref(mission, homelab, { slug: "my-homelab" })).toBe(
            "/blog/my-homelab",
        );
        expect(writeUpHref(mission, homelab, null)).toBe(
            "/portfolio/homelab#write-up",
        );
        // A note has no write-up section.
        expect(
            writeUpHref({ href: "/portfolio/k" }, kubernetes, null),
        ).toBeNull();
        expect(writeUpHref(mission, null, null)).toBeNull();
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
