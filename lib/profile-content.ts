import { BLOG_DESCRIPTION, siteConfig } from "@/lib/config";
import type {
    ExternalLink,
    PostListItem,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

export type ProfilePlatform = "linkedin" | "github";

/** A saved Profile is authoritative, including deliberately empty lists. */
export function getProfileLinks(profile: ProfileData | null): ExternalLink[] {
    if (profile) return profile.socialLinks ?? [];

    return [
        {
            _key: "linkedin",
            label: "LinkedIn",
            url: siteConfig.profiles.linkedin,
        },
        {
            _key: "github",
            label: "GitHub",
            url: siteConfig.profiles.github,
        },
    ].filter((link) => Boolean(link.url));
}

/** Labels are editorial text; a platform is identified by its actual host. */
export function getProfileLink(
    profile: ProfileData | null,
    platform: ProfilePlatform,
): ExternalLink | undefined {
    const domain = platform === "linkedin" ? "linkedin.com" : "github.com";
    return getProfileLinks(profile).find((link) => {
        try {
            const url = new URL(link.url);
            return (
                (url.protocol === "https:" || url.protocol === "http:") &&
                (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
            );
        } catch {
            return false;
        }
    });
}

export function getProfileDescription(profile: ProfileData | null): string {
    return (
        profile?.seoDescription?.trim() ||
        profile?.introduction?.trim() ||
        siteConfig.description
    );
}

export function getWritingDescription(profile: ProfileData | null): string {
    return profile?.writingDescription?.trim() || BLOG_DESCRIPTION;
}

/** Preserve legacy date semantics until an editor explicitly sets status. */
export function isCurrentTimelineEntry(entry: TimelineEntry): boolean {
    return entry.isCurrent ?? !entry.endDate;
}

/**
 * Only select from the public posts returned by getAllPosts(). The profile
 * owns the chosen ID; the post query owns the content and publication gate.
 */
export function selectFeaturedPost(
    profile: ProfileData | null,
    posts: readonly PostListItem[],
): PostListItem | undefined {
    const eligible = posts.filter((post) => post.slug && post.publishedAt);
    const selected = eligible.find(
        (post) => post._id === profile?.featuredPostId,
    );
    return (
        selected ??
        eligible.reduce<PostListItem | undefined>(
            (latest, post) =>
                !latest || post.publishedAt > latest.publishedAt
                    ? post
                    : latest,
            undefined,
        )
    );
}
