/**
 * Pure schema.org builders for the site's JSON-LD. Fetching and script-tag
 * escaping live in components/json-ld.tsx so these functions stay easy to
 * exercise without React or a Sanity connection.
 */
import { siteConfig } from "@/lib/config";
import {
    getProfileDescription,
    getProfileLinks,
    getWritingDescription,
    isCurrentTimelineEntry,
} from "@/lib/profile-content";
import type {
    CredentialListItem,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

export interface PersonEntityInput {
    profile: ProfileData | null;
    imageUrl?: string;
}

function currentWork(timeline?: TimelineEntry[] | null) {
    return (timeline ?? []).find(
        (entry) => entry.kind === "work" && isCurrentTimelineEntry(entry),
    );
}

function educationOrganizations(profile: ProfileData | null, current: boolean) {
    const names = (profile?.timeline ?? [])
        .filter(
            (entry) =>
                entry.kind === "education" &&
                entry.organization &&
                isCurrentTimelineEntry(entry) === current,
        )
        .map((entry) => entry.organization);
    return [...new Set(names)].map((name) => ({
        "@type": "CollegeOrUniversity",
        name,
    }));
}

function buildKnowsAbout(profile: ProfileData | null) {
    const skills = (profile?.skillGroups ?? []).flatMap(
        (group) => group.skills ?? [],
    );
    return [...new Set(skills.filter(Boolean))];
}

function buildSameAs(profile: ProfileData | null) {
    return [
        ...new Set(
            getProfileLinks(profile)
                .map((link) => link.url)
                .filter(Boolean),
        ),
    ];
}

function buildHasCredential(credentials?: CredentialListItem[] | null) {
    return (credentials ?? [])
        .filter((credential) => credential.title && credential.issuer)
        .map((credential) => ({
            "@type": "EducationalOccupationalCredential",
            name: credential.title,
            credentialCategory: "certification",
            recognizedBy: {
                "@type": "Organization",
                name: credential.issuer,
            },
            ...(credential.issuedOn ? { validFrom: credential.issuedOn } : {}),
            ...(!credential.lifetime && credential.expiresOn
                ? { validUntil: credential.expiresOn }
                : {}),
            ...(credential.credentialId
                ? { identifier: credential.credentialId }
                : {}),
            ...(credential.verificationUrl
                ? { url: credential.verificationUrl }
                : {}),
        }));
}

export function buildPersonEntity({ profile, imageUrl }: PersonEntityInput) {
    const activeWork = currentWork(profile?.timeline);
    const alumniOf = educationOrganizations(profile, false);
    const affiliation = educationOrganizations(profile, true);
    const knowsAbout = buildKnowsAbout(profile);

    return {
        "@type": "Person",
        name: profile?.name || siteConfig.author,
        alternateName: "Adithya",
        url: siteConfig.url,
        ...(imageUrl ? { image: imageUrl } : {}),
        description: getProfileDescription(profile),
        ...(activeWork
            ? {
                  jobTitle: activeWork.title,
                  worksFor: {
                      "@type": "Organization",
                      name: activeWork.organization,
                  },
              }
            : {}),
        ...(profile?.location
            ? {
                  homeLocation: {
                      "@type": "Place",
                      name: profile.location,
                  },
              }
            : {}),
        ...(alumniOf.length > 0 ? { alumniOf } : {}),
        ...(affiliation.length > 0 ? { affiliation } : {}),
        ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
        sameAs: buildSameAs(profile),
    };
}

export function buildProfilePage(
    input: PersonEntityInput & { dateModified: string },
) {
    const credentials = buildHasCredential(input.profile?.credentials);

    return {
        "@type": "ProfilePage",
        dateCreated: "2024-01-01",
        dateModified: input.dateModified,
        mainEntity: {
            ...buildPersonEntity(input),
            ...(credentials.length > 0 ? { hasCredential: credentials } : {}),
        },
    };
}

export interface BlogPostingInput {
    title: string;
    description: string;
    publishedAt: string;
    slug: string;
    updatedAt?: string;
    tags?: string[];
    wordCount?: number;
}

export function buildBlogPosting({
    title,
    description,
    publishedAt,
    slug,
    updatedAt,
    tags,
    wordCount,
}: BlogPostingInput) {
    return {
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: publishedAt,
        url: `${siteConfig.url}/blog/${slug}`,
        image: `${siteConfig.url}/blog/${slug}/opengraph-image`,
        author: {
            "@type": "Person",
            name: siteConfig.author,
            url: siteConfig.url,
        },
        publisher: {
            "@type": "Person",
            name: siteConfig.author,
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${siteConfig.url}/blog/${slug}`,
        },
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        ...(tags && tags.length > 0 ? { keywords: tags.join(", ") } : {}),
        ...(typeof wordCount === "number" && wordCount > 0
            ? { wordCount }
            : {}),
    };
}

export function buildBlog(profile: ProfileData | null = null) {
    return {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: `${siteConfig.author} — Blog`,
        url: `${siteConfig.url}/blog`,
        description: getWritingDescription(profile),
        author: {
            "@type": "Person",
            name: siteConfig.author,
            url: siteConfig.url,
        },
    };
}
