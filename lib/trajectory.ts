import type { CvEntry } from "@/lib/cv";
import { decimalYear, todayYear } from "@/lib/orbit/geometry";
import { availabilityLine } from "@/lib/profile-content";
import { contactHref } from "@/lib/navigation";
import type { Availability } from "@/lib/sanity-client";

/**
 * The flight on /resume/trajectory: the profile's timeline as chapters,
 * oldest first, and the scroll route through them. Pure and shared by
 * every renderer (the plot, the voyage, the 3D flight), so they all tell
 * the same record; only the drawing differs.
 *
 * A route is a list of segments, each with a scroll weight:
 * - a **coast** holds a chapter (a role or a degree held for a period);
 * - a **flyby** is a short encounter (an internship);
 * - a **transfer** joins two chapters (the burn between them);
 * - the **plan** closes the route with the owner's Open To line, when set.
 * Scroll progress p ∈ [0, 1] picks a segment and a phase u ∈ [0, 1] in it,
 * and the mission date t runs from the segment's start to its end.
 */

export interface Chapter {
    id: string;
    /** The card's small label: "Education", "Internship", "Work"… */
    label: string;
    kind: "work" | "education";
    flyby: boolean;
    title: string;
    /** A long parenthetical moved out of the title ("promoted from…"). */
    note: string | null;
    organization: string;
    orgLabel: string;
    dates: string | null;
    current: boolean;
    expected: string | null;
    /** One line: the summary, else the first highlight. */
    line: string | null;
    /** The transfer's name into this chapter ("Security → Cloud"). */
    burn: string | null;
    /** Decimal years; a current chapter ends today. */
    start: number;
    end: number;
    /** Only the start year is known: never print a month for it. */
    startYearOnly: boolean;
    /** Only the end year is known: never print a month in that year. */
    endYearOnly: boolean;
    /** The start is not recorded: the chapter is still flown, over a
     *  nominal span, but no date before its end is ever printed. */
    startKnown: boolean;
    /** The rail's year: the start's, else the end's. */
    year: string;
    /** The CV row on /resume. */
    href: string;
}

export interface PlannedLeg {
    lines: string[];
    cta: string | null;
    href: string;
}

export interface TrajectoryData {
    chapters: Chapter[];
    today: number;
    planned: PlannedLeg | null;
}

/** "Field Software Engineer I (promoted from … first year)" → title + note.
 *  A short parenthetical ("(Interdisciplinary)") stays in the title. */
export function splitTitle(title: string): [string, string | null] {
    const match = /^(.*\S)\s*\(([^()]+)\)$/.exec(title.trim());
    if (!match || match[2].trim().split(/\s+/).length < 3)
        return [title.trim(), null];
    const note = match[2].trim();
    return [match[1], note.charAt(0).toUpperCase() + note.slice(1)];
}

/** The span given to an entry whose start is not recorded, in years. */
const NOMINAL_SPAN = 1.5;
/** The shortest leg an entry is flown for, in years. */
const MIN_SPAN = 0.25;
const INTERN = /\bintern(ship)?\b/i;

