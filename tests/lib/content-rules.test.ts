import { describe, expect, it } from "vitest";
import { newestFirst } from "@/lib/content-rules";

describe("newestFirst", () => {
    it("orders mixed personal posts by publishedAt without mutating input", () => {
        const posts = [
            { title: "Middle", publishedAt: "2026-05-12T09:30:00Z" },
            { title: "Newest", publishedAt: "2026-06-26T12:00:00Z" },
            { title: "Oldest", publishedAt: "2026-04-02T18:00:00Z" },
        ];

        expect(newestFirst(posts).map(({ title }) => title)).toEqual([
            "Newest",
            "Middle",
            "Oldest",
        ]);
        expect(posts[0].title).toBe("Middle");
    });
});
