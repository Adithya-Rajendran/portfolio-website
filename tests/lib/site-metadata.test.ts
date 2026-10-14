import { describe, expect, it } from "vitest";
import { siteConfig } from "@/lib/config";
import type { ProfileData } from "@/lib/sanity-client";
import {
    OG_CONTENT_TYPE,
    OG_SIZE,
    homeCardAlt,
    notFoundMetadata,
    shareImage,
    siteOpenGraph,
} from "@/lib/site-metadata";

function profileOf(overrides: Partial<ProfileData> = {}): ProfileData {
    return {
        _id: "profile",
        name: "Adithya Rajendran",
        headline: "",
        introduction: "",
        bio: "",
        ...overrides,
    };
}

describe("shareImage", () => {
    it("names a post's card at its built URL, with the page's own alt", () => {
        expect(
            shareImage(
                "app/(site)/blog/[slug]/opengraph-image.tsx",
                "A post by Adithya Rajendran",
                "a-post",
            ),
        ).toEqual({
            url: expect.stringMatching(
                /^\/blog\/a-post\/opengraph-image-[a-z0-9]+$/,
            ),
            alt: "A post by Adithya Rajendran",
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            type: OG_CONTENT_TYPE,
        });
    });

    it("names home's card at its built URL", () => {
        expect(
            shareImage("app/(site)/opengraph-image.tsx", "Home").url,
        ).toMatch(/^\/opengraph-image-[a-z0-9]+$/);
    });
});

describe("notFoundMetadata", () => {
    it("is never indexed and names no canonical", () => {
        expect(notFoundMetadata.robots).toEqual({
            index: false,
            follow: false,
        });
        expect(notFoundMetadata.alternates.canonical).toBeNull();
    });
});

describe("siteOpenGraph", () => {
    it("carries the profile's description only when it has one", () => {
        expect(siteOpenGraph(null)).toEqual({
            title: siteConfig.title,
            url: siteConfig.url,
            siteName: "Adithya Rajendran",
            locale: "en_US",
            type: "website",
        });
        expect(
            siteOpenGraph(profileOf({ introduction: " An introduction. " })),
        ).toMatchObject({ description: "An introduction." });
    });
});

describe("homeCardAlt", () => {
    it("says the name, the headline and the openings", () => {
        expect(
            homeCardAlt(
                profileOf({
                    headline: "Cloud Field Engineer",
                    availability: {
                        status: "open",
                        seeking: [
                            { _key: "a", label: "Summer 2027 internships" },
                            { _key: "b", label: "Full-time roles" },
                        ],
                        updatedAt: "2026-09-24",
                    },
                }),
            ),
        ).toBe(
            "Adithya Rajendran — Cloud Field Engineer. Open to Summer 2027 internships · Full-time roles",
        );
    });

    it("leaves out what the profile leaves empty", () => {
        expect(homeCardAlt(null)).toBe(siteConfig.author);
        expect(
            homeCardAlt(
                profileOf({
                    headline: " ",
                    availability: {
                        status: "closed",
                        seeking: [{ _key: "a", label: "Summer 2027" }],
                        updatedAt: "2026-09-24",
                    },
                }),
            ),
        ).toBe("Adithya Rajendran");
    });
});
