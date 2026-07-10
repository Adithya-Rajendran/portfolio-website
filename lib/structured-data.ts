/**
 * Pure schema.org builders for structured data (JSON-LD). No React, no
 * "use cache" — components/json-ld.tsx fetches Sanity content and wraps
 * these return values in <script> tags; tests/lib/structured-data.test.ts
 * exercises the fallback/override logic directly.
 *
 * Every builder falls back to lib/config.ts (siteConfig / socialProfiles)
 * whenever the Sanity intro singleton doesn't provide a field, so the
 * site keeps rendering correct structured data before content is ever
 * entered in the studio.
 */
import { siteConfig, socialProfiles } from "@/lib/config";
import type { IntroData } from "@/lib/sanity-client";
import type { Certification } from "@/sanity.types";

/** Shared input for the two Person-shaped builders. */
export interface PersonEntityInput {
    intro: IntroData | null;
    certifications?: Certification[];
}

type EducationEntry = { name?: string; url?: string };

/**
 * intro.education → CollegeOrUniversity entries. Falls back to
 * siteConfig.alumniOf when Sanity has no (valid) entries yet.
 */
function buildAlumniOf(education?: EducationEntry[]) {
    const entries = (education ?? [])
        .filter((entry): entry is EducationEntry & { name: string } =>
            Boolean(entry.name),
        )
        .map((entry) => ({
            "@type": "CollegeOrUniversity",
            name: entry.name,
            ...(entry.url ? { url: entry.url } : {}),
        }));

    if (entries.length > 0) return entries;

    return [{ "@type": "CollegeOrUniversity", name: siteConfig.alumniOf }];
}

/** Today's two hardcoded certifications — served until Sanity has content. */
const FALLBACK_CREDENTIALS = [
    {
        "@type": "EducationalOccupationalCredential",
        name: "AWS Certified Solutions Architect",
        credentialCategory: "certification",
        recognizedBy: { "@type": "Organization", name: "Amazon Web Services" },
    },
    {
        "@type": "EducationalOccupationalCredential",
        name: "CompTIA Security+",
        credentialCategory: "certification",
        recognizedBy: { "@type": "Organization", name: "CompTIA" },
    },
];

/** Certification[] → EducationalOccupationalCredential entries. */
function buildHasCredential(certifications?: Certification[]) {
    const certs = (certifications ?? []).filter((cert) => cert.title);
    if (certs.length === 0) return FALLBACK_CREDENTIALS;

    return certs.map((cert) => ({
        "@type": "EducationalOccupationalCredential",
        name: cert.title,
        credentialCategory: "certification",
        recognizedBy: { "@type": "Organization", name: cert.org },
    }));
}

/**
 * Shared schema.org Person fields used by PersonJsonLd and
 * ProfilePageJsonLd's mainEntity.
 *
 * - roleLine is `intro.role` when Sanity has it, else siteConfig.role;
 *   both are "<jobTitle> @ <employer>" strings, split for jobTitle/org.
 * - Affiliation prefers intro.affiliation: "work" → worksFor, "school" →
 *   memberOf. With no affiliation, falls back to the org parsed out of
 *   roleLine as worksFor (name only) — today's pre-Sanity behavior.
 * - alumniOf/knowsAbout/sameAs fall back to lib/config.ts.
 */
export function buildPersonEntity(input: PersonEntityInput) {
    const { intro } = input;
    const roleLine = intro?.role || siteConfig.role;
    const [jobTitle, roleOrg] = roleLine.split(" @ ");

    const affiliation = intro?.affiliation;
    let worksFor: Record<string, unknown> | undefined;
    let memberOf: Record<string, unknown> | undefined;

    if (affiliation?.name) {
        const org = {
            "@type":
                affiliation.kind === "school"
                    ? "EducationalOrganization"
                    : "Organization",
            name: affiliation.name,
            ...(affiliation.url ? { url: affiliation.url } : {}),
        };
        if (affiliation.kind === "school") {
            memberOf = org;
        } else {
            worksFor = org;
        }
    } else if (roleOrg) {
        worksFor = { "@type": "Organization", name: roleOrg };
    }

    return {
        "@type": "Person",
        name: siteConfig.author,
        alternateName: "Adithya",
        url: siteConfig.url,
        image: `${siteConfig.url}/hero.webp`,
        jobTitle,
        ...(worksFor ? { worksFor } : {}),
        ...(memberOf ? { memberOf } : {}),
        alumniOf: buildAlumniOf(intro?.education),
        knowsAbout:
            intro?.knowsAbout && intro.knowsAbout.length > 0
                ? intro.knowsAbout
                : siteConfig.knowsAbout,
        sameAs: socialProfiles,
    };
}

/**
 * Today's ProfilePage shape, with hasCredential now derived from the
 * certifications list instead of hardcoded. dateModified is caller-supplied
 * (usually `new Date().toISOString().split("T")[0]` computed inside the
 * cached scope of ProfilePageJsonLd) so this builder stays pure.
 */
export function buildProfilePage(
    input: PersonEntityInput & { dateModified: string },
) {
    return {
        "@type": "ProfilePage",
        dateCreated: "2024-01-01",
        dateModified: input.dateModified,
        mainEntity: {
            ...buildPersonEntity(input),
            hasCredential: buildHasCredential(input.certifications),
        },
    };
}

export interface BlogPostingInput {
    title: string;
    description: string;
    date: string;
    slug: string;
    updatedAt?: string;
    tags?: string[];
    wordCount?: number;
}

/**
 * Today's BlogPosting shape, plus url/dateModified/keywords/wordCount
 * when getPostMeta's richer PostMeta fields are available.
 */
export function buildBlogPosting(input: BlogPostingInput) {
    const { title, description, date, slug, updatedAt, tags, wordCount } =
        input;

    return {
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: date,
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

/** Mirrors the metadata description in app/blogs/layout.tsx — keep both
 *  in sync if either copy changes. */
const BLOG_DESCRIPTION =
    "Technical blog by Adithya Rajendran covering cybersecurity, cloud engineering, homelabs, penetration testing, and DevOps. Hands-on guides, write-ups, and insights.";

/** Blog index structured data. Includes its own "@context" since
 *  BlogJsonLd renders it directly (no other fields get spread in). */
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
