import { describe, expect, it } from "vitest";
import {
    credentialLifecycle,
    hasVisibleItems,
    newestFirst,
} from "@/lib/content-rules";

describe("hasVisibleItems", () => {
    it("hides missing and empty CMS arrays", () => {
        expect(hasVisibleItems(undefined)).toBe(false);
        expect(hasVisibleItems(null)).toBe(false);
        expect(hasVisibleItems([])).toBe(false);
    });

    it("shows a section only after real content exists", () => {
        expect(hasVisibleItems([{ _key: "one" }])).toBe(true);
    });
});

describe("credentialLifecycle", () => {
    const today = "2026-07-11";

    it("keeps lifetime credentials distinct from dated credentials", () => {
        expect(
            credentialLifecycle({ lifetime: true, expiresOn: null }, today),
        ).toBe("lifetime");
    });

    it("marks only dates before today as expired", () => {
        expect(credentialLifecycle({ expiresOn: "2025-08-01" }, today)).toBe(
            "expired",
        );
        expect(credentialLifecycle({ expiresOn: "2026-07-11" }, today)).toBe(
            "active",
        );
        expect(credentialLifecycle({ expiresOn: "2026-09-01" }, today)).toBe(
            "active",
        );
    });
});

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
