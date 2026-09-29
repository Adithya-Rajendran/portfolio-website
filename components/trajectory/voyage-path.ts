import type { Frame, Route, Segment, TrajectoryData } from "@/lib/trajectory";

/**
 * The voyage's geometry, pure: time runs left to right at `ppy` pixels a
 * year, and the ship flies a curve through the chapters' worlds.
 *
 * - A **coast** world rides along the time axis for its chapter (from its
 *   start date to its end), carrying the ship once round it on an inclined
 *   orbit; before its chapter it waits at its start, after it stays at its
 *   end. The trail is the ship's path against the axis, so a long chapter
 *   draws a slow wave and a short one a loop.
 * - A **flyby** world is fixed; the ship swings past it and bends.
 * - A **transfer** is a curve from one world's orbit to the next, with the
 *   ship's direction matched at both ends.
 * - The **plan** is a dashed curve to a planned world, placed at the last
 *   date the Open To lines name ("Summer 2027", "2028").
 *
 * The ship is on the time axis where each coast begins and ends (its x is
 * the date's), and a flyby's entry and exit sit on its dates, so the ruler
 * under the ship and the record's date agree. Everything here is in world
 * pixels: x from the axis start, y from the track's centre line.
 */

export type BodyName = "earth" | "mars" | "jupiter" | "saturn";
/** Earth for the first chapter, then outward. */
export const BODIES: BodyName[] = ["earth", "mars", "jupiter", "saturn"];

export interface Vec {
    x: number;
    y: number;
}

export interface Tick {
    /** "Summer 2027", "2028": the words the Open To line uses. */
    label: string;
    t: number;
}

export interface World {
    /** The chapter's index; the planned world is `chapters.length`. */
    index: number;
    kind: "coast" | "flyby" | "plan";
    body: BodyName | null;
    /** The body's horizontal radius; a ringed body's rings reach `extent`. */
    r: number;
    extent: number;
    y: number;
    /** The orbit: an inclined ellipse, `R` wide and `rr` tall. */
    R: number;
    rr: number;
    /** Where the ship joins (and leaves) the orbit. */
    phase: number;
    s: number;
    e: number;
    /** The centre's x at the chapter's start and end. */
    x0: number;
    x1: number;
    /** A flyby's swing: entry, periapsis and exit, with their headings. */
    swing?: {
        /** The side of the planet the ship passes: its unit normal. */
        side: Vec;
        a: Vec;
        m: Vec;
        b: Vec;
        entry: Vec;
        peri: Vec;
        exit: Vec;
    };
}

export interface Geometry {
    ppy: number;
    t0: number;
    t1: number;
    worlds: World[];
    /** The planned world, if the profile has an Open To line. */
    planned: World | null;
    ticks: Tick[];
    /** The plan's dashed leg, a cubic from the last flown point. */
    plan: [Vec, Vec, Vec, Vec] | null;
    /** The chapter the owner is in now (the accent leg), or -1. */
    current: number;
    /** Transfers between two joints: [p0, c1, c2, p3] per segment index. */
    legs: Map<number, [Vec, Vec, Vec, Vec]>;
}

export interface Sizes {
    /** Size unit: the scene's scale. */
    unit: number;
    ppy: number;
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const smooth = (u: number) => u * u * (3 - 2 * u);

const norm = (v: Vec): Vec => {
    const l = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / l, y: v.y / l };
};

/** Keep a heading pointing forward in time, within ±`max` of level. */
function forward(v: Vec, max = (62 * Math.PI) / 180): Vec {
    const a = clamp(Math.atan2(v.y, Math.max(v.x, 1e-6)), -max, max);
    return { x: Math.cos(a), y: Math.sin(a) };
}

export function cubic(c: [Vec, Vec, Vec, Vec], u: number): Vec {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const d = 3 * v * u * u;
    const e = u * u * u;
    return {
        x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x,
        y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y,
    };
}

/** A cubic from `p` heading `hp` to `q` arriving along `hq`. A heading
 *  that points away from the other end gets a shorter handle, so a steep
 *  climb between two worlds turns tightly instead of hooking. */
function bridge(p: Vec, hp: Vec, q: Vec, hq: Vec): [Vec, Vec, Vec, Vec] {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const chord = Math.hypot(dx, dy) || 1;
    const l = clamp(chord * 0.42, 24, 520);
    const along = (h: Vec) =>
        0.35 + 0.65 * Math.max(0, (h.x * dx + h.y * dy) / chord);
    const lp = l * along(hp);
    const lq = l * along(hq);
    return [
        p,
        { x: p.x + hp.x * lp, y: p.y + hp.y * lp },
        { x: q.x - hq.x * lq, y: q.y - hq.y * lq },
        q,
    ];
}