export function trajectoryData(
    entries: readonly CvEntry[],
    availability: Availability | null | undefined,
    todayIso: string,
): TrajectoryData {
    const today = todayYear(todayIso);
    // Every dated entry is flown. One whose start is missing, or not before
    // its end (a placeholder), gets a nominal span that ends on its end.
    const placed = entries
        .map((entry) => {
            const o = entry.orbit;
            const end = entry.current
                ? today
                : decimalYear(o.endDate, o.endPrecision);
            const recorded = decimalYear(o.startDate, o.startPrecision);
            const startKnown =
                recorded !== null && end !== null && recorded < end;
            const start = startKnown
                ? recorded
                : end !== null
                  ? end - NOMINAL_SPAN
                  : null;
            return { entry, start, end, startKnown };
        })
        .filter(
            (
                x,
            ): x is {
                entry: CvEntry;
                start: number;
                end: number;
                startKnown: boolean;
            } => x.start !== null && x.end !== null,
        )
        .sort((a, b) => a.start - b.start);

    const chapters: Chapter[] = [];
    for (const { entry, start, end, startKnown } of placed) {
        // Overlapping entries are flown one after another; an entry wholly
        // inside the one before it still gets a short leg of its own.
        const prevEnd = chapters.at(-1)?.end ?? start;
        const from = Math.max(start, prevEnd);
        const until = end > from ? end : from + MIN_SPAN;
        const [title, note] = splitTitle(entry.title);
        const flyby = INTERN.test(entry.employment ?? entry.title);
        chapters.push({
            id: entry.id,
            label:
                entry.employment ??
                (flyby
                    ? "Internship"
                    : entry.kind === "education"
                      ? "Education"
                      : "Work"),
            kind: entry.kind,
            flyby,
            title,
            note,
            organization: entry.organization,
            orgLabel: entry.orgLabel,
            dates: entry.dates,
            current: entry.current,
            expected: entry.expected,
            line: entry.summary ?? entry.highlights[0] ?? null,
            burn: entry.burn,
            start: from,
            end: until,
            startYearOnly:
                entry.orbit.startPrecision === "year" ||
                /^\d{4}$/.test(entry.orbit.startDate ?? ""),
            endYearOnly:
                !entry.current &&
                (entry.orbit.endPrecision === "year" ||
                    /^\d{4}$/.test(entry.orbit.endDate ?? "")),
            startKnown: startKnown && from === start,
            year: String(Math.floor(startKnown ? from : end)),
            href: `/resume#${entry.anchor}`,
        });
    }

    const openTo = availabilityLine(availability);
    const lines = (availability?.seeking ?? [])
        .map((opening) => opening?.label?.trim())
        .filter((line): line is string => Boolean(line));
    return {
        chapters,
        today,
        planned: openTo
            ? {
                  lines: lines.length ? lines : [openTo],
                  cta: availability?.cta?.trim() || null,
                  href: contactHref("hiring"),
              }
            : null,
    };
}

/* ---- the route ---------------------------------------------------------- */

export type SegmentKind = "coast" | "flyby" | "transfer" | "plan";

export interface Segment {
    kind: SegmentKind;
    /** The chapter held (coast, flyby) or arrived at (transfer). */
    chapter: number;
    /** A transfer's departure chapter. */
    from: number | null;
    t0: number;
    t1: number;
    /** Scroll weight, and the progress span it maps to. */
    w: number;
    p0: number;
    p1: number;
}

export interface Route {
    segments: Segment[];
    /** Total weight: the section is (100 + weight × unit) svh tall. */
    weight: number;
    /** The number of cards: the chapters, plus one for the plan. */
    cards: number;
    /** Where the rail sends each card: a progress that shows it settled. */
    rest: number[];
    /** The end of the flown route (the plan follows it). */
    flown: number;
}

export interface Frame {
    p: number;
    segment: Segment;
    index: number;
    u: number;
    /** Mission date, decimal years. */
    t: number;
    /** The card on show: a transfer hands over at its midpoint. */
    card: number;
}

/** A renderer's pacing. The defaults are every renderer's route. */
export interface RouteOptions {
    /** A transfer's weight. */
    transfer?: number;
    /** The plan's weight. */
    plan?: number;
    /** Extra weight on the first chapter, for an opening move. */
    open?: number;
    /** Where the first card settles, as a share of its chapter (0: the
     *  route's start). */
    restFirst?: number;
}

