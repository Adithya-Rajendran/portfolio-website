import { formatMissionDesignation } from "@/lib/designations";
import { formatTimelineDate } from "@/lib/profile-content";
import { EMPLOYMENT_TYPES, TALK_KINDS } from "@/lib/profile-fields";
import { formatProjectYears } from "@/lib/project-content";
import { PROJECT_TYPES } from "@/lib/project-fields";
import type {
    CredentialListItem,
    ProjectListItem,
    TalkOrPaper,
    TimelineEntry,
} from "@/lib/sanity-client";
import { decimalYear } from "@/lib/trajectory";

/**
 * The Trajectory CV (G2, G3) as display-ready rows: the profile's timeline,
 * projects, talks and credentials with their dates already worded. Pure,
 * so /resume, its print and About agree.
 * Dates follow the site's rules: a year-only date prints the year alone,
 * an unknown start is omitted with its "– present", and nothing is
 * estimated in words. The dates are printed as the résumé gives them;
 * no length of time is derived from them.
 */

export interface CvEntry {
    /** The timeline entry's key. */
    id: string;
    /** The row's fragment: `#cv-<key>`. */
    anchor: string;
    kind: "work" | "education";
    title: string;
    organization: string;
    /** The flight's short name: `orgShort`, else the organization. */
    orgLabel: string;
    orgUrl: string | null;
    location: string | null;
    /** "Internship", "Part-time"…; never "Degree". */
    employment: string | null;
    /** "May 2024 – Jul 2026", "Aug 2026 – present", "Jun 2023". */
    dates: string | null;
    current: boolean;
    /** "Expected 2028". */
    expected: string | null;
    summary: string | null;
    highlights: string[];
    skills: string[];
    burn: string | null;
    /** The entry's dates as recorded, which the flight places in time. */
    span: Pick<
        TimelineEntry,
        "startDate" | "startPrecision" | "endDate" | "endPrecision"
    >;
}

