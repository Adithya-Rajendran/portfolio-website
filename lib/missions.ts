import type { StatusValue } from "@/components/ui/marks";
import { hostOf } from "@/lib/cv";
import { formatMissionDesignation } from "@/lib/designations";
import type { LogEntry } from "@/lib/log-index";
import { formatProjectYears, projectStatusLabel } from "@/lib/project-content";
import {
    PROJECT_TYPES,
    type ProjectStatus,
    type ProjectType,
} from "@/lib/project-fields";
import type {
    ContentBody,
    ExternalLink,
    ModelHotspot,
    ProjectListItem,
} from "@/lib/sanity-client";

/**
 * Missions (G5, G6): the projects as the /portfolio index, the mission
 * files and (from PR 13) the home Missions act read them. Pure, so every
 * place agrees on the order, the names, the status marks, the dates and
 * which Flight Log entries belong to a mission. Everything here is derived
 * from what the owner published; a value that is not set stays empty.
 */

export interface MissionLink {
    id: string;
    label: string;
    url: string;
    /** "Code", "Docs"…: the register's short name for the link. */
    short: string;
    /** "github.com/…". */
    host: string;
}

export interface Mission {
    id: string;
    slug: string;
    href: string;
    number: number;
    /** "MSN-02". */
    designation: string;
    /** The vehicle name, from the slug: "Kubernetes Cluster". */
    name: string;
    /** Its longest word, so the uppercase name can be sized to fit. */
    nameChars: number;
    title: string;
    summary: string;
    status: ProjectStatus;
    statusValue: StatusValue;
    statusLabel: string;
    statusNote: string | null;
    /** "Infrastructure", "Software"…, in the order stored. */
    types: string[];
    /** "c. 2024–2025"; null when the project has no dates. */
    dates: string | null;
    role: string | null;
    technologies: string[];
    highlights: string[];
    parameters: { id: string; label: string; value: string }[];
    /** External links; links to this site's own posts are entries instead. */
    links: MissionLink[];
    featured: number | null;
    /** `YYYY-MM-DD` of the last edit. */
    revised: string | null;
}

const STATUS_VALUE: Record<ProjectStatus, StatusValue> = {
    active: "active",
    completed: "complete",
    paused: "paused",
    archived: "archived",
    planned: "planned",
    stopped: "stopped",
};

/** The glyph a project status is drawn with (● Active, ■ Complete…). */
export function missionStatusValue(status: ProjectStatus): StatusValue {
    return STATUS_VALUE[status] ?? "planned";
}

/** "infrastructure" → "Infrastructure". */
export function typeTitle(type: ProjectType): string {
    return PROJECT_TYPES.find((option) => option.value === type)?.title ?? type;
}

/**
 * The mission's short name, from its slug: "kubernetes-cluster" →
 * "Kubernetes Cluster". Mission names are set in capitals (the vehicle
 * treatment), so the slug's words are the name the owner already chose.
 */
export function missionName(slug: string): string {
    return slug
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

const LINK_SHORT: Partial<Record<string, string>> = {
    repo: "Code",
    docs: "Docs",
    paper: "Paper",
    video: "Video",
    dataset: "Data",
    demo: "Demo",
    article: "Article",
    profile: "Profile",
};

/**
 * The slug of a Flight Log entry a URL points at on this site
 * (`/blog/<slug>`, relative or on the site's own host), or null.
 */
export function sitePostSlug(url: string, siteUrl: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url, siteUrl);
    } catch {
        return null;
    }
    const site = new URL(siteUrl);
    const host = (value: string) => value.replace(/^www\./, "");
    if (host(parsed.hostname) !== host(site.hostname)) return null;
    const match = /^\/blog\/([a-z0-9][a-z0-9-]*)\/?$/.exec(parsed.pathname);
    if (!match || match[1] === "archive") return null;
    return match[1];
}

function externalLinks(
    links: readonly ExternalLink[] | null | undefined,
    siteUrl: string,
): MissionLink[] {
    return (links ?? [])
        .filter(
            (link) =>
                /^https?:\/\//.test(link.url) &&
                link.label?.trim() &&
                !sitePostSlug(link.url, siteUrl),
        )
        .map((link) => ({
            id: link._key,
            label: link.label.trim(),
            url: link.url,
            short: (link.kind && LINK_SHORT[link.kind]) || link.label.trim(),
            host: hostOf(link.url),
        }));
}

