import { siteConfig } from "@/lib/config";
import type { TimelineDatePrecision } from "@/lib/profile-fields";
import type {
    Availability,
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

/**
 * The site's search description: the profile's own words, or nothing (the
 * metadata then leaves the description out rather than invent one).
 */
export function getProfileDescription(
    profile: ProfileData | null,
): string | null {
    return (
        profile?.seoDescription?.trim() || profile?.introduction?.trim() || null
    );
}

/** The owner's description of his writing, or nothing. */
export function getWritingDescription(
    profile: ProfileData | null,
): string | null {
    return profile?.writingDescription?.trim() || null;
}

/**
 * What the owner is open to, as one line: the `seeking` lines as written,
 * joined with " · " ("Summer 2027 internships · Full-time opportunities in
 * 2028"), or the older single `openTo` line while that list is empty.
 * Nothing while availability is unset or Closed.
 */
export function availabilityLine(
    availability: Availability | null | undefined,
): string | null {
    if (!availability || availability.status === "closed") return null;
    const lines = (availability.seeking ?? [])
        .map((opening) => opening?.label?.trim())
        .filter((line): line is string => Boolean(line));
    return lines.length
        ? lines.join(" · ")
        : availability.openTo?.trim() || null;
}

/**
 * A timeline date as month and year ("Jun 2023"). With `year` precision only
 * the year is known, so only the year is printed: a month is never invented.
 */
export function formatTimelineDate(
    value?: string | null,
    precision?: TimelineDatePrecision | null,
): string | null {
    if (!value) return null;
    if (/^\d{4}$/.test(value)) return value;
    if (precision === "year" && /^\d{4}-/.test(value)) return value.slice(0, 4);
    const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
    const parsed = new Date(`${normalized}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(parsed);
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
