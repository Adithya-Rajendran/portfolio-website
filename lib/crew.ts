import { cvEntries, hostOf, type CvEntry } from "@/lib/cv";
import { formatEntryDate } from "@/lib/log-index";
import { availabilityLine } from "@/lib/profile-content";
import { CURIOSITY_KINDS, type CuriosityKind } from "@/lib/profile-fields";
import type {
    CuriosityItem,
    ExternalLink,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

/**
 * The owner as the home page and the Crew File (/about) present them:
 * the current role, the tagline, the availability line, the questions
 * and the Now list by kind, and the record (G6). Pure and derived from the profile only:
 * a value the profile leaves empty is left out, never filled in.
 */

/** The first current entry in the owner's order: the "Now" role. */
export function currentEntry(
    timeline: readonly TimelineEntry[] | null | undefined,
): CvEntry | null {
    return cvEntries(timeline).all.find((entry) => entry.current) ?? null;
}

/** The finished role that ended last: the record's "Previously". */
export function previousRole(
    timeline: readonly TimelineEntry[] | null | undefined,
): CvEntry | null {
    const ended = (timeline ?? [])
        .filter(
            (entry) =>
                entry?.kind === "work" &&
                entry.title &&
                entry.organization &&
                !(entry.isCurrent ?? !entry.endDate) &&
                entry.endDate,
        )
        .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));
    return ended.length ? cvEntries([ended[0]]).all[0] : null;
}

/** "MS Engineering (Interdisciplinary) · San José State University". */
export function roleLine(entry: Pick<CvEntry, "title" | "organization">) {
    return `${entry.title} · ${entry.organization}`;
}

/**
 * The hero's intent line: the tagline, or else the introduction's first
 * sentence (plan §3.2).
 */
export function taglineOf(profile: ProfileData | null): string | null {
    const tagline = profile?.tagline?.trim();
    if (tagline) return tagline;
    const intro = profile?.introduction?.trim();
    if (!intro) return null;
    const match = /^.+?[.!?](?=\s|$)/.exec(intro);
    return (match ? match[0] : intro).trim();
}

/**
 * What the owner is open to (`availabilityLine`: the Open To lines joined
 * with " · "), and when that was last confirmed: nothing while
 * availability is unset or Closed.
 */
export function openTo(profile: ProfileData | null): {
    text: string;
    updated: { date: string; label: string } | null;
} | null {
    const availability = profile?.availability;
    const text = availabilityLine(availability);
    if (!text) return null;
    const date = /^\d{4}-\d{2}-\d{2}/.exec(availability?.updatedAt ?? "")?.[0];
    return {
        text,
        updated: date ? { date, label: formatEntryDate(date) } : null,
    };
}

/** The first paragraph of the biography (paragraphs are blank-line apart). */
export function firstParagraph(bio: string | null | undefined): string | null {
    const first = (bio ?? "")
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .find(Boolean);
    return first ?? null;
}

export interface Question {
    id: string;
    /** "Q1". */
    num: string;
    title: string;
    note: string | null;
    href: string | null;
    external: boolean;
}

type Linkable = readonly { _id: string; slug: string }[];

/**
 * The items as rows, numbered by `num`. An item that points at one of the
 * site's posts or projects links there; one with its own URL links out; a
 * reference to something unpublished is dropped, not the item.
 */
function toRows(
    items: readonly CuriosityItem[],
    posts: Linkable,
    projects: Linkable,
    num: (index: number) => string,
): Question[] {
    const postSlug = new Map(posts.map((post) => [post._id, post.slug]));
    const projectSlug = new Map(
        projects.map((project) => [project._id, project.slug]),
    );
    return items.map((item, index) => {
        const post = item.postId ? postSlug.get(item.postId) : undefined;
        const project = item.projectId
            ? projectSlug.get(item.projectId)
            : undefined;
        const url = /^https?:\/\//.test(item.url ?? "") ? item.url! : null;
        const href = post
            ? `/blog/${post}`
            : project
              ? `/portfolio/${project}`
              : url;
        return {
            id: item._key,
            num: num(index),
            title: item.title.trim(),
            note: item.note?.trim() || null,
            href,
            external: Boolean(href && href === url),
        };
    });
}

function listed(
    items: readonly CuriosityItem[] | null | undefined,
): CuriosityItem[] {
    return (items ?? []).filter((item) => item?.title?.trim());
}

/** The current questions as numbered rows (Q1…), whatever their kind. */
export function questions(
    items: readonly CuriosityItem[] | null | undefined,
    posts: Linkable = [],
    projects: Linkable = [],
): Question[] {
    return toRows(listed(items), posts, projects, (index) => `Q${index + 1}`);
}

