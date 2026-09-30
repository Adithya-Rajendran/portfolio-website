import { formatMissionDesignation } from "@/lib/designations";
import { decimalYear, type OrbitEntry } from "@/lib/orbit/geometry";
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
    /** The map's short name: `orgShort`, else the organization. */
    orgLabel: string;
    orgUrl: string | null;
    location: string | null;
    /** "Internship", "Part-time"…; never "Degree". */
    employment: string | null;
    /** "May 2024 – Jul 2026", "Aug 2026 – present", "Jun 2023". */
    dates: string | null;
    /** The map label's years: "2024–2026", "Since 2026", "2023". */
    years: string | null;
    current: boolean;
    /** "Expected 2028". */
    expected: string | null;
    summary: string | null;
    highlights: string[];
    skills: string[];
    burn: string | null;
    orbit: OrbitEntry;
}

/** A fragment-safe id from a Sanity key. */
export function cvAnchor(key: string): string {
    return `cv-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

/**
 * Whether a timeline entry's start is known: it is set and before the end
 * (the zero-length guard; lib/orbit/geometry.ts draws it the same way).
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

    const startYear = known ? entry.startDate!.slice(0, 4) : null;
    const endYear = current ? null : (entry.endDate?.slice(0, 4) ?? null);
    let years: string | null = null;
    if (current) years = startYear ? `Since ${startYear}` : null;
    else if (startYear && endYear)
        years = startYear === endYear ? endYear : `${startYear}–${endYear}`;
    else years = endYear ?? startYear;

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
        years,
        current,
        expected:
            current && entry.expectedEndYear
                ? `Expected ${entry.expectedEndYear}`
                : null,
        summary: entry.summary?.trim() || null,
        highlights: (entry.highlights ?? []).filter((line) => line.trim()),
        skills: entry.skills ?? [],
        burn: entry.burn?.label?.trim() || null,
        orbit: {
            id: entry._key,
            kind: entry.kind,
            employment: entry.employment,
            startDate: entry.startDate,
            startPrecision: entry.startPrecision,
            endDate: entry.endDate,
            endPrecision: entry.endPrecision,
            isCurrent: current,
            expectedEndYear: entry.expectedEndYear,
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
                links: httpLinks(project.links),
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

export type CredentialStatus = CredentialListItem["lifecycleStatus"];

export interface CvCredential {
    id: string;
    title: string;
    issuer: string;
    url: string | null;
    status: Exclude<CredentialStatus, "expired">;
    /** "Active", "No expiry". */
    statusLabel: string;
    /** "Issued Sep 2023 · Expires Sep 2026". */
    meta: string;
}

/** An expired credential, as the résumé lists it: its name and the span
 *  it was held, on one plain line ("Sep 2023 – Sep 2026"). */
export interface CvPriorCredential {
    id: string;
    title: string;
    dates: string | null;
}

const CREDENTIAL_LABELS: Record<CvCredential["status"], string> = {
    active: "Active",
    lifetime: "No expiry",
};

/**
 * The credentials in the owner's order: the current ones (active or
 * without expiry) as CV rows, and the expired ones as Prior
 * certifications, as on the résumé. Nothing is labelled "Expired".
 */
export function cvCredentials(
    credentials: readonly CredentialListItem[] | null | undefined,
): { current: CvCredential[]; prior: CvPriorCredential[] } {
    const listed = (credentials ?? []).filter((credential) =>
        credential.title?.trim(),
    );
    const current: CvCredential[] = [];
    const prior: CvPriorCredential[] = [];
    for (const credential of listed) {
        const title = credential.title.trim();
        const issued = formatTimelineDate(credential.issuedOn);
        const status = credential.lifecycleStatus;
        if (status === "expired") {
            const ended = formatTimelineDate(credential.expiresOn);
            prior.push({
                id: credential._key,
                title,
                dates:
                    issued && ended
                        ? `${issued} – ${ended}`
                        : (ended ?? issued),
            });
            continue;
        }
        const expires = credential.lifetime
            ? null
            : formatTimelineDate(credential.expiresOn);
        current.push({
            id: credential._key,
            title,
            issuer: credential.issuer,
            url: /^https?:\/\//.test(credential.verificationUrl ?? "")
                ? credential.verificationUrl!
                : null,
            status,
            statusLabel: CREDENTIAL_LABELS[status],
            meta: [
                issued ? `Issued ${issued}` : null,
                expires ? `Expires ${expires}` : null,
            ]
                .filter(Boolean)
                .join(" · "),
        });
    }
    return { current, prior };
}
