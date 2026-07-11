/**
 * Pure schema.org builders for the site's JSON-LD. Fetching and script-tag
 * escaping live in components/json-ld.tsx so these functions stay easy to
 * exercise without React or a Sanity connection.
 */
import { BLOG_DESCRIPTION, siteConfig, socialProfiles } from "@/lib/config";
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
        (entry) => entry.kind === "work" && !entry.endDate,
    );
}

function splitHeadline(headline: string): [string, string | undefined] {
    const match = headline.match(/^(.+?)\s+(?:@|at)\s+(.+)$/i);
    return match ? [match[1].trim(), match[2].trim()] : [headline, undefined];
}

function buildAlumniOf(profile: ProfileData | null) {
    const entries = (profile?.timeline ?? [])
        .filter((entry) => entry.kind === "education" && entry.organization)
        .map((entry) => ({
            "@type": "CollegeOrUniversity",
            name: entry.organization,
        }));

    if (entries.length > 0) return entries;

    return [{ "@type": "CollegeOrUniversity", name: siteConfig.alumniOf }];
}

function buildKnowsAbout(profile: ProfileData | null) {
    const skills = (profile?.skillGroups ?? []).flatMap(
        (group) => group.skills ?? [],
    );
    const uniqueSkills = [...new Set(skills.filter(Boolean))];
    return uniqueSkills.length > 0 ? uniqueSkills : siteConfig.knowsAbout;
}

function buildSameAs(profile: ProfileData | null) {
    const profileUrls = (profile?.socialLinks ?? [])
        .map((link) => link.url)
        .filter(Boolean);
    return profileUrls.length > 0 ? [...new Set(profileUrls)] : socialProfiles;
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
    const [headlineTitle, headlineOrganization] = splitHeadline(
        profile?.headline || siteConfig.role,
    );
    const organization = activeWork?.organization || headlineOrganization;

    return {
        "@type": "Person",
        name: profile?.name || siteConfig.author,
        alternateName: "Adithya",
        url: siteConfig.url,
        image: imageUrl || `${siteConfig.url}/hero.webp`,
        jobTitle: activeWork?.title || headlineTitle,
        description:
            profile?.introduction || profile?.bio || siteConfig.description,
        ...(organization
            ? {
                  worksFor: {
                      "@type": "Organization",
                      name: organization,
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
        alumniOf: buildAlumniOf(profile),
        knowsAbout: buildKnowsAbout(profile),
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
        url: `${siteConfig.url}/blogs/${slug}`,
        image: `${siteConfig.url}/blogs/${slug}/opengraph-image`,
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
            "@id": `${siteConfig.url}/blogs/${slug}`,
        },
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        ...(tags && tags.length > 0 ? { keywords: tags.join(", ") } : {}),
        ...(typeof wordCount === "number" && wordCount > 0
            ? { wordCount }
            : {}),
    };
}

export function buildBlog() {
    return {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: `${siteConfig.author} — Blog`,
        url: `${siteConfig.url}/blogs`,
        description: BLOG_DESCRIPTION,
        author: {
            "@type": "Person",
            name: siteConfig.author,
            url: siteConfig.url,
        },
    };
}