/** A fragment-safe id from a Sanity key. */
export function cvAnchor(key: string): string {
    return `cv-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * Whether a timeline entry's start is known: it is set and before the end
 * (the zero-length guard; lib/trajectory.ts flies it the same way).
 */
function startKnown(entry: TimelineEntry, current: boolean): boolean {
    const start = decimalYear(entry.startDate, entry.startPrecision);
    if (start === null) return false;
    if (current) return true;
    const end = decimalYear(entry.endDate, entry.endPrecision);
    return end === null || start < end;
}

export function cvEntry(entry: TimelineEntry): CvEntry {
    const current = entry.isCurrent ?? !entry.endDate;
    const known = startKnown(entry, current);
    const start = known
        ? formatTimelineDate(entry.startDate, entry.startPrecision)
        : null;
    const end = current
        ? null
        : formatTimelineDate(entry.endDate, entry.endPrecision);
    let dates: string | null = null;
    if (current) dates = start ? `${start} – present` : null;
    else if (start && end)
        dates =
            start === end
                ? end
                : /^\d{4}$/.test(start) && /^\d{4}$/.test(end)
                  ? `${start}–${end}`
                  : `${start} – ${end}`;
    else dates = end ?? start;

    const employment =
        entry.employment && entry.employment !== "degree"
            ? (EMPLOYMENT_TYPES.find((type) => type.value === entry.employment)
                  ?.title ?? null)
            : null;

    return {
        id: entry._key,
        anchor: cvAnchor(entry._key),
        kind: entry.kind,
        title: entry.title,
        organization: entry.organization,
        orgLabel: entry.orgShort?.trim() || entry.organization,
        orgUrl: entry.orgUrl ?? null,
        location: entry.location?.trim() || null,
        employment,
        dates,
        current,
        expected:
            current && entry.expectedEndYear
                ? `Expected ${entry.expectedEndYear}`
                : null,
        summary: entry.summary?.trim() || null,
        highlights: (entry.highlights ?? []).filter((line) => line.trim()),
        skills: entry.skills ?? [],
        burn: entry.burn?.label?.trim() || null,
        span: {
            startDate: entry.startDate,
            startPrecision: entry.startPrecision,
            endDate: entry.endDate,
            endPrecision: entry.endPrecision,
        },
    };
}

/** The timeline in the owner's order, split into education and work. */
export function cvEntries(
    timeline: readonly TimelineEntry[] | null | undefined,
) {
    const entries = (timeline ?? [])
        .filter((entry) => entry?.title && entry?.organization)
        .map(cvEntry);
    return {
        all: entries,
        education: entries.filter((entry) => entry.kind === "education"),
        experience: entries.filter((entry) => entry.kind === "work"),
    };
}

export interface CvLink {
    label: string;
    /** An address off the site, or `/blog/<slug>` for one of its posts. */
    url: string;
    /** "github.com/…": printed after the link on paper. */
    host: string;
}

/** "github.com/Adithya-Rajendran": an address without its scheme or "www.". */
export function hostOf(url: string): string {
    return url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "");
}

/** A URL on this site (relative, or on its own host), parsed; else null. */
export function siteUrlOf(url: string, siteUrl: string): URL | null {
    let parsed: URL;
    try {
        parsed = new URL(url, siteUrl);
    } catch {
        return null;
    }
    const site = new URL(siteUrl);
    const host = (value: string) => value.replace(/^www\./, "");
    return host(parsed.hostname) === host(site.hostname) ? parsed : null;
}

/**
 * The slug of a Flight Log entry a URL points at on this site
 * (`/blog/<slug>`, relative or on the site's own host), or null.
 */
export function sitePostSlug(url: string, siteUrl: string): string | null {
    const parsed = siteUrlOf(url, siteUrl);
    if (!parsed) return null;
    const match = /^\/blog\/([a-z0-9][a-z0-9-]*)\/?$/.exec(parsed.pathname);
    if (!match || match[1] === "archive") return null;
    return match[1];
}

function httpLinks(
    links: readonly { label: string; url: string }[] | null | undefined,
): CvLink[] {
    return (links ?? [])
        .filter((link) => /^https?:\/\//.test(link.url) && link.label?.trim())
        .map((link) => ({
            label: link.label.trim(),
            url: link.url,
            host: hostOf(link.url),
        }));
}

/**
 * A project's links on the CV. A link to the site itself is never an
 * external link: one to a published post opens it in place
 * (`/blog/<slug>`, its address still printed on paper), and any other
 * (the site's own address, an unpublished post) is left out.
 */
function projectLinks(
    links: readonly { label: string; url: string }[] | null | undefined,
    site: { url: string; posts: ReadonlySet<string> },
): CvLink[] {
    return httpLinks(links).flatMap((link) => {
        if (!siteUrlOf(link.url, site.url)) return [link];
        const slug = sitePostSlug(link.url, site.url);
        return slug && site.posts.has(slug)
            ? [
                  {
                      ...link,
                      url: `/blog/${slug}`,
                      host: hostOf(`${site.url}/blog/${slug}`),
                  },
              ]
            : [];
    });
}

export interface CvProject {
    id: string;
    slug: string;
    /** "MSN-02". */
    designation: string;
    title: string;
    /** "c. 2024–2025"; "Ongoing" for an active project without dates;
     *  otherwise null. */
    years: string | null;
    /** "Infrastructure · Software". */
    types: string | null;
    role: string | null;
    /** The highlights, or the summary when there are none. */
    lines: string[];
    links: CvLink[];
}

export function cvProjects(
    projects: readonly ProjectListItem[] | null | undefined,
    site: {
        /** The site's address, `siteConfig.url`. */
        url: string;
        /** The published posts' slugs. */
        posts: ReadonlySet<string>;
    },
): CvProject[] {
    return [...(projects ?? [])]
        .filter((project) => project.slug && project.title)
        .sort((a, b) => a.designation - b.designation)
        .map((project) => {
            const highlights = (project.highlights ?? []).filter((line) =>
                line.trim(),
            );
            const types = (project.types ?? [])
                .map(
                    (type) =>
                        PROJECT_TYPES.find((option) => option.value === type)
                            ?.title,
                )
                .filter(Boolean)
                .join(" · ");
            return {
                id: project._id,
                slug: project.slug,
                designation: formatMissionDesignation(project.designation),
                title: project.title,
                years:
                    formatProjectYears(project) ??
                    (project.status === "active" ? "Ongoing" : null),
                types: types || null,
                role: project.myRole?.trim() || null,
                lines: highlights.length
                    ? highlights
                    : project.summary?.trim()
                      ? [project.summary.trim()]
                      : [],
                links: projectLinks(project.links, site),
            };
        });
}

export interface CvTalk {
    id: string;
    title: string;
    /** "Talk", "Paper"… */
    kind: string;
    venue: string | null;
    /** "Mar 2024"; null when the date is not set. */
    date: string | null;
    links: CvLink[];
}

export function cvTalks(
    talks: readonly TalkOrPaper[] | null | undefined,
): CvTalk[] {
    return (talks ?? [])
        .filter((talk) => talk.title?.trim())
        .map((talk) => ({
            id: talk._key,
            title: talk.title.trim(),
            kind:
                TALK_KINDS.find((option) => option.value === talk.kind)
                    ?.title ?? "Talk",
            venue: talk.venue?.trim() || null,
            date: formatTimelineDate(talk.date),
            links: httpLinks(talk.links),
        }));
}

/**
 * A credential as one plain row, as the résumé lists it: the span it is
 * held ("Sep 2023 – Sep 2026"), or its issue date when it has no expiry,
 * then its name, linked to its verification page when the record has
 * one, and the issuer.
 */
export interface CvCredential {
    id: string;
    title: string;
    issuer: string | null;
    url: string | null;
    /** "Sep 2023 – Sep 2026"; "May 2018" without an expiry. */
    dates: string | null;
}

/**
 * The credentials in the owner's order, every one the same plain row:
 * the current ones (active or without expiry), then the expired ones as
 * Prior certifications, as on the résumé. No status is labelled, never
 * "Expired" or "No expiry".
 */
export function cvCredentials(
    credentials: readonly CredentialListItem[] | null | undefined,
): { current: CvCredential[]; prior: CvCredential[] } {
    const current: CvCredential[] = [];
    const prior: CvCredential[] = [];
    for (const credential of credentials ?? []) {
        if (!credential.title?.trim()) continue;
        const issued = formatTimelineDate(credential.issuedOn);
        const ended = credential.lifetime
            ? null
            : formatTimelineDate(credential.expiresOn);
        const row: CvCredential = {
            id: credential._key,
            title: credential.title.trim(),
            issuer: credential.issuer?.trim() || null,
            url: /^https?:\/\//.test(credential.verificationUrl ?? "")
                ? credential.verificationUrl!
                : null,
            dates: issued && ended ? `${issued} – ${ended}` : (issued ?? ended),
        };
        (credential.lifecycleStatus === "expired" ? prior : current).push(row);
    }
    return { current, prior };
}
