import { describe, expect, it } from "vitest";
import { selectNextPosts } from "@/lib/related-posts";
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

const current = { slug: "current", tags: ["robotics", "vision"] };

describe("selectNextPosts", () => {
    it("prefers shared topics, then newer writing, without repeating the current article", () => {
        const posts = [
            post("current", "2026-09-10", ["robotics", "vision"]),
            post("unrelated", "2026-09-09"),
            post("older-related", "2026-08-01", ["robotics"]),
            post("related", "2026-09-01", ["vision"]),
            post("closest", "2026-07-01", ["robotics", "vision"]),
        ];
        expect(
            selectNextPosts(posts, current).map((item) => item.slug),
        ).toEqual(["closest", "related"]);
    });

    it("falls back to the latest eligible notes and leaves the supplied list unchanged", () => {
        const posts = [
            post("older", "2026-07-01"),
            post("newer", "2026-08-01"),
            post("", "2026-09-01"),
            post("undated", ""),
        ];
        const original = [...posts];
        expect(
            selectNextPosts(posts, current).map((item) => item.slug),
        ).toEqual(["newer", "older"]);
        expect(posts).toEqual(original);
    });

    it("does not count a duplicated tag as stronger relevance", () => {
        const posts = [
            post("duplicate-tag", "2026-09-10", [
                "robotics",
                "robotics",
                "robotics",
            ]),
            post("both-topics", "2026-07-01", ["robotics", "vision"]),
        ];
        expect(selectNextPosts(posts, current)[0].slug).toBe("both-topics");
    });

    it("handles the first article and untagged articles", () => {
        expect(
            selectNextPosts([post("current", "2026-09-10")], current),
        ).toEqual([]);
        expect(
            selectNextPosts([post("next", "2026-09-10")], {
                slug: "current",
                tags: null,
            })[0].slug,
        ).toBe("next");
    });
});
