/**
 * Pure schema.org builders for the site's JSON-LD. Fetching and script-tag
 * escaping live in components/json-ld.tsx so these functions stay easy to
 * exercise without React or a Sanity connection.
 */
import { siteConfig } from "@/lib/config";
import { dateOnly } from "@/lib/dates";
import {
    getProfileDescription,
    getProfileLinks,
    getWritingDescription,
    isCurrentTimelineEntry,
} from "@/lib/profile-content";
import type { Mission } from "@/lib/missions";
import { shareImagePath } from "@/lib/route-tags";
import type {
    CredentialListItem,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

/** A post's share card, for the BlogPosting image. */
const POST_CARD = "app/(site)/blog/[slug]/opengraph-image.tsx";

/**
 * The graph's node ids: the site's person, the site, the writing and the
 * projects are one node each, which every other node names by its id (an
 * author, a post's or a project's `isPartOf`), across the page's blocks.
 */
export const LD_IDS = {
    person: `${siteConfig.url}/#person`,
    website: `${siteConfig.url}/#website`,
    blog: `${siteConfig.url}/blog#blog`,
    projects: `${siteConfig.url}/portfolio#collection`,
} as const;

/** The site's person as an author or creator: its id, with the name and
 *  address a reader of this node alone needs. */
function personRef(name: string = siteConfig.author) {
    return {
        "@type": "Person",
        "@id": LD_IDS.person,
        name,
        url: siteConfig.url,
    };
}

/** `{ [key]: value }` when there is a value, else nothing to spread. */
function optional<Key extends string>(
    key: Key,
    value: string | null | undefined,
): Partial<Record<Key, string>> {
    return value ? ({ [key]: value } as Record<Key, string>) : {};
}

interface PersonEntityInput {
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
        "@id": LD_IDS.person,
        name: profile?.name || siteConfig.author,
        alternateName: "Adithya",
        url: siteConfig.url,
        ...(imageUrl ? { image: imageUrl } : {}),
        ...optional("description", getProfileDescription(profile)),
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

/**
 * About as a schema.org ProfilePage. Its dates are the profile document's
 * own (`_createdAt`, `_updatedAt`); a date the document does not carry is
 * left out, never assumed. Its main entity is the site's person (the same
 * `@id` as every page's Person block, so one node), with the credentials.
 */
export function buildProfilePage(input: PersonEntityInput) {
    const credentials = buildHasCredential(input.profile?.credentials);
    const created = dateOnly(input.profile?._createdAt);
    const modified = dateOnly(input.profile?._updatedAt);

    return {
        "@type": "ProfilePage",
        ...(created ? { dateCreated: created } : {}),
        ...(modified ? { dateModified: modified } : {}),
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
        // The last revision, else the publication: never a later date
        // than the post records.
        dateModified: revisedAt || publishedAt,
        url,
        image:
            imageUrl ?? `${siteConfig.url}${shareImagePath(POST_CARD, slug)}`,
        author: personRef(),
        publisher: personRef(),
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": url,
        },
        isPartOf: {
            "@type": "Blog",
            "@id": LD_IDS.blog,
        },
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
        "@id": LD_IDS.blog,
        name: `${siteConfig.author} — Writing`,
        url: `${siteConfig.url}/blog`,
        ...optional("description", getWritingDescription(profile)),
        author: personRef(),
        isPartOf: { "@id": LD_IDS.website },
    };
}

/**
 * `/portfolio` as a schema.org CollectionPage: the node each project's
 * `isPartOf` names.
 */
export function buildProjects(profile: ProfileData | null = null) {
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": LD_IDS.projects,
        name: `${siteConfig.author} — Projects`,
        url: `${siteConfig.url}/portfolio`,
        ...optional("description", profile?.projectsIntro?.trim()),
        author: personRef(),
        isPartOf: { "@id": LD_IDS.website },
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
        ...optional(
            "description",
            profile?.contactInvitation?.trim() || profile?.contactIntro?.trim(),
        ),
        about: {
            ...personRef(profile?.name || siteConfig.author),
            sameAs: buildSameAs(profile),
        },
    };
}

/**
 * A mission file as a schema.org CreativeWork by the site's person: its
 * title, number, summary, types and stack, and its external links (a
 * repository, a live site) as `sameAs`. Web addresses only.
 */
export function buildMission(
    mission: Pick<
        Mission,
        | "href"
        | "title"
        | "name"
        | "designation"
        | "summary"
        | "types"
        | "technologies"
        | "links"
        | "revised"
    >,
) {
    const sameAs = mission.links
        .map((link) => link.url)
        .filter((url) => /^https?:\/\//i.test(url));
    return {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: mission.title,
        ...(mission.name ? { alternateName: mission.name } : {}),
        identifier: mission.designation,
        url: `${siteConfig.url}${mission.href}`,
        ...(mission.summary ? { description: mission.summary } : {}),
        ...(mission.types.length ? { genre: mission.types.join(", ") } : {}),
        ...(mission.technologies.length
            ? { keywords: mission.technologies.join(", ") }
            : {}),
        ...(mission.revised ? { dateModified: mission.revised } : {}),
        creator: personRef(),
        isPartOf: {
            "@type": "CollectionPage",
            "@id": LD_IDS.projects,
        },
        ...(sameAs.length ? { sameAs } : {}),
    };
}
