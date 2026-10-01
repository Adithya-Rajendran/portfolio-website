import { describe, expect, it } from "vitest";
import {
    formatEntryDate,
    entriesTagged,
    logEntries,
    type LogSource,
} from "@/lib/log-index";

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
    it("numbers the entries in the order they were filed, newest first", () => {
        const entries = logEntries(POSTS);
        expect(entries.map((entry) => entry.number)).toEqual([3, 2, 1]);
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
        expect(tagged.map((entry) => entry.number)).toEqual([2]);
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

describe("formatEntryDate", () => {
    it("prints the day, the month and the year", () => {
        expect(formatEntryDate("2026-03-30")).toBe("30 Mar 2026");
        expect(formatEntryDate("2026-03-06T00:00:00Z")).toBe("6 Mar 2026");
        expect(formatEntryDate("")).toBe("");
        expect(formatEntryDate(null)).toBe("");
    });
});
