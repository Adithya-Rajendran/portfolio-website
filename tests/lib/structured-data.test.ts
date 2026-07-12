import { describe, expect, it } from "vitest";
import {
    buildBlog,
    buildBlogPosting,
    buildPersonEntity,
    buildProfilePage,
} from "@/lib/structured-data";
import { siteConfig, socialProfiles } from "@/lib/config";
import type { CredentialListItem, ProfileData } from "@/lib/sanity-client";

function profileOf(overrides: Partial<ProfileData> = {}): ProfileData {
    return {
        _id: "profile",
        name: "Adithya Rajendran",
        headline: "Cloud Field Engineer @ Canonical",
        introduction: "A personal introduction.",
        bio: "A longer biography.",
        ...overrides,
    };
}

function credentialOf(
    overrides: Partial<CredentialListItem> = {},
): CredentialListItem {
    return {
        _key: "credential-1",
        _type: "credential",
        title: "CKA",
        issuer: "CNCF",
        issuedOn: "2025-01-01",
        lifetime: false,
        expiresOn: "2028-01-01",
        verificationUrl: "https://example.com/verify",
        lifecycleStatus: "active",
        ...overrides,
    };
}

describe("buildPersonEntity", () => {
    it("uses stable personal fallbacks before the Profile exists", () => {
        const person = buildPersonEntity({ profile: null });
        const [jobTitle, organization] = siteConfig.role.split(" @ ");

        expect(person.name).toBe(siteConfig.author);
        expect(person.jobTitle).toBe(jobTitle);
        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: organization,
        });
        expect(person.alumniOf).toEqual([
            { "@type": "CollegeOrUniversity", name: siteConfig.alumniOf },
        ]);
        expect(person.knowsAbout).toEqual(siteConfig.knowsAbout);
        expect(person.sameAs).toEqual(socialProfiles);
        expect(person.sameAs).toContain(
            "https://app.hackthebox.com/users/514798",
        );
    });

    it("derives current work, education, skills, links, and location from Profile", () => {
        const profile = profileOf({
            location: "Remote · United States",
            socialLinks: [
                {
                    _key: "github",
                    _type: "externalLink",
                    label: "GitHub",
                    url: "https://github.com/Adithya-Rajendran",
                },
                {
                    _key: "hackthebox",
                    _type: "externalLink",
                    label: "Hack The Box",
                    url: "https://app.hackthebox.com/users/514798",
                },
            ],
            timeline: [
                {
                    _key: "work",
                    _type: "timelineEntry",
                    kind: "work",
                    title: "Cloud Field Engineer",
                    organization: "Canonical",
                    startDate: "2025-01-01",
                },
                {
                    _key: "school",
                    _type: "timelineEntry",
                    kind: "education",
                    title: "B.S. Computer Science",
                    organization: "UC Santa Cruz",
                    startDate: "2023-06-01",
                    endDate: "2023-06-01",
                },
            ],
            skillGroups: [
                {
                    _key: "cloud",
                    _type: "skillGroup",
                    title: "Cloud",
                    skills: ["Kubernetes", "OpenStack", "Kubernetes"],
                },
            ],
        });
        const person = buildPersonEntity({
            profile,
            imageUrl: "https://cdn.sanity.io/profile.webp",
        });

        expect(person.jobTitle).toBe("Cloud Field Engineer");
        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: "Canonical",
        });
        expect(person.alumniOf).toEqual([
            { "@type": "CollegeOrUniversity", name: "UC Santa Cruz" },
        ]);
        expect(person.knowsAbout).toEqual(["Kubernetes", "OpenStack"]);
        expect(person.sameAs).toEqual([
            "https://github.com/Adithya-Rajendran",
            "https://app.hackthebox.com/users/514798",
        ]);
        expect(person.homeLocation).toEqual({
            "@type": "Place",
            name: "Remote · United States",
        });
        expect(person.image).toBe("https://cdn.sanity.io/profile.webp");
    });

    it("passes CMS prose through for safe escaping at the script boundary", () => {
        const person = buildPersonEntity({
            profile: profileOf({
                introduction: "Curious about 5 < 6 & personal documentaries.",
            }),
        });

        expect(person.description).toBe(
            "Curious about 5 < 6 & personal documentaries.",
        );
    });
});

describe("buildProfilePage", () => {
    it("maps Profile credentials and keeps lifetime credentials open-ended", () => {
        const profile = profileOf({
            credentials: [
                credentialOf({ credentialId: "CKA-123" }),
                credentialOf({
                    _key: "lifetime",
                    title: "Lifetime credential",
                    lifetime: true,
                    expiresOn: null,
                    lifecycleStatus: "lifetime",
                }),
            ],
        });
        const page = buildProfilePage({
            profile,
            dateModified: "2026-07-11",
        });

        expect(page.dateModified).toBe("2026-07-11");
        expect(page.mainEntity.hasCredential).toHaveLength(2);
        expect(page.mainEntity.hasCredential?.[0]).toMatchObject({
            name: "CKA",
            validFrom: "2025-01-01",
            validUntil: "2028-01-01",
            identifier: "CKA-123",
            url: "https://example.com/verify",
        });
        expect(page.mainEntity.hasCredential?.[1]).not.toHaveProperty(
            "validUntil",
        );
    });

    it("omits credentials when Profile has none", () => {
        const page = buildProfilePage({
            profile: profileOf({ credentials: [] }),
            dateModified: "2026-07-11",
        });
        expect(page.mainEntity).not.toHaveProperty("hasCredential");
    });
});

describe("buildBlogPosting", () => {
    const base = {
        title: "A post",
        description: "A description",
        publishedAt: "2026-01-15T09:45:00.000Z",
        slug: "a-post",
    };

    it("uses publishedAt and an absolute canonical URL", () => {
        const post = buildBlogPosting(base);
        expect(post.datePublished).toBe(base.publishedAt);
        expect(post.url).toBe(`${siteConfig.url}/blog/a-post`);
    });

    it("adds optional article metadata only when supplied", () => {
        expect(buildBlogPosting(base)).not.toHaveProperty("dateModified");
        const post = buildBlogPosting({
            ...base,
            updatedAt: "2026-02-01T00:00:00Z",
            tags: ["documentary", "notes"],
            wordCount: 812,
        });
        expect(post.dateModified).toBe("2026-02-01T00:00:00Z");
        expect(post.keywords).toBe("documentary, notes");
        expect(post.wordCount).toBe(812);
    });

    it("omits empty tags and a zero word count", () => {
        const post = buildBlogPosting({ ...base, tags: [], wordCount: 0 });
        expect(post).not.toHaveProperty("keywords");
        expect(post).not.toHaveProperty("wordCount");
    });
});

describe("buildBlog", () => {
    it("describes the route as a broad personal Blog", () => {
        const blog = buildBlog();
        expect(blog["@context"]).toBe("https://schema.org");
        expect(blog["@type"]).toBe("Blog");
        expect(blog.name).toBe(`${siteConfig.author} — Blog`);
        expect(blog.url).toBe(`${siteConfig.url}/blog`);
        expect(blog.description).toMatch(/Personal writing/);
    });
});
