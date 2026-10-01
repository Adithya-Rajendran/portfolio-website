import { describe, expect, it } from "vitest";
import { sitePostSlug } from "@/lib/cv";
import { FIXTURE_PROJECTS } from "@/lib/fixtures";
import { logEntries, type LogSource } from "@/lib/log-index";
import { isQuantity, splitUnit } from "@/lib/metrics";
import {
    adjacentMissions,
    bodyLinks,
    briefAdds,
    essayAdds,
    essayShown,
    headStats,
    inStack,
    missionCallouts,
    missionEntries,
    missionLayout,
    missionOrder,
    missionTiers,
    newWords,
    noteLines,
    originalEntries,
    resultRows,
    splitParameters,
    stackSaid,
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

describe("toMission", () => {
    it("words a project for the missions pages", () => {
        const mission = toMission(
            project({
                designation: 3,
                slug: "kubernetes-cluster",
                name: " Kubernetes Cluster ",
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
            label: "Kubernetes Cluster",
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

    it("leads with the title when the owner has given no short name", () => {
        const mission = toMission(
            project({
                slug: "gmail-spam-filter",
                title: "Experimental Gmail spam classifier",
                name: " ",
            }),
            SITE,
        );
        // Never a name made from the slug ("Gmail Spam Filter").
        expect(mission.name).toBeNull();
        expect(mission.label).toBe("Experimental Gmail spam classifier");
    });

    it("leaves unknown values empty rather than guessing", () => {
        const mission = toMission(project({}), SITE);
        expect(mission.dates).toBeNull();
        expect(mission.role).toBeNull();
        expect(mission.statusNote).toBeNull();
        expect(mission.revised).toBeNull();
        expect(mission.cover).toBeNull();
    });

    it("carries the cover with its alt text and caption, only with an image", () => {
        const cover = {
            asset: { _ref: "image-k8s-1536x1024-webp" },
            alt: "Three small black computers in a row on a dark shelf.",
            caption: "Illustration",
        };
        expect(toMission(project({ cover }), SITE).cover).toEqual(cover);
        // A cover whose image was removed leaves only its fields behind.
        expect(
            toMission(
                project({ cover: { alt: "Gone", caption: "Gone" } }),
                SITE,
            ).cover,
        ).toBeNull();
    });

    it("keeps the links that leave the site, marking the repositories", () => {
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
                        _key: "self",
                        label: "adithya-rajendran.com",
                        url: "https://www.adithya-rajendran.com",
                        kind: "other",
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
                code: true,
                host: "github.com/owner/repo",
            },
            {
                id: "site",
                label: "example.com",
                url: "https://example.com",
                code: false,
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

    it("pages through the files in the index's order", () => {
        const missions = missionOrder([
            { slug: "b", designation: 2 },
            { slug: "a", designation: 1, featured: 1 },
            { slug: "c", designation: 3 },
        ]);
        expect(adjacentMissions(missions, "a")).toEqual({
            previous: null,
            next: { slug: "b", designation: 2 },
        });
        expect(adjacentMissions(missions, "b")).toEqual({
            previous: { slug: "a", designation: 1, featured: 1 },
            next: { slug: "c", designation: 3 },
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
    it("finds the original entry and the other related ones", () => {
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
        // The head links the original: Related writing lists the rest.
        expect(related.map((entry) => entry.slug)).toEqual(["gui", "gpu"]);
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
        expect(related.map((entry) => entry.slug)).toEqual(["my-homelab"]);
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
    it("lists each callout as a plain row: the part and what it does", () => {
        expect(
            missionCallouts([
                {
                    _key: "a",
                    label: "1",
                    title: " Tier 0 ",
                    body: "Three Pis.",
                    anchor: { heading: "tier-0", postId: "id-homelab" },
                },
                { _key: "b", label: "2", title: "In the essay", body: " " },
                { _key: "c", label: "3", title: "  " },
            ]),
        ).toEqual([
            { id: "a", title: "Tier 0", body: "Three Pis." },
            { id: "b", title: "In the essay", body: null },
        ]);
        expect(missionCallouts(null)).toEqual([]);
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

    it("leaves out a spec the card's text already names", () => {
        const { specs } = splitParameters(
            [param("e", "Feed", "RSS"), param("f", "Region", "us-west")],
            ["Next.js", "Sanity"],
            ["Publishes articles, with a searchable archive and RSS feed."],
        );
        expect(specs.map((item) => item.id)).toEqual(["f"]);
    });

    it("finds a stack the page's words already name in full", () => {
        const stack = ["Kubernetes", "NFS", "Okta OIDC", "CIS Level 1"];
        const words = [
            "Kubernetes cluster with NFS and OIDC",
            "Applied CIS Level 1 hardening and integrated Okta OIDC authentication with NFS persistent storage.",
        ];
        expect(stackSaid(stack, words)).toBe(true);
        expect(stackSaid(stack, words.slice(0, 1))).toBe(false);
        expect(stackSaid([], words)).toBe(false);
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

    it("keeps a note a note with a cover, which its head sets beside it", () => {
        const image = { asset: { _ref: "image-k8s-1536x1024-webp" } };
        const covered = {
            ...kubernetes,
            cover: { ...image, caption: "Illustration" },
        };
        // An image is no evidence of its own…
        expect(missionLayout(covered)).toBe("note");
        // …but the model's poster (the viewer's slot) is.
        expect(
            missionLayout({
                ...kubernetes,
                model: { kind: "procedural", alt: "The rack", poster: image },
            }),
        ).toBe("file");
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
        // A sentence or two more is still a restatement…
        expect(
            essayAdds(
                body(
                    block("a", "I built a cluster."),
                    block("b", "It ran for a year."),
                ),
                ["Built a cluster"],
            ),
        ).toBe(false);
        // …eight new words are not.
        expect(
            essayAdds(
                body(
                    block("a", "I built a cluster."),
                    block(
                        "b",
                        "Upgrades drained each node while etcd snapshots went to object storage nightly.",
                    ),
                ),
                ["Built a cluster"],
            ),
        ).toBe(true);
        expect(
            essayAdds(body({ _type: "image", _key: "i" }), ["Built it."]),
        ).toBe(true);
        expect(essayAdds(null, ["Built it."])).toBe(false);
    });

    it("counts new words by stem, so a plural or a tense is not new", () => {
        expect(
            newWords(["Published pages, cached."], ["publishes a page cache"]),
        ).toBe(0);
        expect(
            newWords(["The source code is on GitHub."], ["Built a site."]),
        ).toBe(3);
    });

    it("gives a brief that restates the card no page of its own, and drops an essay that restates the brief", () => {
        const website = FIXTURE_PROJECTS.find(
            (item) => item.slug === "personal-website",
        )!;
        // Its approach says what the card does not, so the brief stays…
        expect(briefAdds(website)).toBe(true);
        expect(missionLayout(website)).toBe("file");
        // …but a brief of the card's own words is no evidence.
        expect(
            briefAdds({
                ...website,
                brief: {
                    problem: website.brief?.problem,
                    outcome: website.brief?.outcome,
                },
            }),
        ).toBe(false);
        // The two-sentence essay repeats the approach: no Case study and
        // no Read the write-up pointing at it.
        expect(essayShown(website)).toBe(false);
        expect(
            writeUpHref({ href: "/portfolio/personal-website" }, website, null),
        ).toBeNull();
        // The homelab's and the Gmail project's essays add to theirs.
        for (const slug of ["homelab", "gmail-spam-filter"]) {
            expect(
                essayShown(
                    FIXTURE_PROJECTS.find((item) => item.slug === slug)!,
                ),
                slug,
            ).toBe(true);
        }
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
                name: "Gmail Classifier",
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
            alternateName: "Gmail Classifier",
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
