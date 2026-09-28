/**
 * Pure schema.org builders for the site's JSON-LD. Fetching and script-tag
 * escaping live in components/json-ld.tsx so these functions stay easy to
 * exercise without React or a Sanity connection.
 */
import { siteConfig } from "@/lib/config";
import { contactCopy } from "@/lib/copy";
import {
    getProfileDescription,
    getProfileLinks,
    getWritingDescription,
    isCurrentTimelineEntry,
} from "@/lib/profile-content";
import { postShareImagePath } from "@/lib/route-tags";
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

/**
 * Profile links as `sameAs`, web addresses only. The schema accepts only
 * http(s) links; this keeps a `mailto:` or `tel:` out of the JSON-LD even
 * if one got in some other way (no public email or phone anywhere).
 */
function buildSameAs(profile: ProfileData | null) {
    return [
        ...new Set(
            getProfileLinks(profile)
                .map((link) => link.url)
                .filter((url) => /^https?:\/\//i.test(url ?? "")),
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
    /** The last substantive revision (`post.revisedAt`), as dateModified. */
    revisedAt?: string | null;
    tags?: string[];
    wordCount?: number;
    /** The cover, when the post has one; otherwise its share image. */
    imageUrl?: string;
}

export function buildBlogPosting({
    title,
    description,
    publishedAt,
    slug,
    revisedAt,
    tags,
    wordCount,
    imageUrl,
}: BlogPostingInput) {
    const url = `${siteConfig.url}/blog/${slug}`;
    return {
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: publishedAt,
        url,
        image: imageUrl ?? `${siteConfig.url}${postShareImagePath(slug)}`,
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
            "@id": url,
        },
        isPartOf: {
            "@type": "Blog",
            "@id": `${siteConfig.url}/blog`,
        },
        ...(revisedAt ? { dateModified: revisedAt } : {}),
        ...(tags && tags.length > 0 ? { keywords: tags.join(", ") } : {}),
        ...(typeof wordCount === "number" && wordCount > 0
            ? { wordCount }
            : {}),
    };
}

/**
 * Where a page sits: Home › a section › the page. Every item but the last
 * links; the last is the page itself (schema.org BreadcrumbList).
 */
export function buildBreadcrumbList(
    items: readonly { name: string; path: string }[],
) {
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: `${siteConfig.url}${item.path === "/" ? "" : item.path}`,
        })),
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

/**
 * `/contact` as a schema.org ContactPage about the site's person. There is
 * deliberately no `email`, `telephone` or `contactPoint`: the form is the
 * only channel (no public email address or phone number anywhere).
 */
export function buildContactPage(profile: ProfileData | null = null) {
    return {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: `Contact ${profile?.name || siteConfig.author}`,
        url: `${siteConfig.url}/contact`,
        description: profile?.contactInvitation?.trim() || contactCopy.intro,
        about: {
            "@type": "Person",
            name: profile?.name || siteConfig.author,
            url: siteConfig.url,
            sameAs: buildSameAs(profile),
        },
    };
}
