import { describe, expect, it } from "vitest";
import { logEntries } from "@/lib/log-index";
import { adjacentEntries, relatedEntries } from "@/lib/related-posts";
import type { PostListItem } from "@/lib/sanity-client";

function post(
    slug: string,
    publishedAt: string,
    tags: string[] = [],
): PostListItem {
    return {
        _id: slug,
        title: slug,
        slug,
        description: "",
        publishedAt,
        tags,
        wordCount: 100,
    };
}

/** LOG 001 … 005, oldest first. */
const entries = logEntries([
    post("e5", "2026-09-10", ["robotics", "vision"]),
    post("e4", "2026-09-09"),
    post("e3", "2026-08-01", ["robotics"]),
    post("e2", "2026-07-01", ["vision", "robotics"]),
    post("e1", "2026-06-01", ["vision"]),
]);

describe("adjacentEntries", () => {
    it("gives the entries filed just before and after, by LOG number", () => {
        const { previous, next } = adjacentEntries(entries, "e3");
        expect(previous?.slug).toBe("e2");
        expect(next?.slug).toBe("e4");
    });

    it("has no previous entry for the first and no next for the latest", () => {
        expect(adjacentEntries(entries, "e1").previous).toBeNull();
        expect(adjacentEntries(entries, "e5").next).toBeNull();
    });

    it("finds nothing for an entry that is not in the list", () => {
        expect(adjacentEntries(entries, "missing")).toEqual({
            previous: null,
            next: null,
        });
    });
});

describe("relatedEntries", () => {
    it("ranks by shared tags, then newest, and never repeats the pager", () => {
        expect(
            relatedEntries(entries, "e5", { exclude: ["e4"] }).map(
                (entry) => entry.slug,
            ),
        ).toEqual(["e2", "e3", "e1"]);
        expect(
            relatedEntries(entries, "e5", { exclude: ["e2"] }).map(
                (entry) => entry.slug,
            ),
        ).toEqual(["e3", "e1"]);
    });

    it("pads nothing in when no other entry shares a tag", () => {
        expect(relatedEntries(entries, "e4")).toEqual([]);
        expect(
            relatedEntries(
                logEntries([
                    post("a", "2026-01-01", ["homelab"]),
                    post("b", "2026-02-01", ["linux"]),
                ]),
                "a",
            ),
        ).toEqual([]);
    });

    it("keeps to the limit", () => {
        expect(relatedEntries(entries, "e5", { limit: 1 })).toHaveLength(1);
    });
});
