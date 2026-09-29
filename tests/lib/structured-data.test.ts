import { describe, expect, it } from "vitest";
import {
    buildBlog,
    buildBlogPosting,
    buildBreadcrumbList,
    buildContactPage,
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

        expect(person.name).toBe(siteConfig.author);
        expect(person).not.toHaveProperty("jobTitle");
        expect(person).not.toHaveProperty("worksFor");
        expect(person).not.toHaveProperty("alumniOf");
        expect(person).not.toHaveProperty("knowsAbout");
        expect(person).not.toHaveProperty("homeLocation");
        expect(person).not.toHaveProperty("image");
        // Nothing describes the owner until the Profile does.
        expect(person).not.toHaveProperty("description");
        expect(person.sameAs).toEqual(socialProfiles);
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

    it("represents current study without inventing employment or a completed degree", () => {
        const person = buildPersonEntity({
            profile: profileOf({
                headline: "MS Engineering student at San José State University",
                timeline: [
                    {
                        _key: "sjsu",
                        kind: "education",
                        title: "MS Engineering (Interdisciplinary)",
                        organization: "San José State University",
                        startDate: "2026-08-01",
                        expectedEndYear: 2028,
                        isCurrent: true,
                    },
                    {
                        _key: "canonical",
                        kind: "work",
                        title: "Field Software Engineer",
                        organization: "Canonical",
                        startDate: "2025-01-01",
                        endDate: "2026-07-01",
                        isCurrent: false,
                    },
                    {
                        _key: "ucsc",
                        kind: "education",
                        title: "B.S. Computer Science",
                        organization: "UC Santa Cruz",
                        isCurrent: false,
                    },
                ],
            }),
        });

        expect(person).not.toHaveProperty("worksFor");
        expect(person).not.toHaveProperty("jobTitle");
        expect(person.affiliation).toEqual([
            {
                "@type": "CollegeOrUniversity",
                name: "San José State University",
            },
        ]);
        expect(person.alumniOf).toEqual([
            { "@type": "CollegeOrUniversity", name: "UC Santa Cruz" },
        ]);
        expect(JSON.stringify(person)).not.toContain("2028-01-01");
    });

    it("does not revive removed links, skills, schools, or former employment", () => {
        const person = buildPersonEntity({
            profile: profileOf({
                socialLinks: [],
                skillGroups: [],
                timeline: [
                    {
                        _key: "former",
                        kind: "work",
                        title: "Engineer",
                        organization: "Former employer",
                        isCurrent: false,
                    },
                ],
            }),
        });

        expect(person.sameAs).toEqual([]);
        expect(person).not.toHaveProperty("knowsAbout");
        expect(person).not.toHaveProperty("alumniOf");
        expect(person).not.toHaveProperty("worksFor");
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
            profile: {
                ...profile,
                _createdAt: "2025-02-03T10:00:00Z",
                _updatedAt: "2026-07-11T08:00:00Z",
            },
        });

        expect(page.dateCreated).toBe("2025-02-03");
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
        });
        expect(page.mainEntity).not.toHaveProperty("hasCredential");
    });

    it("leaves out a date the profile document does not carry", () => {
        const page = buildProfilePage({ profile: profileOf() });
        expect(page).not.toHaveProperty("dateCreated");
        expect(page).not.toHaveProperty("dateModified");
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
            revisedAt: "2026-02-01",
            tags: ["documentary", "notes"],
            wordCount: 812,
        });
        expect(post.dateModified).toBe("2026-02-01");
        expect(post.keywords).toBe("documentary, notes");
        expect(post.wordCount).toBe(812);
    });

    it("dates a modification only from a recorded revision", () => {
        expect(
            buildBlogPosting({ ...base, revisedAt: null }),
        ).not.toHaveProperty("dateModified");
    });

    it("names the share image at its built URL, or the cover when there is one", () => {
        expect(buildBlogPosting(base).image).toMatch(
            new RegExp(
                `^${siteConfig.url}/blog/a-post/opengraph-image-[a-z0-9]+$`,
            ),
        );
        expect(
            buildBlogPosting({
                ...base,
                imageUrl: "https://cdn.sanity.io/images/x/y/cover.jpg",
            }).image,
        ).toBe("https://cdn.sanity.io/images/x/y/cover.jpg");
    });

    it("belongs to the blog", () => {
        expect(buildBlogPosting(base).isPartOf).toEqual({
            "@type": "Blog",
            "@id": `${siteConfig.url}/blog`,
        });
    });

    it("omits empty tags and a zero word count", () => {
        const post = buildBlogPosting({ ...base, tags: [], wordCount: 0 });
        expect(post).not.toHaveProperty("keywords");
        expect(post).not.toHaveProperty("wordCount");
    });
});

