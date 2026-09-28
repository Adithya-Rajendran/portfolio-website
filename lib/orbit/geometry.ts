/**
 * The Trajectory orbit map (G2) as pure geometry: the profile's timeline
 * becomes orbits on a time axis, one per role or degree, each raised one
 * level above the last, joined by transfers. `orbitModel` places the
 * entries in time; `horizontalMap` (time runs right, from 60rem) and
 * `verticalMap` (time runs up, on phones) project that model into SVG path
 * data and anchors for the HTML labels, so the server draws both and CSS
 * picks one. Nothing here reads the clock: "today" is passed in.
 *
 * - **Dates** sit at the middle of their month, or of their year when only
 *   the year is known, so an orbit covers the months it names.
 * - **The zero-length guard:** an entry whose start is not before its end
 *   (the Studio warns about equal dates) has no known start, so it is drawn
 *   fading in before its end instead of as a point. So is an entry with no
 *   start at all.
 * - **Burns** are the changes of role: each transfer arrives at the next
 *   orbit's start. A **coast** is a transfer that spans whole months.
 * - **Flybys:** an internship inside another entry's dates arcs over that
 *   orbit instead of taking a level of its own.
 * - **The planned orbit** comes from `availability.from` and is drawn
 *   dashed, fading out: it has no end.
 */

export type OrbitPrecision = "month" | "year";

/** The fields of a timeline entry the map reads. */
export interface OrbitEntry {
    id: string;
    kind: "work" | "education";
    employment?: string | null;
    startDate?: string | null;
    startPrecision?: OrbitPrecision | null;
    endDate?: string | null;
    endPrecision?: OrbitPrecision | null;
    isCurrent?: boolean | null;
    expectedEndYear?: number | null;
}

export interface Orbit {
    id: string;
    /** 1 is the earliest entry: "Orbit 01". */
    number: number;
    /** 0 is the lowest orbit; a flyby shares its host's level. */
    level: number;
    kind: "work" | "education";
    /** Where the drawing starts and ends, in decimal years. */
    from: number;
    to: number;
    /** False when the start is unknown: the orbit fades in. */
    startKnown: boolean;
    /** False when the end is unknown: the orbit fades out. */
    endKnown: boolean;
    current: boolean;
    /** Today, on the current orbit. */
    now: number | null;
    /** The host orbit's id, when this entry is a flyby. */
    host: string | null;
}

export interface Transfer {
    from: string;
    to: string;
    /** Leaves the previous orbit here (its end)… */
    depart: number;
    /** …and burns into the next one here (its start). */
    arrive: number;
    /** Whole months between the two; 0 when one role follows the next. */
    coastMonths: number;
}

export interface PlannedOrbit {
    level: number;
    from: number;
    to: number;
    /** The orbit it departs from. */
    after: string | null;
}

export interface OrbitModel {
    /** The axis, in decimal years. */
    min: number;
    max: number;
    today: number;
    /** Whole years on the axis. */
    years: number[];
    /** In time order, flybys included. */
    orbits: Orbit[];
    transfers: Transfer[];
    planned: PlannedOrbit | null;
}

const MONTH = 1 / 12;
/** How far before its end an orbit with no known start is drawn. */
const UNKNOWN_SPAN = 1;
/** How far past today a current orbit with no expected end is drawn. */
const ONGOING_SPAN = 0.4;
const PLANNED_SPAN = 1;
const AXIS_PAD = 0.3;

function parts(
    iso: string | null | undefined,
): [number, number, number] | null {
    const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso ?? "");
    if (!match) return null;
    return [Number(match[1]), Number(match[2] ?? 1), Number(match[3] ?? 1)];
}

/**
 * A date as a decimal year: the middle of its month ("2024-05-01" →
 * 2024.375), or the middle of its year when only the year is known.
 */
