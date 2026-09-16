import { describe, expect, it } from "vitest";
import {
    getProfileDescription,
    getProfileLink,
    getProfileLinks,
    getWritingDescription,
    isCurrentTimelineEntry,
    selectFeaturedPost,
} from "@/lib/profile-content";
import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";
import type {
    PostListItem,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

function profileOf(overrides: Partial<ProfileData> = {}): ProfileData {
    return {
        _id: "profile",
        name: "Adithya Rajendran",
        headline: "Engineering student",
        introduction: "Learning, building, and writing.",
        bio: "A longer biography.",
        ...overrides,
    };
}

function entryOf(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
    return {
        _key: "study",
        kind: "education",
        title: "MS Engineering (Interdisciplinary)",
        organization: "San José State University",
        ...overrides,
    };
}

function postOf(overrides: Partial<PostListItem> = {}): PostListItem {
    return {
        _id: "post-1",
        title: "A published note",
        slug: "a-published-note",
        description: "Notes from an experiment.",
        publishedAt: "2026-01-01",
        wordCount: 400,
        ...overrides,
    };
}

describe("CMS profile links", () => {
    it("honors removal without reviving fallback accounts", () => {
        expect(getProfileLinks(profileOf({ socialLinks: [] }))).toEqual([]);
        expect(getProfileLinks(profileOf())).toEqual([]);
        expect(
            getProfileLink(profileOf({ socialLinks: [] }), "linkedin"),
        ).toBeUndefined();
        expect(getProfileLinks(null)).toHaveLength(2);
    });

    it("recognizes edited labels by host and rejects misleading hosts", () => {
        const profile = profileOf({
            socialLinks: [
                { _key: "invalid", label: "LinkedIn", url: "not a URL" },
                {
                    _key: "fake",
                    label: "LinkedIn",
                    url: "https://linkedin.com.example.com/me",
                },
                {
                    _key: "real",
                    label: "Connect with me",
                    url: "https://www.linkedin.com/in/adithya-rajendran",
                },
                {
                    _key: "code",
                    label: "My code",
                    url: "https://github.com/Adithya-Rajendran",
                },
            ],
        });
        expect(getProfileLink(profile, "linkedin")?._key).toBe("real");
        expect(getProfileLink(profile, "github")?._key).toBe("code");
    });
});

describe("CMS descriptions", () => {
    it("uses editorial overrides, then introduction, then neutral copy", () => {
        expect(
            getProfileDescription(
                profileOf({
                    seoDescription: "Current research and experience.",
                }),
            ),
        ).toBe("Current research and experience.");
        expect(getProfileDescription(profileOf({ seoDescription: "  " }))).toBe(
            "Learning, building, and writing.",
        );
        expect(getProfileDescription(null)).toBe(siteConfig.description);
        expect(
            getWritingDescription(
                profileOf({ writingDescription: "Robotics lab notes." }),
            ),
        ).toBe("Robotics lab notes.");
        expect(
            getWritingDescription(profileOf({ writingDescription: "  " })),
        ).toBe(BLOG_DESCRIPTION);
    });
});

describe("current work and study", () => {
    it("preserves explicit former status when dates are unknown", () => {
        expect(
            isCurrentTimelineEntry(entryOf({ kind: "work", isCurrent: false })),
        ).toBe(false);
        expect(
            isCurrentTimelineEntry(
                entryOf({ isCurrent: true, expectedEndYear: 2028 }),
            ),
        ).toBe(true);
    });

    it("supports older entries whose status is represented by dates", () => {
        expect(isCurrentTimelineEntry(entryOf({ endDate: "2023-06-01" }))).toBe(
            false,
        );
        expect(
            isCurrentTimelineEntry(entryOf({ startDate: "2026-08-01" })),
        ).toBe(true);
    });
});

describe("homepage article selection", () => {
    const older = postOf();
    const latest = postOf({
        _id: "post-2",
        slug: "newer-note",
        publishedAt: "2026-03-01",
    });

    it("curates a published article by ID without depending on its slug", () => {
        expect(
            selectFeaturedPost(profileOf({ featuredPostId: older._id }), [
                latest,
                older,
            ]),
        ).toBe(older);
    });

    it("falls back to the newest published article when the reference is absent or unavailable", () => {
        expect(
            selectFeaturedPost(
                profileOf({ featuredPostId: "unpublished-or-deleted" }),
                [older, latest],
            ),
        ).toBe(latest);
        expect(selectFeaturedPost(null, [older, latest])).toBe(latest);
    });

    it("does not create unusable article links from an empty or malformed list", () => {
        expect(selectFeaturedPost(null, [])).toBeUndefined();
        expect(
            selectFeaturedPost(profileOf({ featuredPostId: "invalid" }), [
                postOf({ _id: "invalid", slug: "" }),
                latest,
            ]),
        ).toBe(latest);
    });
});