/** Season words to a point in the year. */
const SEASON: Record<string, number> = {
    spring: 0.3,
    summer: 0.5,
    fall: 0.75,
    autumn: 0.75,
    winter: 0.95,
};

/** The dates the Open To lines name, after today, soonest first. */
export function planTicks(data: TrajectoryData): Tick[] {
    const ticks: Tick[] = [];
    for (const line of data.planned?.lines ?? []) {
        const m =
            /\b(?:(spring|summer|fall|autumn|winter)\s+)?((?:19|20)\d{2})\b/i.exec(
                line,
            );
        if (!m) continue;
        const year = Number(m[2]);
        const t = year + (m[1] ? SEASON[m[1].toLowerCase()] : 0);
        if (t <= data.today) continue;
        if (ticks.some((tick) => Math.abs(tick.t - t) < 0.05)) continue;
        ticks.push({ label: m[0], t });
    }
    return ticks.sort((a, b) => a.t - b.t);
}

/** The axis: from the first chapter's start to half a year past the plan. */
export function axisSpan(
    data: TrajectoryData,
    ticks: Tick[],
): [number, number] {
    const first = data.chapters[0]?.start ?? data.today - 1;
    const lastFlown = Math.max(
        data.today,
        data.chapters.at(-1)?.end ?? data.today,
    );
    const planT = data.planned ? (ticks.at(-1)?.t ?? lastFlown + 1) : lastFlown;
    return [first, planT + 0.5];
}

/** The planned world's date: the last tick, else a year on. */
export function planDate(data: TrajectoryData, ticks: Tick[]): number {
    const lastFlown = Math.max(
        data.today,
        data.chapters.at(-1)?.end ?? data.today,
    );
    return ticks.at(-1)?.t ?? lastFlown + 1;
}

/** Relative sizes of the bodies (horizontal radius, in units). */
const BODY_R: Record<BodyName, number> = {
    earth: 0.084,
    mars: 0.052,
    jupiter: 0.112,
    saturn: 0.064,
};
/** The vertical offsets, alternating so the path undulates. */
const LANES = [0.06, -0.19, 0.13, -0.13, 0.15, -0.16];
/** The orbit's inclination (its height over its width) and its roll on
 *  screen, rising to the right. The roll also keeps the trail from
 *  folding into a cusp when a world's drift matches the ship's speed. */
const TILT = 0.36;
export const ORBIT_ROLL = -0.2;
const COS = Math.cos(ORBIT_ROLL);
const SIN = Math.sin(ORBIT_ROLL);
const roll = (x: number, y: number): Vec => ({
    x: x * COS - y * SIN,
    y: x * SIN + y * COS,
});
/** The orbital velocity at phase φ, per turn. */
const spin = (R: number, rr: number, phi: number) =>
    roll(R * Math.cos(phi) * TAU, -rr * Math.sin(phi) * TAU);

/** Where on the orbit the ship joins, so its heading (orbit plus the
 *  world's drift along the axis) best matches `want`. Front half first. */
function joinPhase(R: number, rr: number, drift: number, want: Vec): number {
    const target = Math.atan2(want.y, want.x);
    let best = 0;
    let score = Infinity;
    for (let k = 0; k < 144; k++) {
        const phi = (k / 144) * TAU - Math.PI;
        const v = spin(R, rr, phi);
        let d = Math.abs(Math.atan2(v.y, v.x + drift) - target);
        if (d > Math.PI) d = TAU - d;
        // Joining on the far side, behind the planet, reads poorly.
        const cost = d + (Math.cos(phi) < 0 ? 0.6 : 0);
        if (cost < score) {
            score = cost;
            best = phi;
        }
    }
    return best;
}

/** The orbit's point at phase φ: the near side (φ = 0) is lowest. */
export function orbitAt(w: World, phi: number): Vec {
    return roll(w.R * Math.sin(phi), w.rr * Math.cos(phi));
}

/** Whether phase φ is behind the planet. */
export const behind = (phi: number) => Math.cos(phi) < 0;