export function decimalYear(
    iso: string | null | undefined,
    precision?: OrbitPrecision | null,
): number | null {
    const date = parts(iso);
    if (!date) return null;
    const [year, month] = date;
    if (precision === "year" || /^\d{4}$/.test(iso ?? "")) return year + 0.5;
    return year + (month - 0.5) * MONTH;
}

/** Today as a decimal year, to the day. */
export function todayYear(iso: string): number {
    const date = parts(iso);
    if (!date) return Number.NaN;
    const [year, month, day] = date;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return year + (month - 1 + (day - 0.5) / days) * MONTH;
}

interface Placed {
    entry: OrbitEntry;
    start: number | null;
    end: number | null;
    current: boolean;
}

function place(entry: OrbitEntry): Placed | null {
    const current = entry.isCurrent ?? !entry.endDate;
    let start = decimalYear(entry.startDate, entry.startPrecision);
    const end = current ? null : decimalYear(entry.endDate, entry.endPrecision);
    // The zero-length guard: a start that is not before the end is unknown.
    if (start !== null && end !== null && start >= end) start = null;
    if (current && start === null) return null;
    if (start === null && end === null) return null;
    return { entry, start, end, current };
}

/** The entry that contains an internship's dates, if any. */
function flybyHost(item: Placed, all: readonly Placed[]): Placed | null {
    if (item.entry.employment !== "internship") return null;
    if (item.start === null || item.end === null) return null;
    return (
        all.find(
            (other) =>
                other !== item &&
                other.entry.employment !== "internship" &&
                other.start !== null &&
                other.start <= item.start! &&
                (other.current ||
                    (other.end !== null && other.end >= item.end!)),
        ) ?? null
    );
}

/**
 * Places the timeline in time. `plannedFrom` is `availability.from` (pass
 * nothing while availability is closed). Returns null when no entry can be
 * placed.
 */
export function orbitModel({
    entries,
    today,
    plannedFrom,
}: {
    entries: readonly OrbitEntry[];
    today: string;
    plannedFrom?: string | null;
}): OrbitModel | null {
    const now = todayYear(today);
    if (!Number.isFinite(now)) return null;
    const placed = entries
        .map(place)
        .filter((item): item is Placed => item !== null)
        .sort((a, b) => (a.start ?? a.end!) - (b.start ?? b.end!));
    if (!placed.length) return null;

    const hosts = new Map(
        placed.map((item) => [item, flybyHost(item, placed)]),
    );
    const orbits: Orbit[] = [];
    let level = 0;
    let previous: Orbit | null = null;
    for (const [index, item] of placed.entries()) {
        const host = hosts.get(item) ?? null;
        const startKnown = item.start !== null;
        const endKnown = item.end !== null || item.current;
        let to: number;
        if (item.current) {
            const expected =
                item.entry.expectedEndYear != null
                    ? item.entry.expectedEndYear + 0.5
                    : now + ONGOING_SPAN;
            to = Math.max(expected, now + MONTH);
        } else {
            to = item.end ?? item.start! + UNKNOWN_SPAN;
        }
        // An unknown start is drawn a year before the end, after the
        // previous orbit.
        const from =
            item.start ??
            Math.min(
                Math.max(
                    to - UNKNOWN_SPAN,
                    previous && !host ? previous.to : -Infinity,
                ),
                to - MONTH,
            );
        const orbit: Orbit = {
            id: item.entry.id,
            number: index + 1,
            level: 0,
            kind: item.entry.kind,
            from,
            to,
            startKnown,
            endKnown,
            current: item.current,
            now: item.current ? Math.min(Math.max(now, from), to) : null,
            host: host?.entry.id ?? null,
        };
        if (!host) {
            orbit.level = level;
            level += 1;
            previous = orbit;
        }
        orbits.push(orbit);
    }
    for (const orbit of orbits) {
        if (orbit.host) {
            orbit.level = orbits.find(
                (other) => other.id === orbit.host,
            )!.level;
        }
    }

    const chain = orbits.filter((orbit) => !orbit.host);
    const transfers: Transfer[] = [];
    for (let i = 1; i < chain.length; i += 1) {
        const before = chain[i - 1];
        const after = chain[i];
        const depart = Math.min(before.to, after.from);
        transfers.push({
            from: before.id,
            to: after.id,
            depart,
            arrive: after.from,
            coastMonths: after.startKnown
                ? Math.max(0, Math.round((after.from - before.to) * 12))
                : 0,
        });
    }

    const plannedStart = decimalYear(plannedFrom, "month");
    const last = chain[chain.length - 1];
    const planned: PlannedOrbit | null =
        plannedStart !== null
            ? {
                  level,
                  from: plannedStart,
                  to: plannedStart + PLANNED_SPAN,
                  after: last?.id ?? null,
              }
            : null;

    const min = Math.min(...orbits.map((orbit) => orbit.from), now) - AXIS_PAD;
    const max =
        Math.max(
            ...orbits.map((orbit) => orbit.to),
            planned?.to ?? -Infinity,
            now,
        ) + AXIS_PAD;
    const years: number[] = [];
    for (let year = Math.ceil(min); year <= Math.floor(max); year += 1) {
        years.push(year);
    }
    return { min, max, today: now, years, orbits, transfers, planned };
}

