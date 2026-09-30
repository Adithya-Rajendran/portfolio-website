import type { StatusValue } from "@/components/ui/marks";
import { hostOf, siteUrlOf, sitePostSlug } from "@/lib/cv";
import { formatMissionDesignation } from "@/lib/designations";
import { extractHeadings } from "@/lib/headings";
import type { LogEntry } from "@/lib/log-index";
import { isQuantity } from "@/lib/metrics";
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
    ProjectWithBody,
} from "@/lib/sanity-client";

/**
 * Missions (G5, G6): the projects as the /portfolio index, the mission
 * files and the home page read them. Pure, so every
 * place agrees on the order, the names, the status marks, the dates and
 * which Flight Log entries belong to a mission. Everything here is derived
 * from what the owner published; a value that is not set stays empty.
 */

export interface MissionLink {
    id: string;
    label: string;
    url: string;
    /** A repository: the head's Code row carries it. */
    code: boolean;
    /** "github.com/…". */
    host: string;
}

export interface MissionParameter {
    id: string;
    label: string;
    value: string;
}

export interface Mission {
    id: string;
    slug: string;
    href: string;
    number: number;
    /** "MSN-02". */
    designation: string;
    /** The owner's short name ("Homelab"); null when the project has
     *  none. The title is always the heading. */
    name: string | null;
    /** The name, else the title: the crumb's and the pager's words. */
    label: string;
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
    /** The parameters that are quantities: the mission's stats. */
    stats: MissionParameter[];
    /** The named parameters the stack and the card do not already name. */
    specs: MissionParameter[];
    /** External links; links to this site's own pages are left out (its
     *  posts are entries instead). */
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

/** The links that lead off the site: a link to the site itself (a post,
 *  or the site's own address) is never an external link. */
function externalLinks(
    links: readonly ExternalLink[] | null | undefined,
    siteUrl: string,
): MissionLink[] {
    return (links ?? [])
        .filter(
            (link) =>
                /^https?:\/\//.test(link.url) &&
                link.label?.trim() &&
                !siteUrlOf(link.url, siteUrl),
        )
        .map((link) => ({
            id: link._key,
            label: link.label.trim(),
            url: link.url,
            code: link.kind === "repo",
            host: hostOf(link.url),
        }));
}

/** Whether the stack already names a value: every part of "Next.js +
 *  React" is a technology, or a whole word of one ("MLP" in "Multilayer
 *  perceptron (MLP)"). */
export function inStack(value: string, technologies: readonly string[]) {
    const parts = value
        .split(/\s*(?:\+|,|&|\/|\band\b)\s*/i)
        .map((part) => part.trim())
        .filter(Boolean);
    const escape = (text: string) =>
        text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
        parts.length > 0 &&
        parts.every((part) =>
            technologies.some((technology) =>
                new RegExp(
                    `(^|[^\\p{L}\\p{N}])${escape(part)}($|[^\\p{L}\\p{N}])`,
                    "iu",
                ).test(technology),
            ),
        )
    );
}

/**
 * A mission's parameters as a spec sheet reads them (contract §11): the
 * quantities are its stats ("195.1 W", "3 × MS-01", "Zero"); a named value
 * ("Okta OIDC") is a spec, or nothing when the stack or the card's text
 * (`said`: the summary and highlights) already names it ("Feed: RSS"
 * beside "…and RSS feed"), so a name is never set as a stat or said twice.
 */
export function splitParameters(
    parameters: readonly MissionParameter[],
    technologies: readonly string[],
    said: readonly string[] = [],
): { stats: MissionParameter[]; specs: MissionParameter[] } {
    return {
        stats: parameters.filter((item) => isQuantity(item.value)),
        specs: parameters.filter(
            (item) =>
                !isQuantity(item.value) &&
                !inStack(item.value, [...technologies, ...said]),
        ),
    };
}