export function buildRoute(
    data: TrajectoryData,
    { transfer = 0.65, plan = 1.3, open = 0, restFirst = 0 }: RouteOptions = {},
): Route {
    const segments: Segment[] = [];
    const add = (s: Omit<Segment, "p0" | "p1">) =>
        segments.push({ ...s, p0: 0, p1: 0 });
    data.chapters.forEach((chapter, i) => {
        if (i > 0) {
            const prev = data.chapters[i - 1];
            add({
                kind: "transfer",
                chapter: i,
                from: i - 1,
                t0: prev.end,
                t1: chapter.startKnown ? chapter.start : prev.end,
                w: transfer,
            });
        }
        const years = chapter.end - chapter.start;
        add({
            kind: chapter.flyby ? "flyby" : "coast",
            chapter: i,
            from: null,
            t0: chapter.start,
            t1: chapter.end,
            // Longer chapters get a little more scroll, within limits.
            w:
                Math.min(
                    1.5,
                    Math.max(chapter.flyby ? 0.9 : 1, 0.8 + years * 0.18),
                ) + (i === 0 ? open : 0),
        });
    });
    if (data.planned && data.chapters.length) {
        add({
            kind: "plan",
            chapter: data.chapters.length,
            from: data.chapters.length - 1,
            t0: data.today,
            t1: data.today,
            w: plan,
        });
    }
    const weight = segments.reduce((sum, s) => sum + s.w, 0) || 1;
    let acc = 0;
    for (const s of segments) {
        s.p0 = acc / weight;
        acc += s.w;
        s.p1 = acc / weight;
    }
    const cards = data.chapters.length + (data.planned ? 1 : 0);
    const rest = Array.from({ length: cards }, (_, card) => {
        const s = segments.find(
            (seg) => seg.kind !== "transfer" && seg.chapter === card,
        );
        if (!s) return 1;
        if (card === 0) return s.p0 + (s.p1 - s.p0) * restFirst;
        return s.kind === "plan" ? 1 : s.p0 + (s.p1 - s.p0) * 0.55;
    });
    const lastFlown = [...segments].reverse().find((s) => s.kind !== "plan");
    return {
        segments,
        weight,
        cards,
        rest,
        flown: lastFlown ? lastFlown.p1 : 1,
    };
}

export function frameAt(route: Route, progress: number): Frame {
    const p = Math.min(1, Math.max(0, progress));
    const { segments } = route;
    let index = segments.findIndex((s) => p <= s.p1);
    if (index < 0) index = segments.length - 1;
    const segment = segments[index];
    const span = segment.p1 - segment.p0 || 1;
    const u = Math.min(1, Math.max(0, (p - segment.p0) / span));
    const card =
        segment.kind === "transfer"
            ? u < 0.5
                ? segment.from!
                : segment.chapter
            : segment.chapter;
    return {
        p,
        segment,
        index,
        u,
        t: segment.t0 + (segment.t1 - segment.t0) * u,
        card,
    };
}

const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

/** The mission date for the readout: "Mar 2024", or "2021" where the
 *  record holds only the year. A year-only bound never gets a month: not
 *  while its chapter is held (a year-only start holds the whole chapter to
 *  years), and not in a transfer's run through that year. */
export function missionDate(
    t: number,
    data: TrajectoryData,
    frame: Frame,
): string {
    const { segment } = frame;
    const chapter = data.chapters[segment.chapter];
    const from =
        segment.from === null ? undefined : data.chapters[segment.from];
    const held = segment.kind === "coast" || segment.kind === "flyby";
    // Never print a date the record doesn't hold: an unrecorded start shows
    // the chapter's end throughout.
    const at = chapter && held && !chapter.startKnown ? chapter.end : t;
    const year = Math.floor(at + 1e-6);
    const yearOf = (v: number) => Math.floor(v + 1e-6);
    const yearOnly = held
        ? Boolean(
              chapter?.startYearOnly ||
              (chapter?.endYearOnly && year >= yearOf(chapter.end)),
          )
        : segment.kind === "transfer" &&
          Boolean(
              (from?.endYearOnly && year <= yearOf(from.end)) ||
              (chapter?.startYearOnly && year >= yearOf(chapter.start)),
          );
    if (yearOnly) return String(year);
    const month = Math.min(11, Math.max(0, Math.floor((at - year) * 12)));
    return `${MONTHS[month]} ${year}`;
}