/* ---- Projections -------------------------------------------------------- */

export interface Point {
    x: number;
    y: number;
}

/**
 * A fade along the time axis, from `a` (transparent at `in`'s start) to
 * `b`, in the projection's units.
 */
export interface Fade {
    a: number;
    b: number;
    dir: "in" | "out";
}

/** Where an orbit's label sits, and how it hangs from that point. */
export interface LabelAnchor extends Point {
    /** below: top-left corner; above: bottom-left; right: middle-left. */
    place: "below" | "above" | "right";
}

export interface OrbitShape {
    id: string;
    /** The closed orbit. */
    d: string;
    /** Current orbit: the arc flown so far, and today's point on it. */
    flown: string | null;
    now: Point | null;
    fade: Fade | null;
    label: LabelAnchor;
    flyby: boolean;
}

export interface TransferShape {
    from: string;
    to: string;
    d: string | null;
    /** The burn, on the axis. */
    burn: Point;
    coast: boolean;
}

export interface PlannedShape {
    d: string;
    link: string | null;
    fade: Fade;
    label: LabelAnchor;
}

export interface MapProjection {
    /** The viewBox. Horizontal: 1000 wide, stretched to the plot; vertical: px. */
    width: number;
    height: number;
    axis: { x1: number; y1: number; x2: number; y2: number };
    /** Each year's tick and grid line (x or y by orientation). */
    ticks: { year: number; at: number }[];
    /** The grid lines' extent across the time axis. */
    grid: { from: number; to: number };
    orbits: OrbitShape[];
    transfers: TransferShape[];
    planned: PlannedShape | null;
    /** Today on the axis. */
    now: Point;
}

const round = (value: number) => Math.round(value * 10) / 10;
const pt = (x: number, y: number) => `${round(x)} ${round(y)}`;

/** Horizontal map: the viewBox is this wide, so x / 10 is a percentage. */
export const H_WIDTH = 1000;
const H = {
    pad: 16,
    r: 24,
    step: 72,
    /** From the axis to the lowest orbit's centre: room for its label. */
    base: 100,
    /** Above the highest orbit: room for a label hung above it. */
    topLabels: 84,
    top: 20,
    /** Below the axis: the year labels and burn marks. */
    below: 40,
    lift: 34,
};

/**
 * Time runs left to right on a 1000-unit width that CSS stretches to the
 * plot (preserveAspectRatio="none"); heights are pixels. Every orbit is an
 * ellipse spanning its dates, one level above the last.
 */
