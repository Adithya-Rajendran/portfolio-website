import { describe, expect, it } from "vitest";
import {
    availabilityLine,
    formatTimelineDate,
    getProfileDescription,
    getProfileLink,
    getProfileLinks,
    getWritingDescription,
    isCurrentTimelineEntry,
    selectFeaturedPost,
} from "@/lib/profile-content";
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
    it("uses editorial overrides, then introduction, then nothing", () => {
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
        expect(
            getProfileDescription(
                profileOf({ seoDescription: "", introduction: " " }),
            ),
        ).toBeNull();
        expect(getProfileDescription(null)).toBeNull();
        expect(
            getWritingDescription(
                profileOf({ writingDescription: "Robotics lab notes." }),
            ),
        ).toBe("Robotics lab notes.");
        expect(
            getWritingDescription(profileOf({ writingDescription: "  " })),
        ).toBeNull();
        expect(getWritingDescription(null)).toBeNull();
    });
});

describe("availabilityLine", () => {
    it("joins the Open To lines as written", () => {
        expect(
            availabilityLine({
                status: "open",
                seeking: [
                    { _key: "a", label: " Summer 2027 internships " },
                    { _key: "b", label: "" },
                    { _key: "c", label: "Full-time opportunities in 2028" },
                ],
                updatedAt: "2026-09-24",
            }),
        ).toBe("Summer 2027 internships · Full-time opportunities in 2028");
    });

    it("falls back to the older single line only while there are no lines", () => {
        expect(
            availabilityLine({
                status: "selective",
                seeking: [],
                openTo: "Research internships",
                updatedAt: "2026-09-24",
            }),
        ).toBe("Research internships");
        expect(
            availabilityLine({
                status: "open",
                seeking: [{ _key: "a", label: "Summer 2027 internships" }],
                openTo: "Older line",
                updatedAt: "2026-09-24",
            }),
        ).toBe("Summer 2027 internships");
    });

    it("says nothing while availability is unset, empty or Closed", () => {
        expect(availabilityLine(null)).toBeNull();
        expect(
            availabilityLine({ status: "open", updatedAt: "2026-09-24" }),
        ).toBeNull();
        expect(
            availabilityLine({
                status: "closed",
                seeking: [{ _key: "a", label: "Summer 2027 internships" }],
                updatedAt: "2026-09-24",
            }),
        ).toBeNull();
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

describe("timeline dates", () => {
    it("prints month and year for full dates and year-month values", () => {
        expect(formatTimelineDate("2023-06-01")).toBe("Jun 2023");
        expect(formatTimelineDate("2026-08")).toBe("Aug 2026");
        expect(formatTimelineDate("2024-05-01", "month")).toBe("May 2024");
    });

    it("never adds a month to a date known only to the year", () => {
        expect(formatTimelineDate("2019-01-01", "year")).toBe("2019");
        expect(formatTimelineDate("2019-09-23", "year")).toBe("2019");
        expect(formatTimelineDate("2019")).toBe("2019");
    });

    it("leaves missing and unparseable values alone", () => {
        expect(formatTimelineDate(null)).toBeNull();
        expect(formatTimelineDate(undefined, "year")).toBeNull();
        expect(formatTimelineDate("Summer 2027")).toBe("Summer 2027");
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
