import { cvEntries, hostOf, type CvEntry } from "@/lib/cv";
import { CURIOSITY_KINDS, type CuriosityKind } from "@/lib/profile-fields";
import type {
    CuriosityItem,
    ExternalLink,
    ProfileData,
    TimelineEntry,
} from "@/lib/sanity-client";

/**
 * The owner as the home page and About (/about) present him: the
 * interests statement, the questions and the Now list by kind, and the
 * record (G6). Pure and derived from the profile only: a value the
 * profile leaves empty is left out, never filled in.
 */

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

/**
 * The owner's one-line statement of what he is exploring, the heading of
 * the home page's close: the tagline, or else the introduction's first
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

export interface Question {
    id: string;
    title: string;
    note: string | null;
    href: string | null;
    external: boolean;
}

type Linkable = readonly { _id: string; slug: string }[];

/**
 * The items as rows, unnumbered: a question's words are its name. An item
 * that points at one of the site's posts or projects links there; one
 * with its own URL links out; a reference to something unpublished is
 * dropped, not the item.
 */
function toRows(
    items: readonly CuriosityItem[],
    posts: Linkable,
    projects: Linkable,
): Question[] {
    const postSlug = new Map(posts.map((post) => [post._id, post.slug]));
    const projectSlug = new Map(
        projects.map((project) => [project._id, project.slug]),
    );
    return items.map((item) => {
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

/** The current questions as rows, whatever their kind. */
export function questions(
    items: readonly CuriosityItem[] | null | undefined,
    posts: Linkable = [],
    projects: Linkable = [],
): Question[] {
    return toRows(listed(items), posts, projects);
}

export interface NowGroup {
    kind: CuriosityKind;
    items: Question[];
}

/**
 * The Now list on the Crew File: the items grouped by kind, in the
 * schema's order (questions first). An item saved before kinds existed
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
        ),
    })).filter((group) => group.items.length > 0);
}

export interface RecordCell {
    id: "name" | "studying" | "previously" | "focus" | "links";
    value: string;
    /** A second line: the organization and the dates. */
    note?: string | null;
    links?: { label: string; url: string; host: string }[];
    span: number;
    spanSm: 1 | 2;
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
 * The record (G6, the title block): the name, what the owner studies and
 * did last, then the focus and the profile links, on two rows of 12
 * columns. Only cells with a value are drawn, and the rows close up.
 * What the owner is open to is the home hero's and the heads' of /resume
 * and /contact; the profile's edit date is no fact about him.
 */
export function crewRecord(profile: ProfileData | null): RecordCell[] {
    if (!profile?.name?.trim()) return [];
    const studying = cvEntries(profile.timeline).all.find(
        (entry) => entry.current && entry.kind === "education",
    );
    const previously = previousRole(profile.timeline);
    const focus = (profile.focusAreas ?? []).filter((item) => item?.trim());
    const links = (profile.socialLinks ?? [])
        .filter((link): link is ExternalLink =>
            Boolean(link?.label && /^https?:\/\//.test(link.url ?? "")),
        )
        .map((link) => ({
            label: link.label,
            url: link.url,
            host: hostOf(link.url),
        }));
    const when = (entry: CvEntry) =>
        [entry.organization, entry.dates, entry.expected]
            .filter(Boolean)
            .join(" · ");

    const first: Omit<RecordCell, "span" | "spanSm">[] = [
        { id: "name", value: profile.name.trim() },
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
        ...(links.length ? [{ id: "links" as const, value: "", links }] : []),
    ];
    const firstSpans = share(first.length, 12);
    const secondSpans = share(second.length, 12);
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
    ];
}
