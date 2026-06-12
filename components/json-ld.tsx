import { siteConfig } from "@/lib/config";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

/**
 * Escape "<" so attacker-influenced strings can never close the
 * <script> tag and inject markup via dangerouslySetInnerHTML.
 */
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

// siteConfig.role is "<jobTitle> @ <employer>" — derive both halves so
// structured data stays in sync with the rest of the site.
const [jobTitle, employer] = siteConfig.role.split(" @ ");

/** Shared schema.org Person fields used by PersonJsonLd and ProfilePageJsonLd. */
function buildPersonEntity() {
    return {
        "@type": "Person",
        name: siteConfig.author,
        alternateName: "Adithya",
        url: siteConfig.url,
        image: `${siteConfig.url}/hero.webp`,
        jobTitle,
        worksFor: {
            "@type": "Organization",
            name: employer,
        },
        alumniOf: {
            "@type": "CollegeOrUniversity",
            name: "University of California, Santa Cruz",
        },
        sameAs: siteConfig.socials,
    };
}

export function PersonJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        ...buildPersonEntity(),
        knowsAbout: [
            "Cloud Engineering",
            "Cybersecurity",
            "OpenStack",
            "Kubernetes",
            "AWS",
            "DevOps",
            "Penetration Testing",
            "Network Security",
        ],
        description:
            "Cloud Field Engineer at Canonical specializing in cloud infrastructure, cybersecurity, and DevOps. AWS Certified Solutions Architect and CompTIA Security+ certified.",
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

export function WebSiteJsonLd() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Adithya Rajendran - Portfolio & Blog",
        url: siteConfig.url,
        description:
            "Personal portfolio and cybersecurity blog by Adithya Rajendran, Cloud Field Engineer at Canonical.",
        author: {
            "@type": "Person",
            name: "Adithya Rajendran",
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

export function BlogPostJsonLd({
    title,
    description,
    date,
    slug,
}: {
    title: string;
    description: string;
    date: string;
    slug: string;
}) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        description,
        datePublished: date,
        image: `${siteConfig.url}/blogs/${slug}/opengraph-image`,
        author: {
            "@type": "Person",
            name: "Adithya Rajendran",
            url: siteConfig.url,
        },
        publisher: {
            "@type": "Person",
            name: "Adithya Rajendran",
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `${siteConfig.url}/blogs/${slug}`,
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

export async function ProfilePageJsonLd() {
    "use cache";
    cacheLife("max");
    // Portfolio publishes refresh dateModified via the webhook.
    cacheTag(CACHE_TAGS.portfolio);

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        dateCreated: "2024-01-01",
        dateModified: new Date().toISOString().split("T")[0],
        mainEntity: {
            ...buildPersonEntity(),
            worksFor: {
                "@type": "Organization",
                name: employer,
                url: "https://canonical.com",
            },
            hasCredential: [
                {
                    "@type": "EducationalOccupationalCredential",
                    name: "AWS Certified Solutions Architect",
                    credentialCategory: "certification",
                    recognizedBy: {
                        "@type": "Organization",
                        name: "Amazon Web Services",
                    },
                },
                {
                    "@type": "EducationalOccupationalCredential",
                    name: "CompTIA Security+",
                    credentialCategory: "certification",
                    recognizedBy: { "@type": "Organization", name: "CompTIA" },
                },
            ],
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}