export interface NowGroup {
    kind: CuriosityKind;
    items: Question[];
}

/**
 * The Now list on the Crew File: the items grouped by kind, in the
 * schema's order (questions first), each group numbered from one:
 * questions Q1…, the other kinds 01…. An item saved before kinds existed
 * (or with an unknown kind) is a question. Empty groups are absent.
 */
export function nowGroups(
    items: readonly CuriosityItem[] | null | undefined,
    posts: Linkable = [],
    projects: Linkable = [],
): NowGroup[] {
    const all = listed(items);
    const kindOf = (item: CuriosityItem): CuriosityKind =>
        CURIOSITY_KINDS.some((option) => option.value === item.kind)
            ? item.kind!
            : "question";
    return CURIOSITY_KINDS.map(({ value: kind }) => ({
        kind,
        items: toRows(
            all.filter((item) => kindOf(item) === kind),
            posts,
            projects,
            (index) =>
                kind === "question"
                    ? `Q${index + 1}`
                    : String(index + 1).padStart(2, "0"),
        ),
    })).filter((group) => group.items.length > 0);
}

export interface RecordCell {
    id:
        | "name"
        | "studying"
        | "previously"
        | "focus"
        | "openTo"
        | "links"
        | "updated";
    value: string;
    /** A second line: the organization and the dates. */
    note?: string | null;
    links?: { label: string; url: string; host: string }[];
    /** `YYYY-MM-DD`, for a date cell's `<time>`. */
    date?: string;
    span: number;
    spanSm: 1 | 2;
    accent?: boolean;
}

/** Share `total` columns among `count` cells, the remainder to the last. */
function share(count: number, total: number): number[] {
    if (!count) return [];
    const base = Math.floor(total / count);
    return Array.from({ length: count }, (_, index) =>
        index === count - 1 ? total - base * (count - 1) : base,
    );
}

/**
 * The record (G6, the title block): the name (the accent cell), what the
 * owner studies and did last, the focus, what they are open to, the
 * profile links and the date of the last edit, on two rows of 12
 * columns. Only cells with a value are drawn, and the rows close up.
 */
export function crewRecord(profile: ProfileData | null): RecordCell[] {
    if (!profile?.name?.trim()) return [];
    const studying = cvEntries(profile.timeline).all.find(
        (entry) => entry.current && entry.kind === "education",
    );
    const previously = previousRole(profile.timeline);
    const focus = (profile.focusAreas ?? []).filter((item) => item?.trim());
    const open = openTo(profile);
    const links = (profile.socialLinks ?? [])
        .filter((link): link is ExternalLink =>
            Boolean(link?.label && /^https?:\/\//.test(link.url ?? "")),
        )
        .map((link) => ({
            label: link.label,
            url: link.url,
            host: hostOf(link.url),
        }));
    const updated = /^\d{4}-\d{2}-\d{2}/.exec(profile._updatedAt ?? "")?.[0];
    const when = (entry: CvEntry) =>
        [entry.organization, entry.dates, entry.expected]
            .filter(Boolean)
            .join(" · ");

    const first: Omit<RecordCell, "span" | "spanSm">[] = [
        { id: "name", value: profile.name.trim(), accent: true },
        ...(studying
            ? [
                  {
                      id: "studying" as const,
                      value: studying.title,
                      note: when(studying),
                  },
              ]
            : []),
        ...(previously
            ? [
                  {
                      id: "previously" as const,
                      value: previously.title,
                      note: when(previously),
                  },
              ]
            : []),
    ];
    const second: Omit<RecordCell, "span" | "spanSm">[] = [
        ...(focus.length
            ? [{ id: "focus" as const, value: focus.join(" · ") }]
            : []),
        ...(open ? [{ id: "openTo" as const, value: open.text }] : []),
        ...(links.length ? [{ id: "links" as const, value: "", links }] : []),
    ];
    const firstSpans = share(first.length, 12);
    const secondSpans = share(second.length, updated ? 10 : 12);
    return [
        ...first.map((cell, index) => ({
            ...cell,
            span: firstSpans[index],
            spanSm: 2 as const,
        })),
        ...second.map((cell, index) => ({
            ...cell,
            span: secondSpans[index],
            spanSm: 2 as const,
        })),
        ...(updated
            ? [
                  {
                      id: "updated" as const,
                      value: formatEntryDate(updated),
                      date: updated,
                      span: second.length ? 2 : 12,
                      spanSm: 2 as const,
                  },
              ]
            : []),
    ];
}