export function horizontalMap(model: OrbitModel): MapProjection {
    const chainLevels = model.orbits.map((orbit) => orbit.level);
    const topLevel = Math.max(...chainLevels, model.planned?.level ?? 0);
    const hasAbove =
        model.planned !== null || model.orbits.some((orbit) => orbit.host);
    const top = hasAbove ? H.topLabels : H.top;
    const yAxis = top + H.r + topLevel * H.step + H.base;
    const height = yAxis + H.below;
    const k = (H_WIDTH - 2 * H.pad) / (model.max - model.min);
    const x = (t: number) => H.pad + (t - model.min) * k;
    const cy = (level: number) => yAxis - H.base - level * H.step;
    const byId = new Map(model.orbits.map((orbit) => [orbit.id, orbit]));

    /** The upper edge of an orbit at time t. */
    const upper = (orbit: Orbit, t: number): Point => {
        const x0 = x(orbit.from);
        const x1 = x(orbit.to);
        const cx = (x0 + x1) / 2;
        const rx = Math.max((x1 - x0) / 2, 0.5);
        const dx = Math.min(Math.max((x(t) - cx) / rx, -1), 1);
        return { x: x(t), y: cy(orbit.level) - H.r * Math.sqrt(1 - dx * dx) };
    };

    const ellipse = (from: number, to: number, level: number) => {
        const x0 = x(from);
        const x1 = Math.max(x(to), x0 + 1);
        const rx = round((x1 - x0) / 2);
        const y = cy(level);
        return `M${pt(x0, y)}A${rx} ${H.r} 0 1 1 ${pt(x1, y)}A${rx} ${H.r} 0 1 1 ${pt(x0, y)}Z`;
    };

    const orbits: OrbitShape[] = model.orbits.map((orbit) => {
        if (orbit.host) {
            const host = byId.get(orbit.host)!;
            const a = upper(host, orbit.from);
            const b = upper(host, orbit.to);
            const peak = cy(host.level) - H.r - H.lift;
            return {
                id: orbit.id,
                d: `M${pt(a.x, a.y)}C${pt(a.x, peak)} ${pt(b.x, peak)} ${pt(b.x, b.y)}`,
                flown: null,
                now: null,
                fade: null,
                label: {
                    x: (a.x + b.x) / 2,
                    y: peak - 8,
                    place: "above",
                },
                flyby: true,
            };
        }
        const x0 = x(orbit.from);
        const x1 = x(orbit.to);
        const y = cy(orbit.level);
        let flown: string | null = null;
        let now: Point | null = null;
        if (orbit.current && orbit.now !== null) {
            now = upper(orbit, orbit.now);
            flown = `M${pt(x0, y)}A${round((x1 - x0) / 2)} ${H.r} 0 0 1 ${pt(now.x, now.y)}`;
        }
        const span = Math.min(x1 - x0, 0.8 * k) * 0.8;
        const fade: Fade | null = !orbit.startKnown
            ? { a: x0, b: x0 + span, dir: "in" }
            : !orbit.endKnown
              ? { a: x1 - span, b: x1, dir: "out" }
              : null;
        return {
            id: orbit.id,
            d: ellipse(orbit.from, orbit.to, orbit.level),
            flown,
            now,
            fade,
            label: {
                x: orbit.startKnown ? x0 : x0 + span * 0.5,
                y: y + H.r + 8,
                place: "below",
            },
            flyby: false,
        };
    });

    const transfers: TransferShape[] = model.transfers.map((transfer) => {
        const before = byId.get(transfer.from)!;
        const after = byId.get(transfer.to)!;
        const xa = x(transfer.depart);
        const xb = x(transfer.arrive);
        const ya = cy(before.level);
        const yb = cy(after.level);
        const dx = xb - xa;
        const d =
            dx < 2
                ? `M${pt(xb, ya)}L${pt(xb, yb)}`
                : `M${pt(xa, ya)}C${pt(xa + dx * 0.55, ya)} ${pt(xb - dx * 0.55, yb)} ${pt(xb, yb)}`;
        return {
            from: transfer.from,
            to: transfer.to,
            d,
            burn: { x: xb, y: yAxis },
            coast: transfer.coastMonths > 0,
        };
    });

    let planned: PlannedShape | null = null;
    if (model.planned) {
        const p = model.planned;
        const x0 = x(p.from);
        const x1 = x(p.to);
        const y = cy(p.level);
        const after = p.after ? byId.get(p.after) : undefined;
        let link: string | null = null;
        if (after) {
            if (p.from <= after.to) {
                const edge = upper(after, Math.max(p.from, after.from));
                link = `M${pt(x0, edge.y)}L${pt(x0, y)}`;
            } else {
                const xa = x(after.to);
                const ya = cy(after.level);
                const dx = x0 - xa;
                link = `M${pt(xa, ya)}C${pt(xa + dx * 0.55, ya)} ${pt(x0 - dx * 0.55, y)} ${pt(x0, y)}`;
            }
        }
        planned = {
            d: ellipse(p.from, p.to, p.level),
            link,
            fade: { a: x0 + (x1 - x0) * 0.35, b: x1, dir: "out" },
            label: { x: x0, y: y - H.r - 8, place: "above" },
        };
    }

    return {
        width: H_WIDTH,
        height,
        axis: { x1: x(model.min), y1: yAxis, x2: x(model.max), y2: yAxis },
        ticks: model.years.map((year) => ({ year, at: x(year) })),
        grid: { from: top - 8, to: yAxis },
        orbits,
        transfers,
        planned,
        now: { x: x(model.today), y: yAxis },
    };
}

