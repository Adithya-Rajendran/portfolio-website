import { describe, expect, it } from "vitest";
import {
    buildBlog,
    buildBlogPosting,
    buildPersonEntity,
    buildProfilePage,
} from "@/lib/structured-data";
import { siteConfig, socialProfiles } from "@/lib/config";
import type { IntroData } from "@/lib/sanity-client";
import type { Certification } from "@/sanity.types";

function makeCertification(overrides: Partial<Certification>): Certification {
    return {
        _id: "cert-1",
        _type: "certification",
        _createdAt: "2024-01-01T00:00:00Z",
        _updatedAt: "2024-01-01T00:00:00Z",
        _rev: "rev-1",
        ...overrides,
    };
}

describe("buildPersonEntity — fallbacks (intro null)", () => {
    it("parses jobTitle/org from siteConfig.role", () => {
        const person = buildPersonEntity({ intro: null });
        const [expectedJobTitle, expectedOrg] = siteConfig.role.split(" @ ");

        expect(person.jobTitle).toBe(expectedJobTitle);
        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: expectedOrg,
        });
        expect(person).not.toHaveProperty("memberOf");
    });

    it("falls back to siteConfig.alumniOf when there is no education", () => {
        const person = buildPersonEntity({ intro: null });

        expect(person.alumniOf).toEqual([
            { "@type": "CollegeOrUniversity", name: siteConfig.alumniOf },
        ]);
    });

    it("falls back to siteConfig.knowsAbout", () => {
        const person = buildPersonEntity({ intro: null });

        expect(person.knowsAbout).toEqual(siteConfig.knowsAbout);
    });

    it("sameAs is always socialProfiles", () => {
        const person = buildPersonEntity({ intro: null });

        expect(person.sameAs).toEqual(socialProfiles);
    });
});

describe("buildPersonEntity — intro overrides", () => {
    it("splits intro.role into jobTitle and org", () => {
        const intro: IntroData = {
            _id: "intro",
            role: "MS Student @ Example U",
        };
        const person = buildPersonEntity({ intro });

        expect(person.jobTitle).toBe("MS Student");
        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: "Example U",
        });
    });

    it("uses memberOf (EducationalOrganization) for school affiliation, not worksFor", () => {
        const intro: IntroData = {
            _id: "intro",
            role: "MS Student @ Example U",
            affiliation: {
                name: "Example University",
                url: "https://example.edu",
                kind: "school",
            },
        };
        const person = buildPersonEntity({ intro });

        expect(person.memberOf).toEqual({
            "@type": "EducationalOrganization",
            name: "Example University",
            url: "https://example.edu",
        });
        expect(person).not.toHaveProperty("worksFor");
    });

    it("uses worksFor (Organization) for work affiliation", () => {
        const intro: IntroData = {
            _id: "intro",
            affiliation: {
                name: "Canonical",
                url: "https://canonical.com",
                kind: "work",
            },
        };
        const person = buildPersonEntity({ intro });

        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: "Canonical",
            url: "https://canonical.com",
        });
        expect(person).not.toHaveProperty("memberOf");
    });

    it("maps intro.education to alumniOf CollegeOrUniversity entries", () => {
        const intro: IntroData = {
            _id: "intro",
            education: [
                { name: "UC Santa Cruz", url: "https://ucsc.edu", _key: "a" },
                { name: "Community College", _key: "b" },
            ],
        };
        const person = buildPersonEntity({ intro });

        expect(person.alumniOf).toEqual([
            {
                "@type": "CollegeOrUniversity",
                name: "UC Santa Cruz",
                url: "https://ucsc.edu",
            },
            { "@type": "CollegeOrUniversity", name: "Community College" },
        ]);
    });

    it("uses intro.knowsAbout when non-empty", () => {
        const intro: IntroData = {
            _id: "intro",
            knowsAbout: ["Rust", "eBPF"],
        };
        const person = buildPersonEntity({ intro });

        expect(person.knowsAbout).toEqual(["Rust", "eBPF"]);
    });

    it("falls back to siteConfig.knowsAbout when intro.knowsAbout is empty", () => {
        const intro: IntroData = { _id: "intro", knowsAbout: [] };
        const person = buildPersonEntity({ intro });

        expect(person.knowsAbout).toEqual(siteConfig.knowsAbout);
    });

    it("passes a Sanity-sourced role through untouched, including '<' and '&'", () => {
        const intro: IntroData = {
            _id: "intro",
            role: "R&D <Lead> @ Foo & Co",
        };
        const person = buildPersonEntity({ intro });

        expect(person.jobTitle).toBe("R&D <Lead>");
        expect(person.worksFor).toEqual({
            "@type": "Organization",
            name: "Foo & Co",
        });
    });
});