export function toMission(project: ProjectListItem, siteUrl: string): Mission {
    const name = missionName(project.slug);
    const revised = /^\d{4}-\d{2}-\d{2}/.test(project._updatedAt ?? "")
        ? project._updatedAt!.slice(0, 10)
        : null;
    return {
        id: project._id,
        slug: project.slug,
        href: `/portfolio/${project.slug}`,
        number: project.designation,
        designation: formatMissionDesignation(project.designation),
        name,
        nameChars: Math.max(...name.split(" ").map((word) => word.length), 1),
        title: project.title,
        summary: project.summary?.trim() ?? "",
        status: project.status,
        statusValue: missionStatusValue(project.status),
        statusLabel: projectStatusLabel(project.status),
        statusNote: project.statusNote?.trim() || null,
        types: (project.types ?? []).map(typeTitle),
        dates: formatProjectYears(project),
        role: project.myRole?.trim() || null,
        technologies: (project.technologies ?? []).filter((item) =>
            item.trim(),
        ),
        highlights: (project.highlights ?? []).filter((line) => line.trim()),
        parameters: (project.parameters ?? [])
            .filter((item) => item.label?.trim() && item.value?.trim())
            .map((item) => ({
                id: item._key,
                label: item.label.trim(),
                value: item.value.trim(),
            })),
        links: externalLinks(project.links, siteUrl),
        featured: project.featured ?? null,
        revised,
    };
}

/**
 * The order missions are shown in: the featured slots first (1 is the
 * flagship), then the rest as the list query returns them (newest first).
 */
export function missionOrder<T extends { featured?: number | null }>(
    projects: readonly T[],
): T[] {
    const slot = (project: T) => project.featured ?? Infinity;
    return projects
        .map((project, index) => ({ project, index }))
        .sort((a, b) => slot(a.project) - slot(b.project) || a.index - b.index)
        .map(({ project }) => project);
}

/** By mission number: the register and the files' previous / next. */
export function byDesignation<T extends { number: number }>(
    missions: readonly T[],
): T[] {
    return [...missions].sort((a, b) => a.number - b.number);
}

export function adjacentMissions<T extends { slug: string; number: number }>(
    missions: readonly T[],
    slug: string,
): { previous: T | null; next: T | null } {
    const ordered = byDesignation(missions);
    const index = ordered.findIndex((mission) => mission.slug === slug);
    if (index < 0) return { previous: null, next: null };
    return {
        previous: ordered[index - 1] ?? null,
        next: ordered[index + 1] ?? null,
    };
}

/** "infrastructure and software": the index's dek, in display order. */
export function typeList(missions: readonly Pick<Mission, "types">[]): string {
    const types = [
        ...new Set(missions.flatMap((mission) => mission.types)),
    ].map((type) => type.toLowerCase());
    if (types.length < 2) return types.join("");
    return `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`;
}

const TALLY_ORDER: StatusValue[] = [
    "active",
    "complete",
    "paused",
    "planned",
    "stopped",
    "archived",
];

/** ● 2 Active ■ 2 Complete: how many missions carry each status. */
export function statusTally(
    missions: readonly Pick<Mission, "statusValue" | "statusLabel">[],
): { value: StatusValue; label: string; count: number }[] {
    return TALLY_ORDER.flatMap((value) => {
        const matching = missions.filter(
            (mission) => mission.statusValue === value,
        );
        return matching.length
            ? [
                  {
                      value,
                      label: matching[0].statusLabel,
                      count: matching.length,
                  },
              ]
            : [];
    });
}

/** Every `contentLink` href in a Portable Text body, nested ones too. */
export function bodyLinks(body: ContentBody | null | undefined): string[] {
    const hrefs: string[] = [];
    const walk = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }
        if (!value || typeof value !== "object") return;
        const node = value as Record<string, unknown>;
        if (node._type === "contentLink" && typeof node.href === "string") {
            hrefs.push(node.href);
        }
        for (const key of Object.keys(node)) {
            if (key !== "href") walk(node[key]);
        }
    };
    walk(body);
    return hrefs;
}

