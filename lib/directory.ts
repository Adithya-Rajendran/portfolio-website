import { directoryCopy as copy } from "@/lib/copy";
import { cvCredentials, cvEntries, hostOf } from "@/lib/cv";
import { siteRoutes } from "@/lib/navigation";
import { getProfileLinks } from "@/lib/profile-content";
import type { ProfileData } from "@/lib/sanity-client";

/**
 * Link rows to the site's other sections (`RouteList`): the related pages
 * on /portfolio and /about. Pure: a row whose destination has nothing to
 * show is left out. Each row is its destination's plain name and one
 * line about it; the rows carry no numbers.
 */

export type DirectoryRow =
    | "experience"
    | "skills"
    | "certifications"
    | "missions"
    | "writing"
    | "contact";

/**
 * The fragments the old single-page /portfolio used for these sections;
 * its Directory rows carry them, so a link shared before the redesign
 * still lands on the row that leads on.
 */
const PORTFOLIO_ANCHORS: Partial<Record<DirectoryRow, string>> = {
    experience: "experience",
    skills: "skills",
    certifications: "certifications",
    writing: "engineering-writing",
    contact: "contact",
};

const HREFS: Record<DirectoryRow, string> = {
    experience: `${siteRoutes.resume}#experience`,
    skills: `${siteRoutes.resume}#skills`,
    certifications: `${siteRoutes.resume}#certifications`,
    missions: siteRoutes.portfolio,
    writing: siteRoutes.blog,
    contact: siteRoutes.contact,
};

/** Structurally a `RouteItem` (components/ui/route-list.tsx). */
export interface DirectoryItem {
    key: DirectoryRow;
    id?: string;
    href: string;
    plain: string;
    blurb: string;
}

/** What each row's destination needs to have. */
export interface DirectoryContent {
    profile: ProfileData | null;
    /** Published posts (the Flight Log row). */
    posts?: number;
    /** Published projects (the Missions row). */
    projects?: number;
}

function hasContent(row: DirectoryRow, content: DirectoryContent): boolean {
    const { profile } = content;
    switch (row) {
        case "experience":
            return cvEntries(profile?.timeline).experience.length > 0;
        case "skills":
            return (profile?.skillGroups ?? []).some(
                (group) => group.title && group.skills?.length,
            );
        case "certifications":
            return cvCredentials(profile?.credentials).length > 0;
        case "missions":
            return (content.projects ?? 0) > 0;
        case "writing":
            return (content.posts ?? 0) > 0;
        case "contact":
            return true;
    }
}

/**
 * The rows, in the order asked for, that have something to lead to.
 * `anchors` gives each row its old /portfolio fragment as an `id`.
 */
export function directoryRows(
    rows: readonly DirectoryRow[],
    content: DirectoryContent,
    { anchors = false }: { anchors?: boolean } = {},
): DirectoryItem[] {
    return rows
        .filter((row) => hasContent(row, content))
        .map((row) => ({
            key: row,
            ...(anchors && PORTFOLIO_ANCHORS[row]
                ? { id: PORTFOLIO_ANCHORS[row] }
                : {}),
            href: HREFS[row],
            ...copy[row],
        }));
}

/** A profile link as a plain link row (structurally a `RouteItem`). */
export interface ProfileRow {
    key: string;
    href: string;
    plain: string;
    /** The address without its scheme: "github.com/…". */
    blurb: string;
    external: true;
}

/**
 * The owner's profiles as plain link rows: /contact's Profiles. Web
 * addresses only.
 */
export function profileRows(profile: ProfileData | null): ProfileRow[] {
    return getProfileLinks(profile)
        .filter((link) => /^https?:\/\//.test(link.url))
        .map((link) => ({
            key: link._key,
            href: link.url,
            plain: link.label,
            blurb: hostOf(link.url),
            external: true,
        }));
}