export function buildGeometry(
    data: TrajectoryData,
    route: Route,
    sizes: Sizes,
    ringExtent: number,
): Geometry {
    const { unit, ppy } = sizes;
    const ticks = planTicks(data);
    const [t0, t1] = axisSpan(data, ticks);
    const X = (t: number) => (t - t0) * ppy;
    const n = data.chapters.length;

    const worlds: World[] = data.chapters.map((chapter, i) => {
        const body = BODIES[i % BODIES.length];
        const r = BODY_R[body] * unit;
        const extent = body === "saturn" ? r * ringExtent : r;
        const R = extent + Math.max(12, r * 0.38);
        const kind = chapter.flyby ? "flyby" : "coast";
        const mid = (chapter.start + chapter.end) / 2;
        const x = X(kind === "flyby" ? mid : chapter.start);
        return {
            index: i,
            kind,
            body,
            r,
            extent,
            y: LANES[i % LANES.length] * unit,
            R,
            rr: R * TILT,
            phase: 0,
            s: chapter.start,
            e: chapter.end,
            x0: x,
            x1: kind === "flyby" ? x : X(chapter.end),
        };
    });

    const planT = planDate(data, ticks);
    let planned: World | null = null;
    if (data.planned && n) {
        const r = 0.066 * unit;
        const R = r + Math.max(12, r * 0.38);
        planned = {
            index: n,
            kind: "plan",
            body: null,
            r,
            extent: r,
            y: LANES[n % LANES.length] * unit * 0.8,
            R,
            rr: R * TILT,
            phase: 0,
            s: planT,
            e: planT,
            x0: X(planT),
            x1: X(planT),
        };
    }

    // Headings between the worlds' nominal centres.
    const nominal = (w: World, end: boolean): Vec => ({
        x: end ? w.x1 : w.x0,
        y: w.y,
    });
    const next = (i: number) => worlds[i + 1] ?? planned;
    const heading = (from: Vec, to: Vec) =>
        forward(norm({ x: to.x - from.x, y: to.y - from.y }));

    worlds.forEach((w, i) => {
        const prev = worlds[i - 1];
        const after = next(i);
        const inbound = prev
            ? heading(nominal(prev, true), nominal(w, false))
            : { x: 1, y: 0 };
        const outbound = after
            ? heading(nominal(w, true), nominal(after, false))
            : { x: 1, y: 0 };
        if (w.kind === "coast") {
            const drift = w.x1 - w.x0;
            w.phase = joinPhase(w.R, w.rr, drift, inbound);
            // Pin the ship to the axis at both joints: the centre sits off
            // the date by the orbit's offset at the joining phase.
            const off = orbitAt(w, w.phase).x;
            w.x0 -= off;
            w.x1 -= off;
        } else {
            // A flyby: periapsis on the inside of the bend, entry and exit
            // on the chapter's start and end dates.
            const a = inbound;
            const b = outbound;
            let side = { x: a.x - b.x, y: a.y - b.y };
            if (Math.hypot(side.x, side.y) < 0.25)
                side = { x: side.x - a.y * 0.5, y: side.y + a.x * 0.5 };
            const nrm = norm(side);
            const q = w.r + Math.max(18, w.r * 0.7);
            const peri = { x: w.x0 + nrm.x * q, y: w.y + nrm.y * q };
            let m = norm({ x: a.x + b.x, y: a.y + b.y });
            if (m.x < 0.2) m = forward(m);
            const din = Math.max(28, peri.x - X(w.s));
            const dout = Math.max(28, X(w.e) - peri.x);
            const entry = {
                x: peri.x - din,
                y: peri.y - (a.y / Math.max(a.x, 0.45)) * din,
            };
            const exit = {
                x: peri.x + dout,
                y: peri.y + (b.y / Math.max(b.x, 0.45)) * dout,
            };
            w.swing = { side: nrm, a, m, b, entry, peri, exit };
        }
    });
    if (planned) {
        const last = worlds[n - 1];
        const inbound = heading(nominal(last, true), nominal(planned, false));
        planned.phase = joinPhase(planned.R, planned.rr, 0, inbound);
        const off = orbitAt(planned, planned.phase).x;
        planned.x0 -= off;
        planned.x1 -= off;
    }

    const current = data.chapters.findIndex((c) => c.current);
    const geometry: Geometry = {
        ppy,
        t0,
        t1,
        worlds,
        planned,
        ticks,
        plan: null,
        current,
        legs: new Map(),
    };

    // The transfers: a cubic between the joints, headings matched.
    route.segments.forEach((segment, index) => {
        if (segment.kind !== "transfer") return;
        const before = route.segments[index - 1];
        const after = route.segments[index + 1];
        if (!before || !after) return;
        const p = shipOn(geometry, before, 1, index - 1);
        const q = shipOn(geometry, after, 0, index + 1);
        const hp = headingOn(geometry, before, 1, index - 1);
        const hq = headingOn(geometry, after, 0, index + 1);
        geometry.legs.set(index, bridge(p, hp, q, hq));
    });

    if (planned) {
        const lastIndex = route.segments.findLastIndex(
            (s) => s.kind !== "plan",
        );
        const last = route.segments[lastIndex];
        if (last) {
            const p = shipOn(geometry, last, 1, lastIndex);
            const hp = headingOn(geometry, last, 1, lastIndex);
            const q = {
                x: planned.x0 + orbitAt(planned, planned.phase).x,
                y: planned.y + orbitAt(planned, planned.phase).y,
            };
            const hq = orbitHeading(planned, planned.phase, 0);
            geometry.plan = bridge(p, forward(hp), q, hq);
        }
    }
    return geometry;
}