const V = {
    /** The drawing's strip; the labels sit to its right. */
    width: 132,
    axis: 40,
    cx: 80,
    r: 18,
    /** Planned or flyby lane, right of the orbits. */
    lane: 118,
    k: 88,
    top: 20,
    bottom: 24,
    lift: 22,
    /** The labels' column and the gap kept between their centres. */
    labelX: 144,
    labelGap: 52,
};

/**
 * Spreads label centres apart by at least `gap`, keeping their order and
 * staying within [min, max] where it can. Pure, for the vertical map.
 */
export function spreadLabels(
    centres: readonly number[],
    gap: number,
    min: number,
    max: number,
): number[] {
    const order = centres
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value);
    const out = order.map((item) => Math.max(item.value, min));
    for (let i = 1; i < out.length; i += 1) {
        out[i] = Math.max(out[i], out[i - 1] + gap);
    }
    if (out.length && out[out.length - 1] > max) {
        out[out.length - 1] = max;
        for (let i = out.length - 2; i >= 0; i -= 1) {
            out[i] = Math.min(out[i], out[i + 1] - gap);
        }
    }
    const result = new Array<number>(centres.length);
    order.forEach((item, i) => {
        result[item.index] = out[i];
    });
    return result;
}

/**
 * Time runs up the phone's screen, in pixels; the orbits share one column
 * and their labels sit to the right of the drawing.
 */
