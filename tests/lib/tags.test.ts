import { describe, expect, it } from "vitest";
import { collectTags, filterPostsByTag, groupPostsByYear } from "@/lib/tags";

describe("collectTags", () => {
    it("counts tags across posts and sorts by count desc, then alpha", () => {
        const tags = collectTags([
            { tags: ["kubernetes", "homelab"] },
            { tags: ["kubernetes", "security"] },
            { tags: ["kubernetes", "homelab"] },
        ]);

        expect(tags).toEqual([
            { tag: "kubernetes", count: 3 },
            { tag: "homelab", count: 2 },
            { tag: "security", count: 1 },
        ]);
    });

    it("breaks count ties alphabetically", () => {
        const tags = collectTags([{ tags: ["zfs", "ansible"] }]);

        expect(tags.map((t) => t.tag)).toEqual(["ansible", "zfs"]);
    });

    it("ignores posts without tags (pre-taxonomy posts stay valid)", () => {
        const tags = collectTags([
            {},
            { tags: undefined },
            { tags: ["openstack"] },
        ]);

        expect(tags).toEqual([{ tag: "openstack", count: 1 }]);
    });

    it("drops tags that fail the slug-safe pattern", () => {
        const tags = collectTags([
            { tags: ["Valid-Not", "k8s", "spaces here", "ai-infra"] },
        ]);

        expect(tags.map((t) => t.tag)).toEqual(["ai-infra", "k8s"]);
    });
});

describe("filterPostsByTag", () => {
    it("matches the exact tag only", () => {
        const posts = [
            { tags: ["kubernetes"] },
            { tags: ["kubernetes-networking"] },
            { tags: undefined },
        ];

        expect(filterPostsByTag(posts, "kubernetes")).toEqual([
            { tags: ["kubernetes"] },
        ]);
    });
});

describe("groupPostsByYear", () => {
    it("groups by year, newest year first, preserving input order within a year", () => {
        const groups = groupPostsByYear([
            { date: "2026-05-01" },
            { date: "2026-01-15" },
            { date: "2025-11-30" },
        ]);

        expect(groups).toEqual([
            {
                year: "2026",
                posts: [{ date: "2026-05-01" }, { date: "2026-01-15" }],
            },
            { year: "2025", posts: [{ date: "2025-11-30" }] },
        ]);
    });

    it("keeps posts with identical dates", () => {
        const groups = groupPostsByYear([
            { date: "2026-05-01" },
            { date: "2026-05-01" },
        ]);

        expect(groups[0].posts).toHaveLength(2);
    });

    it("collects malformed or missing dates into a trailing Undated group", () => {
        const groups = groupPostsByYear([
            { date: "not-a-date" },
            { date: "2026-05-01" },
            { date: undefined },
        ]);

        expect(groups.map((g) => g.year)).toEqual(["2026", "Undated"]);
        expect(groups[1].posts).toHaveLength(2);
    });
});
