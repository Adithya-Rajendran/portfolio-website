import { cacheLife, cacheTag } from "next/cache";
import { siteConfig } from "@/lib/config";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getProfile, type ProfileData } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";
import {
    buildBlog,
    buildBlogPosting,
    buildPersonEntity,
    buildProfilePage,
    type BlogPostingInput,
} from "@/lib/structured-data";

/** Prevent CMS strings from closing the JSON-LD script element. */
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

function profileImageUrl(profile: ProfileData | null) {
    if (!profile?.portrait?.asset) return undefined;

    try {
        return urlForImage(profile.portrait)
            .width(1200)
            .height(1200)
            .fit("crop")
            .auto("format")
            .url();
    } catch {
        return undefined;
    }
}

export async function PersonJsonLd() {
    "use cache";
    cacheLife("max");
    cacheTag(CACHE_TAGS.profile);

    const profile = await getProfile();
    const jsonLd = {
        "@context": "https://schema.org",
        ...buildPersonEntity({
            profile,
            imageUrl: profileImageUrl(profile),
        }),
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
        name: siteConfig.author,
        url: siteConfig.url,
        description: siteConfig.description,
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

export function BlogPostJsonLd(input: BlogPostingInput) {
    const jsonLd = {
        "@context": "https://schema.org",
        ...buildBlogPosting(input),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

export function BlogJsonLd() {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(buildBlog()) }}
        />
    );
}

export async function ProfilePageJsonLd() {
    "use cache";
    cacheLife("max");
    cacheTag(CACHE_TAGS.profile);

    const profile = await getProfile();
    const jsonLd = {
        "@context": "https://schema.org",
        ...buildProfilePage({
            profile,
            imageUrl: profileImageUrl(profile),
            dateModified: profile?._updatedAt?.slice(0, 10) || "2024-01-01",
        }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}