describe("buildProfilePage — hasCredential", () => {
    it("keeps dateCreated fixed and passes dateModified through untouched", () => {
        const page = buildProfilePage({
            intro: null,
            certifications: [],
            dateModified: "2026-07-10",
        });

        expect(page.dateCreated).toBe("2024-01-01");
        expect(page.dateModified).toBe("2026-07-10");
    });

    it("falls back to the two hardcoded credentials when certifications is empty", () => {
        const page = buildProfilePage({
            intro: null,
            certifications: [],
            dateModified: "2026-07-10",
        });

        expect(page.mainEntity.hasCredential).toHaveLength(2);
        expect(page.mainEntity.hasCredential[0]).toMatchObject({
            name: "AWS Certified Solutions Architect",
        });
    });

    it("maps certifications to EducationalOccupationalCredential entries", () => {
        const certifications = [
            makeCertification({ title: "CKA", org: "CNCF" }),
            makeCertification({ title: "OSCP", org: "Offensive Security" }),
        ];
        const page = buildProfilePage({
            intro: null,
            certifications,
            dateModified: "2026-07-10",
        });

        expect(page.mainEntity.hasCredential).toEqual([
            {
                "@type": "EducationalOccupationalCredential",
                name: "CKA",
                credentialCategory: "certification",
                recognizedBy: { "@type": "Organization", name: "CNCF" },
            },
            {
                "@type": "EducationalOccupationalCredential",
                name: "OSCP",
                credentialCategory: "certification",
                recognizedBy: {
                    "@type": "Organization",
                    name: "Offensive Security",
                },
            },
        ]);
    });

    it("ignores certifications missing a title", () => {
        const certifications = [
            makeCertification({ title: undefined, org: "Nobody" }),
            makeCertification({ title: "CKA", org: "CNCF" }),
        ];
        const page = buildProfilePage({
            intro: null,
            certifications,
            dateModified: "2026-07-10",
        });

        expect(page.mainEntity.hasCredential).toHaveLength(1);
        expect(page.mainEntity.hasCredential[0]).toMatchObject({
            name: "CKA",
        });
    });
});

describe("buildBlogPosting", () => {
    const base = {
        title: "A post",
        description: "A description",
        date: "2026-01-15",
        slug: "a-post",
    };

    it("always includes an absolute post url", () => {
        const post = buildBlogPosting(base);

        expect(post.url).toBe(`${siteConfig.url}/blogs/a-post`);
    });

    it("omits dateModified, keywords, and wordCount when not provided", () => {
        const post = buildBlogPosting(base);

        expect(post).not.toHaveProperty("dateModified");
        expect(post).not.toHaveProperty("keywords");
        expect(post).not.toHaveProperty("wordCount");
    });

    it("includes dateModified when updatedAt is present", () => {
        const post = buildBlogPosting({
            ...base,
            updatedAt: "2026-02-01T00:00:00Z",
        });

        expect(post.dateModified).toBe("2026-02-01T00:00:00Z");
    });

    it("joins tags into keywords when present", () => {
        const post = buildBlogPosting({
            ...base,
            tags: ["kubernetes", "homelab"],
        });

        expect(post.keywords).toBe("kubernetes, homelab");
    });

    it("omits keywords for an empty tags array", () => {
        const post = buildBlogPosting({ ...base, tags: [] });

        expect(post).not.toHaveProperty("keywords");
    });

    it("includes wordCount only when greater than 0", () => {
        expect(buildBlogPosting({ ...base, wordCount: 0 })).not.toHaveProperty(
            "wordCount",
        );
        expect(buildBlogPosting({ ...base, wordCount: 812 }).wordCount).toBe(
            812,
        );
    });

    it("passes title/description through untouched, including '<' characters", () => {
        const post = buildBlogPosting({
            ...base,
            title: "5 < 6 in Kubernetes",
            description: "Uses <script> in the body",
        });

        expect(post.headline).toBe("5 < 6 in Kubernetes");
        expect(post.description).toBe("Uses <script> in the body");
    });
});

describe("buildBlog", () => {
    it("includes its own @context and Blog fields", () => {
        const blog = buildBlog();

        expect(blog["@context"]).toBe("https://schema.org");
        expect(blog["@type"]).toBe("Blog");
        expect(blog.name).toBe(`${siteConfig.author} — Blog`);
        expect(blog.url).toBe(`${siteConfig.url}/blogs`);
        expect(blog.author).toEqual({
            "@type": "Person",
            name: siteConfig.author,
            url: siteConfig.url,
        });
    });
});