/**
 * Whether the words already on the page (the title, the summary, the
 * lines shown) name every item of the stack, so a Stack row would only
 * repeat them (the Kubernetes note: "…with NFS and OIDC", "…CIS Level 1
 * hardening and … Okta OIDC").
 */
export function stackSaid(
    technologies: readonly string[],
    texts: readonly string[],
): boolean {
    return (
        technologies.length > 0 &&
        technologies.every((item) => inStack(item, texts))
    );
}

/**
 * The results table's rows: those with a metric and a value. Each keeps
 * its note, the context a number needs (the split, the corpus, what was
 * not compared).
 */
export function resultRows<T extends { metric?: string; value?: string }>(
    rows: readonly T[] | null | undefined,
): T[] {
    return (rows ?? []).filter(
        (row) => row.metric?.trim() && row.value?.trim(),
    );
}

/**
 * The stats a mission file sets in its head: its quantities, unless the
 * file has a results table, which carries the numbers with their notes.
 * A number is shown in one place, with its context where it has one.
 */
export function headStats(
    mission: Pick<Mission, "stats">,
    results: readonly unknown[],
): MissionParameter[] {
    return results.length ? [] : mission.stats;
}

/** Text compared for sameness: case, a leading "I" and punctuation aside,
 *  so "I built a cluster." restates "Built a cluster". */
