import { describe, expect, it } from "vitest";
import {
    entriesTagged,
    entryCount,
    logEntries,
    logSince,
    monthLabel,
    type LogSource,
} from "@/lib/log-index";
import { groupPostsByYear } from "@/lib/tags";
import { transmissions } from "@/lib/transmissions";

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

    it("drops tags that are not a valid tag page and has no read time for an empty body", () => {
        const [entry] = logEntries([
            { ...POSTS[0], tags: ["homelab", "Not A Tag"], wordCount: 0 },
        ]);
        expect(entry.tags).toEqual(["homelab"]);
        expect(entry.readMinutes).toBeNull();
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
    it("prints months, the first month and counts", () => {
        expect(monthLabel("2026-03-06")).toBe("Mar 2026");
        expect(monthLabel("")).toBe("");
        expect(logSince(logEntries(POSTS))).toBe("Mar 2026");
        expect(logSince([])).toBe("");
        expect(entryCount(1)).toBe("1 entry");
        expect(entryCount(3)).toBe("3 entries");
    });
});

describe("transmissions", () => {
    const chart = transmissions(logEntries(POSTS), "2026-09-28")!;

    it("runs from the first month to a few days past today", () => {
        expect(chart.from).toBe("Mar 2026");
        expect(chart.ticks[0]).toMatchObject({
            x: 0,
            label: "Mar 2026",
            year: true,
        });
        expect(chart.ticks.map((tick) => tick.label)).toEqual([
            "Mar 2026",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
        ]);
        expect(chart.ticks.filter((tick) => tick.minor)).toHaveLength(3);
        // 211 of 215 days: the mockup's 98.14 %.
        expect(chart.now).toBe(98.14);
        expect(chart.entries).toBe(3);
        expect(chart.words).toBe(2863);
    });

    it("places each entry by date, tallest for the longest read", () => {
        expect(
            chart.marks.map(({ number, x, h, latest }) => ({
                number,
                x,
                h,
                latest,
            })),
        ).toEqual([
            { number: "003", x: 13.49, h: 1, latest: true },
            { number: "002", x: 11.63, h: 0.56, latest: false },
            { number: "001", x: 2.33, h: 0.34, latest: false },
        ]);
    });

    it("sets a label to the left when the next entry is close", () => {
        expect(chart.marks.map((mark) => mark.labelLeft)).toEqual([
            false,
            true,
            false,
        ]);
    });

    it("opens a tip to the left right of the middle", () => {
        expect(chart.marks.map((mark) => mark.tipLeft)).toEqual([
            false,
            false,
            false,
        ]);
        const late = transmissions(
            logEntries([{ ...POSTS[0], publishedAt: "2026-08-30" }, POSTS[2]]),
            "2026-09-28",
        )!;
        expect(late.marks.map((mark) => mark.tipLeft)).toEqual([true, false]);
    });

    it("draws full-height marks when every read is as long", () => {
        const even = transmissions(
            logEntries(POSTS.map((post) => ({ ...post, wordCount: 100 }))),
            "2026-09-28",
        )!;
        expect(even.marks.map((mark) => mark.h)).toEqual([1, 1, 1]);
    });

    it("ticks only years over a long span", () => {
        const long = transmissions(
            logEntries([{ ...POSTS[2], publishedAt: "2023-11-02" }, POSTS[0]]),
            "2026-09-28",
        )!;
        expect(long.ticks.map((tick) => tick.label)).toEqual([
            "Nov 2023",
            "Jan 2024",
            "Jan 2025",
            "Jan 2026",
        ]);
        expect(long.ticks.every((tick) => tick.year && !tick.minor)).toBe(true);
    });

    it("keeps an entry filed after the cached today on the axis", () => {
        const ahead = transmissions(logEntries(POSTS), "2026-03-29")!;
        expect(Math.max(...ahead.marks.map((mark) => mark.x))).toBeLessThan(
            100,
        );
        expect(ahead.now).toBeLessThan(ahead.marks[0].x);
    });

    it("is empty without a dated entry", () => {
        expect(transmissions([], "2026-09-28")).toBeNull();
        expect(transmissions(logEntries(POSTS), "today")).toBeNull();
    });
});
