import { describe, expect, it } from "vitest";
import {
    formatEntryDate,
    entriesTagged,
    entryCount,
    logEntries,
    offersFilters,
    type LogSource,
} from "@/lib/log-index";
import { groupPostsByYear } from "@/lib/tags";

/** The owner's three published posts, as the list query returns them. */
const POSTS: LogSource[] = [
    {
        _id: "d25c7eae",
        title: "A Homelab Built to Be Rebuilt",
        slug: "my-homelab",
        description: "How three Raspberry Pis…",
        publishedAt: "2026-03-30",
        tags: ["homelab", "infrastructure"],
        wordCount: 1239,
    },
    {
        _id: "0f92e055",
        title: "Running GUI Apps in LXD Containers",
        slug: "running-gui-apps-in-lxc-containers",
        description: "The LXD profile I use…",
        publishedAt: "2026-03-26",
        tags: ["linux", "containers"],
        wordCount: 973,
    },
    {
        _id: "703a284c",
        title: "Sharing the DGX Spark GPU with MicroK8s",
        slug: "kubernetes-on-the-nvidia-dgx-spark",
        description: "Setting up MicroK8s…",
        publishedAt: "2026-03-06",
        tags: ["kubernetes", "gpu-computing"],
        wordCount: 651,
    },
];

describe("logEntries", () => {
    it("gives each entry its LOG number, newest first", () => {
        const entries = logEntries(POSTS);
        expect(entries.map((entry) => entry.designation)).toEqual([
            "LOG 003",
            "LOG 002",
            "LOG 001",
        ]);
        expect(entries[0]).toMatchObject({
            slug: "my-homelab",
            publishedAt: "2026-03-30",
            readMinutes: 7,
            tags: ["homelab", "infrastructure"],
        });
    });

    it("sorts by number whatever order the list arrives in", () => {
        const entries = logEntries([POSTS[2], POSTS[0], POSTS[1]]);
        expect(entries.map((entry) => entry.number)).toEqual([3, 2, 1]);
    });

    it("keeps an entry's number in a filtered list", () => {
        const tagged = entriesTagged(logEntries(POSTS), "linux");
        expect(tagged.map((entry) => entry.designation)).toEqual(["LOG 002"]);
    });

    it("shows a tag only once it gathers two entries, counted across the whole log", () => {
        // The owner's posts: six tags, one entry each, so none links.
        expect(logEntries(POSTS).map((entry) => entry.tagLinks)).toEqual([
            [],
            [],
            [],
        ]);
        const entries = logEntries([
            POSTS[0],
            { ...POSTS[1], tags: ["linux", "homelab"] },
            POSTS[2],
        ]);
        expect(entries.map((entry) => entry.tagLinks)).toEqual([
            ["homelab"],
            ["homelab"],
            [],
        ]);
        // A filtered list keeps what the whole log links.
        expect(entriesTagged(entries, "linux")[0].tagLinks).toEqual([
            "homelab",
        ]);
    });

    it("drops tags that are not a valid tag page and has no read time for an empty body", () => {
        const [entry] = logEntries([
            { ...POSTS[0], tags: ["homelab", "Not A Tag"], wordCount: 0 },
        ]);
        expect(entry.tags).toEqual(["homelab"]);
        expect(entry.readMinutes).toBeNull();
    });
});

describe("revisions", () => {
    it("carries a revision only when the owner set one after filing", () => {
        const [revised, same, none, earlier] = logEntries([
            { ...POSTS[0], revisedAt: "2026-07-02T10:00:00Z" },
            { ...POSTS[1], revisedAt: "2026-03-26" },
            POSTS[2],
            {
                ...POSTS[2],
                _id: "early",
                slug: "early",
                publishedAt: "2026-03-01",
                revisedAt: "2026-02-01",
            },
        ]);
        expect(revised.revisedAt).toBe("2026-07-02");
        expect(same.revisedAt).toBeNull();
        expect(none.revisedAt).toBeNull();
        expect(earlier.revisedAt).toBeNull();
    });
});

describe("offersFilters", () => {
    it("offers the tag filters once a tag gathers two entries", () => {
        expect(
            offersFilters([
                { tag: "homelab", count: 1 },
                { tag: "linux", count: 1 },
            ]),
        ).toBe(false);
        expect(
            offersFilters([
                { tag: "kubernetes", count: 2 },
                { tag: "linux", count: 1 },
            ]),
        ).toBe(true);
        expect(offersFilters([])).toBe(false);
    });
});

describe("the year groups", () => {
    it("groups entries by the year they were filed, newest year first", () => {
        const entries = logEntries([
            ...POSTS,
            {
                _id: "old",
                title: "Earlier",
                slug: "earlier",
                description: "",
                publishedAt: "2025-11-14",
                tags: [],
                wordCount: 10,
            },
        ]);
        const years = groupPostsByYear(entries);
        expect(years.map((year) => year.year)).toEqual(["2026", "2025"]);
        expect(years[0].posts.map((entry) => entry.designation)).toEqual([
            "LOG 004",
            "LOG 003",
            "LOG 002",
        ]);
        expect(years[1].posts.map((entry) => entry.designation)).toEqual([
            "LOG 001",
        ]);
    });
});

describe("labels", () => {
    it("prints counts", () => {
        expect(entryCount(1)).toBe("1 entry");
        expect(entryCount(3)).toBe("3 entries");
    });
});

describe("formatEntryDate", () => {
    it("prints the day, the month and the year", () => {
        expect(formatEntryDate("2026-03-30")).toBe("30 Mar 2026");
        expect(formatEntryDate("2026-03-06T00:00:00Z")).toBe("6 Mar 2026");
        expect(formatEntryDate("")).toBe("");
        expect(formatEntryDate(null)).toBe("");
    });
});
