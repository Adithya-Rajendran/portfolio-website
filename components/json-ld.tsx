import { cacheLife, cacheTag } from "next/cache";
import { siteConfig } from "@/lib/config";
import { getProfileDescription } from "@/lib/profile-content";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Mission } from "@/lib/missions";
import { getProfile, type ProfileData } from "@/lib/sanity-client";
import { urlForImage } from "@/lib/sanity-image";
import {
    buildBlog,
    buildBlogPosting,
    buildBreadcrumbList,
    buildContactPage,
    buildMission,
    buildPersonEntity,
    buildProfilePage,
    buildProjects,
    LD_IDS,
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

export async function WebSiteJsonLd() {
    const profile = await getProfile();
    const description = getProfileDescription(profile);
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": LD_IDS.website,
        name: siteConfig.author,
        url: siteConfig.url,
        ...(description ? { description } : {}),
        author: { "@id": LD_IDS.person },
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

export function BreadcrumbJsonLd({
    items,
}: {
    items: readonly { name: string; path: string }[];
}) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: safeJsonLd(buildBreadcrumbList(items)),
            }}
        />
    );
}

export async function BlogJsonLd() {
    const profile = await getProfile();
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(buildBlog(profile)) }}
        />
    );
}

export async function ProjectsJsonLd() {
    const profile = await getProfile();
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: safeJsonLd(buildProjects(profile)),
            }}
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
        }),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
    );
}

export function ContactPageJsonLd({
    profile,
}: {
    profile: ProfileData | null;
}) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: safeJsonLd(buildContactPage(profile)),
            }}
        />
    );
}

export function MissionJsonLd({ mission }: { mission: Mission }) {
    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: safeJsonLd(buildMission(mission)),
            }}
        />
    );
}