describe("buildBreadcrumbList", () => {
    it("lists Home, the section and the page in order, as absolute URLs", () => {
        const list = buildBreadcrumbList([
            { name: "Home", path: "/" },
            { name: "Flight Log", path: "/blog" },
            { name: "A post", path: "/blog/a-post" },
        ]);
        expect(list["@type"]).toBe("BreadcrumbList");
        expect(list.itemListElement).toEqual([
            {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: siteConfig.url,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: "Flight Log",
                item: `${siteConfig.url}/blog`,
            },
            {
                "@type": "ListItem",
                position: 3,
                name: "A post",
                item: `${siteConfig.url}/blog/a-post`,
            },
        ]);
    });
});

describe("buildBlog", () => {
    it("uses the CMS writing introduction", () => {
        const blog = buildBlog(
            profileOf({ writingDescription: "Research notes from the lab." }),
        );
        expect(blog.description).toBe("Research notes from the lab.");
    });

    it("keeps the writing metadata aligned with the public blog description", () => {
        const blog = buildBlog();
        expect(blog["@context"]).toBe("https://schema.org");
        expect(blog["@type"]).toBe("Blog");
        expect(blog.name).toBe(`${siteConfig.author} — Blog`);
        expect(blog.url).toBe(`${siteConfig.url}/blog`);
        expect(blog).not.toHaveProperty("description");
    });
});

describe("buildContactPage", () => {
    it("describes /contact as a ContactPage about the person, with the profile's links", () => {
        const page = buildContactPage(
            profileOf({
                contactInvitation: "Working on robotic vision?",
                socialLinks: [
                    {
                        _key: "linkedin",
                        label: "LinkedIn",
                        url: "https://www.linkedin.com/in/adithya-rajendran",
                    },
                ],
            }),
        );
        expect(page["@type"]).toBe("ContactPage");
        expect(page.url).toBe(`${siteConfig.url}/contact`);
        expect(page.description).toBe("Working on robotic vision?");
        expect(page.about).toEqual({
            "@type": "Person",
            name: "Adithya Rajendran",
            url: siteConfig.url,
            sameAs: ["https://www.linkedin.com/in/adithya-rajendran"],
        });
    });

    it("never publishes an email address, a phone number or a contact point", () => {
        // The form is the only channel: no public email or phone anywhere.
        const json = JSON.stringify(
            buildContactPage(
                profileOf({
                    socialLinks: [
                        {
                            _key: "mail",
                            label: "Email",
                            url: "mailto:someone@example.com",
                        },
                    ],
                }),
            ),
        );
        for (const key of ["email", "telephone", "contactPoint", "faxNumber"]) {
            expect(json).not.toContain(`"${key}"`);
        }
        expect(json).not.toMatch(/mailto:|tel:/);
    });

    it("uses the page's introduction without an invitation, and nothing without either", () => {
        expect(
            buildContactPage(
                profileOf({ contactIntro: "An idea or a question." }),
            ).description,
        ).toBe("An idea or a question.");
        const page = buildContactPage();
        expect(page).not.toHaveProperty("description");
        expect(page.about.sameAs).toEqual(socialProfiles);
    });
});