export function verticalMap(model: OrbitModel): MapProjection {
    const height = Math.round(V.top + (model.max - model.min) * V.k + V.bottom);
    const y = (t: number) => V.top + (model.max - t) * V.k;
    const byId = new Map(model.orbits.map((orbit) => [orbit.id, orbit]));

    /** The right edge of an orbit at time t. */
    const right = (orbit: Orbit, t: number): Point => {
        const yb = y(orbit.from);
        const yt = y(orbit.to);
        const cyv = (yb + yt) / 2;
        const ry = Math.max((yb - yt) / 2, 0.5);
        const dy = Math.min(Math.max((y(t) - cyv) / ry, -1), 1);
        return { x: V.cx + V.r * Math.sqrt(1 - dy * dy), y: y(t) };
    };

    const ellipse = (from: number, to: number, cx: number) => {
        const yb = y(from);
        const yt = Math.min(y(to), yb - 1);
        const ry = round((yb - yt) / 2);
        return `M${pt(cx, yb)}A${V.r} ${ry} 0 1 0 ${pt(cx, yt)}A${V.r} ${ry} 0 1 0 ${pt(cx, yb)}Z`;
    };

    const shapes: OrbitShape[] = model.orbits.map((orbit) => {
        const yb = y(orbit.from);
        const yt = y(orbit.to);
        if (orbit.host) {
            const host = byId.get(orbit.host)!;
            const a = right(host, orbit.from);
            const b = right(host, orbit.to);
            const peak = V.cx + V.r + V.lift;
            return {
                id: orbit.id,
                d: `M${pt(a.x, a.y)}C${pt(peak, a.y)} ${pt(peak, b.y)} ${pt(b.x, b.y)}`,
                flown: null,
                now: null,
                fade: null,
                label: { x: V.labelX, y: (a.y + b.y) / 2, place: "right" },
                flyby: true,
            };
        }
        let flown: string | null = null;
        let now: Point | null = null;
        if (orbit.current && orbit.now !== null) {
            now = right(orbit, orbit.now);
            flown = `M${pt(V.cx, yb)}A${V.r} ${round((yb - yt) / 2)} 0 0 0 ${pt(now.x, now.y)}`;
        }
        const span = Math.min(yb - yt, 0.8 * V.k) * 0.8;
        const fade: Fade | null = !orbit.startKnown
            ? { a: yb, b: yb - span, dir: "in" }
            : !orbit.endKnown
              ? { a: yt + span, b: yt, dir: "out" }
              : null;
        return {
            id: orbit.id,
            d: ellipse(orbit.from, orbit.to, V.cx),
            flown,
            now,
            fade,
            label: { x: V.labelX, y: (yb + yt) / 2, place: "right" },
            flyby: false,
        };
    });

    let planned: PlannedShape | null = null;
    if (model.planned) {
        const p = model.planned;
        const after = p.after ? byId.get(p.after) : undefined;
        const overlaps = after !== undefined && p.from <= after.to;
        const cx = overlaps ? V.lane : V.cx;
        const yb = y(p.from);
        const yt = y(p.to);
        let link: string | null = null;
        if (after) {
            link = overlaps
                ? `M${pt(right(after, Math.max(p.from, after.from)).x, yb)}L${pt(cx, yb)}`
                : `M${pt(V.cx, y(after.to))}L${pt(V.cx, yb)}`;
        }
        planned = {
            d: ellipse(p.from, p.to, cx),
            link,
            fade: { a: yb - (yb - yt) * 0.35, b: yt, dir: "out" },
            label: { x: V.labelX, y: (yb + yt) / 2, place: "right" },
        };
    }

    // Keep the labels apart: every orbit's, then the planned one's.
    const anchors = [
        ...shapes.map((shape) => shape.label),
        ...(planned ? [planned.label] : []),
    ];
    const spread = spreadLabels(
        anchors.map((anchor) => anchor.y),
        V.labelGap,
        V.labelGap / 2,
        height - V.labelGap / 2,
    );
    anchors.forEach((anchor, index) => {
        anchor.y = spread[index];
    });

    const transfers: TransferShape[] = model.transfers.map((transfer) => {
        const ya = y(transfer.depart);
        const yb = y(transfer.arrive);
        return {
            from: transfer.from,
            to: transfer.to,
            d: ya - yb > 1 ? `M${pt(V.cx, ya)}L${pt(V.cx, yb)}` : null,
            burn: { x: V.axis, y: yb },
            coast: transfer.coastMonths > 0,
        };
    });

    return {
        width: V.width,
        height,
        axis: { x1: V.axis, y1: y(model.min), x2: V.axis, y2: y(model.max) },
        ticks: model.years.map((year) => ({ year, at: y(year) })),
        grid: { from: V.axis, to: V.width },
        orbits: shapes,
        transfers,
        planned,
        now: { x: V.axis, y: y(model.today) },
    };
}