/** A world's centre at date t. */
export function centreAt(w: World, t: number): Vec {
    if (w.kind !== "coast" || w.e <= w.s) return { x: w.x0, y: w.y };
    const u = clamp((t - w.s) / (w.e - w.s), 0, 1);
    return { x: lerp(w.x0, w.x1, u), y: w.y };
}

function orbitHeading(w: World, phi: number, drift: number): Vec {
    const v = spin(w.R, w.rr, phi);
    return norm({ x: v.x + drift, y: v.y });
}

export interface ShipPoint extends Vec {
    /** Behind the world it orbits (drawn under the planet). */
    back: boolean;
}

/** The ship on segment `segment` (route index `index`) at phase u. */
export function shipOn(
    g: Geometry,
    segment: Segment,
    u: number,
    index: number,
): ShipPoint {
    if (segment.kind === "coast") {
        const w = g.worlds[segment.chapter];
        const phi = w.phase + TAU * u;
        const c = centreAt(w, lerp(w.s, w.e, u));
        const o = orbitAt(w, phi);
        return { x: c.x + o.x, y: c.y + o.y, back: behind(phi) };
    }
    if (segment.kind === "flyby") {
        const s = g.worlds[segment.chapter].swing!;
        const half = u < 0.5;
        const k = half ? u * 2 : u * 2 - 1;
        const lin = half
            ? bridge(s.entry, s.a, s.peri, s.m)
            : bridge(s.peri, s.m, s.exit, s.b);
        return { ...cubic(lin, k), back: false };
    }
    if (segment.kind === "transfer") {
        const leg = g.legs.get(index);
        if (leg) return { ...cubic(leg, u), back: false };
    }
    // The plan: the ship holds where the flown route ends.
    if (g.plan) return { ...g.plan[0], back: false };
    return { x: 0, y: 0, back: false };
}

/** The ship's unit heading on a segment (a numerical derivative). */
export function headingOn(
    g: Geometry,
    segment: Segment,
    u: number,
    index: number,
): Vec {
    const h = 1e-3;
    const a = shipOn(g, segment, clamp(u - h, 0, 1), index);
    const b = shipOn(g, segment, clamp(u + h, 0, 1), index);
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) return { x: 1, y: 0 };
    return norm({ x: b.x - a.x, y: b.y - a.y });
}

export interface Camera {
    /** The world point shown at the anchor. */
    x: number;
    y: number;
}

/** The camera at a frame: it follows the date, easing `lead` px ahead
 *  mid-transfer, and pans to `planTarget` over the plan. */
export function cameraAt(
    g: Geometry,
    route: Route,
    frame: Frame,
    lead: number,
    planTarget: number,
    follow = 0.5,
): Camera {
    const segs = route.segments;
    const X = (t: number) => (t - g.t0) * g.ppy;
    const yOf = (i: number) => (g.worlds[i] ?? g.planned)?.y ?? 0;
    // The camera's x at a segment's start and end (a coast or flyby
    // follows its date; a transfer bridges its neighbours).
    const edge = (index: number, end: boolean): number => {
        const s = segs[index];
        if (!s) return 0;
        if (s.kind === "transfer") return edge(index + (end ? 1 : -1), !end);
        if (s.kind === "plan") return end ? planTarget : X(s.t0);
        return X(end ? s.t1 : s.t0);
    };
    const { segment, u, index } = frame;
    switch (segment.kind) {
        case "coast":
        case "flyby":
            return { x: X(frame.t), y: yOf(segment.chapter) * follow };
        case "transfer": {
            const a = edge(index - 1, true);
            const b = edge(index + 1, false);
            const bump = 16 * u * u * (1 - u) * (1 - u);
            return {
                x: lerp(a, b, u) + lead * bump,
                y:
                    lerp(
                        yOf(segment.from ?? 0),
                        yOf(segment.chapter),
                        smooth(u),
                    ) * follow,
            };
        }
        case "plan": {
            const from = X(segment.t0);
            const k = smooth(smooth(u));
            const last = yOf(route.segments[index - 1]?.chapter ?? 0);
            const mid = (last + (g.planned?.y ?? last)) / 2;
            return {
                x: lerp(from, planTarget, k),
                y: lerp(last, mid, k) * follow,
            };
        }
    }
}

/** A thrust plume's strength: at the start and end of each transfer. */
export function burnAt(frame: Frame): number {
    if (frame.segment.kind !== "transfer") return 0;
    const u = frame.u;
    const w = 0.16;
    if (u < w) return 1 - u / w;
    if (u > 1 - w) return (u - (1 - w)) / w;
    return 0;
}