function comparable(text: string): string {
    return text
        .toLowerCase()
        .replace(/^\s*i\s+/, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

/**
 * A short project note's lines (contract §9): the highlights, less any
 * that only repeat the summary word for word.
 */
export function noteLines(
    summary: string,
    highlights: readonly string[],
): string[] {
    const lead = comparable(summary);
    return highlights.filter((line) => comparable(line) !== lead);
}

/** The plain text of each block of a Portable Text body; null for a block
 *  that is not text (an image, a listing, a callout). */
function blockTexts(body: ContentBody | null | undefined): (string | null)[] {
    return (body ?? []).map((block) => {
        const node = block as { _type?: string; children?: unknown };
        if (node._type !== "block" || !Array.isArray(node.children)) {
            return null;
        }
        return node.children
            .map((child) =>
                typeof (child as { text?: unknown }).text === "string"
                    ? (child as { text: string }).text
                    : "",
            )
            .join("");
    });
}

/** Short words that carry no content of their own. */
const STOP_WORDS = new Set(
    (
        "about across after all also and any are because been before being " +
        "between both but can could does each for from had has have her here " +
        "his how into its it’s more most not now off onto only other our out " +
        "over own per same she should since some such than that the their " +
        "them then there these they this those through too under until upon " +
        "using very via was were what when where which while who why will " +
        "with within without would you your"
    ).split(" "),
);

/** "published" and "publishes" → "publish"; "pages" → "pag". */
function stem(word: string): string {
    for (const suffix of ["ing", "ed", "es", "s"]) {
        if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
            return word.slice(0, -suffix.length);
        }
    }
    return word;
}

/** The distinct content words of some text, stemmed. */
function contentWords(texts: readonly (string | null | undefined)[]) {
    const words = new Set<string>();
    for (const text of texts) {
        for (const word of (text ?? "")
            .toLowerCase()
            .split(/[^\p{L}\p{N}]+/u)) {
            if (word.length >= 3 && !STOP_WORDS.has(word))
                words.add(stem(word));
        }
    }
    return words;
}

/**
 * How many content words `texts` has that `known` does not, a word
 * matching when one stem starts with the other ("page" and "pages").
 * What a reader would learn from `texts` after reading `known`.
 */
export function newWords(
    texts: readonly (string | null | undefined)[],
    known: readonly (string | null | undefined)[],
): number {
    const seen = [...contentWords(known)];
    let count = 0;
    for (const word of contentWords(texts)) {
        if (!seen.some((k) => k.startsWith(word) || word.startsWith(k))) {
            count += 1;
        }
    }
    return count;
}

/** New words that make an essay more than a restatement of its card. */
const ESSAY_ADDS = 8;
/** New words that make a brief's row more than a restatement. */
const BRIEF_ADDS = 4;

/**
 * Whether an essay says anything its summary, highlights and brief do
 * not: a section heading, anything that is not a paragraph (a photograph,
 * a listing, a callout), or at least eight content words they lack. A
 * page leaves out an essay that only restates them.
 */
export function essayAdds(
    body: ContentBody | null | undefined,
    lines: readonly string[],
): boolean {
    const blocks = body ?? [];
    const structured = blocks.some((block) => {
        const node = block as { _type?: string; style?: string };
        return (
            node._type !== "block" || /^h[2-4]$/.test(node.style ?? "normal")
        );
    });
    if (structured) return true;
    return newWords(blockTexts(blocks), lines) >= ESSAY_ADDS;
}

type LayoutSource = Pick<
    ProjectWithBody,
    | "summary"
    | "highlights"
    | "brief"
    | "results"
    | "lessons"
    | "next"
    | "model"
    | "cover"
    | "body"
>;

/** A brief's rows, in order, trimmed; empty rows left out. */
function briefRows(brief: LayoutSource["brief"]): string[] {
    return [brief?.problem, brief?.approach, brief?.outcome]
        .map((text) => text?.trim() ?? "")
        .filter(Boolean);
}

/** What a project's card already says: its summary and highlights. */
function cardLines(project: Pick<LayoutSource, "summary" | "highlights">) {
    return [project.summary ?? "", ...(project.highlights ?? [])];
}

/**
 * Whether the brief adds to the card: a row with at least four content
 * words the summary and highlights lack. A brief that only restates them
 * is not evidence of its own.
 */
export function briefAdds(
    project: Pick<LayoutSource, "summary" | "highlights" | "brief">,
): boolean {
    const known = cardLines(project);
    return briefRows(project.brief).some(
        (row) => newWords([row], known) >= BRIEF_ADDS,
    );
}

/**
 * Whether a project's page shows its essay (the Case study): when it has
 * one that says more than the summary, the highlights and the brief.
 */
export function essayShown(project: LayoutSource): boolean {
    return essayAdds(project.body, [
        ...cardLines(project),
        ...briefRows(project.brief),
    ]);
}

export type MissionLayout = "file" | "note";

/**
 * How a project's page is laid out (contract §9). The full file where
 * there is evidence to lay out: a brief that adds to the card, results,
 * lessons or next steps, the model's callouts, a photograph, or an essay
 * in sections. Otherwise a short project note: the title, the summary,
 * the highlights, the stack and the links, with no empty sections.
 */
export function missionLayout(project: LayoutSource): MissionLayout {
    const lines = [...(project.lessons ?? []), ...(project.next ?? [])];
    const callouts = (project.model?.hotspots ?? []).some((hotspot) =>
        hotspot.title?.trim(),
    );
    const plate = Boolean(project.cover?.asset || project.model?.poster?.asset);
    const evidence =
        briefAdds(project) ||
        resultRows(project.results).length > 0 ||
        lines.some((line) => line.trim()) ||
        callouts ||
        plate ||
        extractHeadings(project).length > 0;
    return evidence ? "file" : "note";
}

/**
 * Where "Read the write-up" goes from a project: its original Flight Log
 * entry, else the file's own write-up section when the file shows its
 * essay, else nowhere.
 */
export function writeUpHref(
    mission: Pick<Mission, "href">,
    project: LayoutSource | null | undefined,
    entry: Pick<LogEntry, "slug"> | null | undefined,
): string | null {
    if (entry) return `/blog/${entry.slug}`;
    if (project && missionLayout(project) === "file" && essayShown(project)) {
        return `${mission.href}#write-up`;
    }
    return null;
}

export function toMission(project: ProjectListItem, siteUrl: string): Mission {
    const name = project.name?.trim() || null;
    const summary = project.summary?.trim() ?? "";
    const highlights = (project.highlights ?? []).filter((line) => line.trim());
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
        label: name ?? project.title,
        title: project.title,
        summary,
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
        highlights,
        ...splitParameters(
            (project.parameters ?? [])
                .filter((item) => item.label?.trim() && item.value?.trim())
                .map((item) => ({
                    id: item._key,
                    label: item.label.trim(),
                    value: item.value.trim(),
                })),
            project.technologies ?? [],
            [summary, ...highlights],
        ),
        links: externalLinks(project.links, siteUrl),
        featured: project.featured ?? null,
        revised,
    };
}