export interface MissionEntries {
    /** The entry the mission's write-up comes from, when there is one. */
    original: LogEntry | null;
    /** Every entry tied to the mission, newest first. */
    related: LogEntry[];
}

/**
 * The Flight Log entries that belong to a mission: the posts that reference
 * it, the posts its links and its essay point at, and the posts its model's
 * callouts anchor in. The original entry is the first link to one of its
 * posts, else the oldest post that references it. Unpublished posts are
 * never in `entries`, so they are left out.
 */
export function missionEntries({
    entries,
    postIds,
    referencing,
    links,
    body,
    hotspots,
    siteUrl,
}: {
    entries: readonly LogEntry[];
    /** Post id → slug, for callout anchors. */
    postIds: ReadonlyMap<string, string>;
    /** Slugs of the published posts that reference the project. */
    referencing: readonly string[];
    links: readonly ExternalLink[] | null | undefined;
    body: ContentBody | null | undefined;
    hotspots: readonly ModelHotspot[] | null | undefined;
    siteUrl: string;
}): MissionEntries {
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    const linked = (links ?? [])
        .filter((link) => link.url)
        .sort(
            (a, b) =>
                Number(b.kind === "article") - Number(a.kind === "article"),
        )
        .map((link) => sitePostSlug(link.url, siteUrl))
        .filter((slug): slug is string => Boolean(slug && bySlug.has(slug)));
    const citing = [...referencing]
        .filter((slug) => bySlug.has(slug))
        .sort((a, b) => bySlug.get(a)!.number - bySlug.get(b)!.number);
    const inEssay = bodyLinks(body)
        .map((href) => sitePostSlug(href, siteUrl))
        .filter((slug): slug is string => Boolean(slug));
    const anchored = (hotspots ?? [])
        .map((hotspot) =>
            hotspot.anchor?.postId ? postIds.get(hotspot.anchor.postId) : null,
        )
        .filter((slug): slug is string => Boolean(slug));

    const original = bySlug.get(linked[0] ?? citing[0] ?? "") ?? null;
    const related = [
        ...new Set([...linked, ...citing, ...inEssay, ...anchored]),
    ]
        .map((slug) => bySlug.get(slug))
        .filter((entry): entry is LogEntry => Boolean(entry))
        .sort((a, b) => b.number - a.number);
    return { original, related };
}

export interface Callout {
    id: string;
    /** The balloon's label: "1". */
    label: string;
    title: string;
    body: string | null;
    /** The section it explains: `/blog/<slug>#<heading>` or `#<heading>`. */
    href: string | null;
    /** "LOG 003" when the section is in a Flight Log entry. */
    entry: string | null;
}

/**
 * A model's callouts as numbered rows, each linked to the section that
 * explains it: a heading in a published post, or one in this project's
 * essay. A callout whose section is not published keeps its text only.
 */
export function missionCallouts({
    hotspots,
    entries,
    postIds,
    essayHeadings,
}: {
    hotspots: readonly ModelHotspot[] | null | undefined;
    entries: readonly LogEntry[];
    postIds: ReadonlyMap<string, string>;
    essayHeadings: ReadonlySet<string>;
}): Callout[] {
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
    return (hotspots ?? [])
        .filter((hotspot) => hotspot.title?.trim())
        .map((hotspot) => {
            const heading = hotspot.anchor?.heading?.trim() ?? "";
            const postSlug = hotspot.anchor?.postId
                ? postIds.get(hotspot.anchor.postId)
                : undefined;
            const entry = postSlug ? bySlug.get(postSlug) : undefined;
            let href: string | null = null;
            if (heading && entry) {
                href = `/blog/${entry.slug}#${heading}`;
            } else if (
                heading &&
                !hotspot.anchor?.postId &&
                essayHeadings.has(heading)
            ) {
                href = `#${heading}`;
            }
            return {
                id: hotspot._key,
                label: hotspot.label?.trim() || "",
                title: hotspot.title.trim(),
                body: hotspot.body?.trim() || null,
                href,
                entry: href && entry ? entry.designation : null,
            };
        });
}
