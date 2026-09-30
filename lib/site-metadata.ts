import { siteConfig } from "@/lib/config";
import { homeCopy } from "@/lib/copy";
import { availabilityLine, getProfileDescription } from "@/lib/profile-content";
import { shareImagePath } from "@/lib/route-tags";
import type { ProfileData } from "@/lib/sanity-client";

/** Every share image's size and type (the routes' `size`, `contentType`). */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;

/** The share images whose alt a page words itself. */
type CardFile =
    | "app/(site)/opengraph-image.tsx"
    | "app/(site)/blog/[slug]/opengraph-image.tsx"
    | "app/(site)/portfolio/[slug]/opengraph-image.tsx";

/**
 * A share image named in a page's metadata, so its alt is that page's
 * own: a post's or project's title "by" the author, the home card's name,
 * headline and availability. An image route's `alt` export is one string
 * for every page it serves. Metadata that names `openGraph.images`
 * replaces the route file's own entry, and X reads the same image.
 */
export function shareImage(file: CardFile, alt: string, slug?: string) {
    return {
        url: shareImagePath(file, slug),
        alt,
        ...OG_SIZE,
        type: OG_CONTENT_TYPE,
    };
}

/**
 * The site's Open Graph fields: the site layout's, and home's with its
 * card (a page's `openGraph` replaces its parent's whole).
 */
export function siteOpenGraph(profile: ProfileData | null) {
    const description = getProfileDescription(profile);
    return {
        title: siteConfig.title,
        ...(description ? { description } : {}),
        url: siteConfig.url,
        siteName: "Adithya Rajendran",
        locale: "en_US",
        type: "website" as const,
    };
}

/**
 * What the home card shows, in words: the name, the headline and what the
 * owner is open to, each only when set ("Adithya Rajendran — Former
 * Canonical engineer · …. Open to Summer 2027 internships · …").
 */
export function homeCardAlt(profile: ProfileData | null): string {
    const name = profile?.name?.trim() || siteConfig.author;
    const headline = profile?.headline?.trim();
    const openTo = availabilityLine(profile?.availability);
    return [
        headline ? `${name} — ${headline}` : name,
        openTo ? `${homeCopy.openTo} ${openTo}` : null,
    ]
        .filter(Boolean)
        .join(". ");
}