/**
 * The order missions are shown in: the featured slots first (1 is the
 * flagship), then the rest by the owner's mission number, so the order
 * is his and a newly edited project does not jump ahead; the list
 * query's order breaks any tie.
 */
export function missionOrder<
    T extends { featured?: number | null; designation?: number | null },
>(projects: readonly T[]): T[] {
    const slot = (project: T) => project.featured ?? Infinity;
    const number = (project: T) => project.designation ?? Infinity;
    return projects
        .map((project, index) => ({ project, index }))
        .sort(
            (a, b) =>
                slot(a.project) - slot(b.project) ||
                number(a.project) - number(b.project) ||
                a.index - b.index,
        )
        .map(({ project }) => project);
}

/**
 * Projects in tiers, from `missionOrder`: the flagship (featured slot 1,
 * else the first), the next `rows` given room of their own, and the rest,
 * shown least prominently, so the owner's last project is the quietest.
 * The home page and /portfolio both read it.
 */
export function missionTiers<T extends { featured?: number | null }>(
    ordered: readonly T[],
    rows: number,
): { flagship: T | null; rows: T[]; also: T[] } {
    if (!ordered.length) return { flagship: null, rows: [], also: [] };
    const lead = Math.max(
        0,
        ordered.findIndex((project) => project.featured === 1),
    );
    const rest = ordered.filter((_, index) => index !== lead);
    return {
        flagship: ordered[lead],
        rows: rest.slice(0, rows),
        also: rest.slice(rows),
    };
}

/** By mission number: the files' previous / next. */
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

/**
 * Each mission's original Flight Log entry (its write-up), from the list
 * data alone: its links to the site's posts, else the oldest post that
 * references it. For the index pages (/portfolio and the home act); a
 * mission file also reads its essay and callouts (`missionEntries`).
 */
export function originalEntries(
    projects: readonly Pick<ProjectListItem, "_id" | "links">[],
    posts: readonly { slug: string; projectIds?: string[] | null }[],
    entries: readonly LogEntry[],
    siteUrl: string,
): Map<string, LogEntry> {
    const originals = new Map<string, LogEntry>();
    for (const project of projects) {
        const { original } = missionEntries({
            entries,
            postIds: new Map(),
            referencing: posts
                .filter((post) => post.projectIds?.includes(project._id))
                .map((post) => post.slug),
            links: project.links,
            body: null,
            hotspots: null,
            siteUrl,
        });
        if (original) originals.set(project._id, original);
    }
    return originals;
}

export interface Callout {
    id: string;
    title: string;
    body: string | null;
}

/**
 * A model's callouts as plain rows: the part and what it does. Until the
 * drawing lands (PR 15) there are no balloons to number, and the rows do
 * not link on: the write-up is linked once, in the head. A callout's
 * anchor still ties its post to the mission (`missionEntries`).
 */
export function missionCallouts(
    hotspots: readonly ModelHotspot[] | null | undefined,
): Callout[] {
    return (hotspots ?? [])
        .filter((hotspot) => hotspot.title?.trim())
        .map((hotspot) => ({
            id: hotspot._key,
            title: hotspot.title.trim(),
            body: hotspot.body?.trim() || null,
        }));
}
