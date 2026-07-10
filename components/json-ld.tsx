import { siteConfig } from "@/lib/config";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getAllCertifications, getIntro } from "@/lib/sanity-client";
import {
    buildBlog,
    buildBlogPosting,
    buildPersonEntity,
    buildProfilePage,
    type BlogPostingInput,
} from "@/lib/structured-data";

/**
 * Escape "<" so attacker-influenced strings can never close the
 * <script> tag and inject markup via dangerouslySetInnerHTML.
 */
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function PersonJsonLd() {
    "use cache";
    cacheLife("max");
    // Portfolio publishes (intro edits) refresh this via the webhook.
    cacheTag(CACHE_TAGS.portfolio);

    const intro = await getIntro();

    const jsonLd = {
        "@context": "https://schema.org",
        ...buildPersonEntity({ intro }),
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
        name: `${siteConfig.author} - Portfolio & Blog`,
        url: siteConfig.url,
        description:
            "Personal portfolio and cybersecurity blog by Adithya Rajendran, Cloud Field Engineer at Canonical.",
        author: {
            "@type": "Person",
            name: siteConfig.author,
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
    updatedAt,
    tags,
    wordCount,
}: BlogPostingInput) {
    const jsonLd = {
        "@context": "https://schema.org",
        ...buildBlogPosting({
            title,
            description,
            date,
            slug,
            updatedAt,
            tags,
            wordCount,
        }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

/** Blog index (/blogs) structured data. */
export function BlogJsonLd() {
    const jsonLd = buildBlog();

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

    const [intro, certifications] = await Promise.all([
        getIntro(),
        getAllCertifications(),
    ]);

    const jsonLd = {
        "@context": "https://schema.org",
        ...buildProfilePage({
            intro,
            certifications,
            dateModified: new Date().toISOString().split("T")[0],
        }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}
