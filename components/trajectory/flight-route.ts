import {
    frameAt,
    type Frame,
    type Route,
    type Segment,
    type TrajectoryData,
} from "@/lib/trajectory";

/**
 * The 3D flight's geometry (option C): pure, without three.js, so the
 * route, the worlds and the camera are deterministic in the scroll progress
 * and testable in Node. flight-gl.ts draws what this module places.
 *
 * The frame is heliocentric, y up, the Sun at the origin. Each chapter has
 * a world on its own slightly inclined orbit, outward in time order, and
 * the ship flies the base route (lib/trajectory.ts) through them:
 * - a **coast** co-orbits the chapter's world on a parking loop, spiralling
 *   in from the loop's outer point and out to it again;
 * - a **flyby** is a smooth close pass across the world's orbit;
 * - a **transfer** is a Hohmann-like spiral, tangent at both ends;
 * - the **plan** holds the parking loop while a dashed leg spirals out to
 *   the planned orbit.
 * The chase camera follows a smoothed guide track sampled once over the
 * whole route, so every pose is a function of the progress alone and
 * scrubbing backwards retraces the same frames. It holds still on a
 * chapter's world while its card is read (the ship loops, the camera
 * doesn't), and moves between chapters: each transfer pulls out, crosses
 * with the world left behind and the one ahead in frame, and pushes in.
 */

export type Vec3 = [number, number, number];
export type WorldKind = "earth" | "mars" | "jupiter" | "saturn";

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Zero slope at both ends: the spiral's radius and height. */
const ease = (u: number) => (1 - Math.cos(Math.PI * clamp01(u))) / 2;
export const smoothstep = (a: number, b: number, x: number) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const smoother = (x: number) => {
    const t = clamp01(x);
    return t * t * t * (t * (t * 6 - 15) + 10);
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
];
export const dist = (a: Vec3, b: Vec3) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit = (a: Vec3): Vec3 => {
    const n = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / n, a[1] / n, a[2] / n];
};
/** An angle wrapped into (−π, π]. */
const wrapPi = (a: number) => a - TAU * Math.ceil((a - Math.PI) / TAU);

/* ---- pacing ---------------------------------------------------------------- */

export { FLIGHT_PACING } from "./flight-pacing";

/* ---- orbital planes ------------------------------------------------------ */

/** An orbit's plane: the ecliptic's axes turned by the inclination about
 *  the line of nodes. A point at angle θ is r(cos θ·ex + sin θ·ez), which
 *  runs clockwise seen from above, so the Sun is to the ship's right. */
export interface Plane {
    ex: Vec3;
    ey: Vec3;
    ez: Vec3;
}

function plane(incl: number, node: number): Plane {
    const k: Vec3 = [Math.cos(node), 0, Math.sin(node)];
    const c = Math.cos(incl);
    const s = Math.sin(incl);
    const turn = (v: Vec3): Vec3 => {
        const kv = dot(k, v);
        const kx = cross(k, v);
        return [
            v[0] * c + kx[0] * s + k[0] * kv * (1 - c),
            v[1] * c + kx[1] * s + k[1] * kv * (1 - c),
            v[2] * c + kx[2] * s + k[2] * kv * (1 - c),
        ];
    };
    return { ex: turn([1, 0, 0]), ey: turn([0, 1, 0]), ez: turn([0, 0, 1]) };
}

export function onPlane(pl: Plane, r: number, theta: number): Vec3 {
    const c = Math.cos(theta) * r;
    const s = Math.sin(theta) * r;
    return [
        pl.ex[0] * c + pl.ez[0] * s,
        pl.ex[1] * c + pl.ez[1] * s,
        pl.ex[2] * c + pl.ez[2] * s,
    ];
}

const tangentOn = (pl: Plane, theta: number): Vec3 =>
    unit(add(scale(pl.ex, -Math.sin(theta)), scale(pl.ez, Math.cos(theta))));

/* ---- worlds ---------------------------------------------------------------- */

export interface World {
    chapter: number;
    kind: WorldKind;
    /** Planet radius, scene units (not to scale). */
    radius: number;
    /** Orbit radius. */
    orbit: number;
    plane: Plane;
    /** Mean motion, radians per year, and the angle at the epoch. */
    omega: number;
    phase: number;
    /** The parking loop's radius and its turns over the coast. */
    park: number;
    loops: number;
    /** Axial tilt, radians, and the spin axis it gives. */
    tilt: number;
    pole: Vec3;
    /** The chase camera frames a sphere this big around the guide. */
    frame: number;
}

const BODY: Record<
    WorldKind,
    { radius: number; park: number; tilt: number; frame: number }
> = {
    earth: { radius: 0.55, park: 1.45, tilt: 23.4, frame: 1.9 },
    mars: { radius: 0.4, park: 1.1, tilt: 25.2, frame: 1.9 },
    jupiter: { radius: 1.35, park: 3.1, tilt: 3.1, frame: 4.0 },
    saturn: { radius: 1.1, park: 3.4, tilt: 26.7, frame: 4.3 },
};

/** Saturn's ring, as multiples of its radius. */
export const RING = { inner: 1.24, outer: 2.27 };

const INCL = [2.4, -3.1, 1.7, -2.6, 3.3, -1.9];
const NODE = [40, 125, 215, 300, 80, 170];
/** The first orbit, the gap between orbits, the heliocentric sweep of a
 *  transfer and the Sun's angle at launch. */
const FIRST_ORBIT = 16;
const GAP = 6.5;
const SWEEP = 140 * D2R;
const LAUNCH = 200 * D2R;
/** Mean motion at the first orbit, degrees per year; outer orbits are
 *  slower, by Kepler's third law. */
const OMEGA0 = 5;
/** The parking loop leans out of the orbit plane. */
const LOOP_TILT = 14 * D2R;
/** A flyby spans ±17° of its orbit, entering inside and leaving outside. */
const FLYBY_SPAN = 17 * D2R;
const FLYBY_IN = 0.8;
const FLYBY_OUT = 3.4;
/** A coast's loop starts and ends this much wider than its parking. */
const INSERT = 1.1;
/** How far a world's axis tips toward the chase camera. */
const POLE_TIP = 11 * D2R;

/** Earth for the first chapter, Saturn (with its ring) for the last, and
 *  Mars and Jupiter between. */
export function worldKinds(count: number): WorldKind[] {
    const inner: WorldKind[] = ["earth", "mars", "jupiter"];
    return Array.from({ length: count }, (_, i) => {
        if (count > 1 && i === count - 1) return "saturn";
        if (i < 3) return inner[i];
        return (i - 3) % 2 ? "jupiter" : "mars";
    });
}

/* ---- the stage ------------------------------------------------------------- */

export interface Layout {
    /** Pixels per unit of tan(angle) from the lens centre. */
    kpx: number;
    /** Half the subject's box, pixels. */
    halfW: number;
    halfH: number;
}

/** The screen the scene draws on: one source for the lens, the box the
 *  subject belongs in, and the framing (flight-gl.ts and the tests). */
export interface Stage extends Layout {
    W: number;
    H: number;
    wide: boolean;
    /** Vertical field of view, degrees. */
    fov: number;
    /** Where the camera's target lands on the stage, pixels. */
    lens: { x: number; y: number };
    /** The subject's box, pixels: right of the record and its scrim, clear
     *  of the header band and the caption on wide; above the record on
     *  phones. */
    box: { x0: number; y0: number; x1: number; y1: number };
}

export function stageFrame(W: number, H: number, wide: boolean): Stage {
    const fov = wide ? 38 : 44;
    const kpx = H / 2 / Math.tan((fov * Math.PI) / 360);
    if (wide) {
        const lens = { x: W * 0.65, y: H * 0.5 };
        return {
            W,
            H,
            wide,
            fov,
            kpx,
            lens,
            halfW: Math.min(W - lens.x - 44, W * 0.3),
            halfH: H * 0.41,
            box: { x0: W * 0.46, y0: 24, x1: W - 16, y1: H - 48 },
        };
    }
    return {
        W,
        H,
        wide,
        fov,
        kpx,
        lens: { x: W * 0.5, y: H * 0.29 },
        halfW: W * 0.46,
        halfH: H * 0.25,
        box: { x0: 12, y0: 16, x1: W - 12, y1: H * 0.55 },
    };
}

/** The camera's axes for a pose: forward, right and up, with world-up
 *  fixed (no roll), as three.js's lookAt builds them. */
export function viewAxes(pose: { eye: Vec3; target: Vec3 }) {
    const fwd = unit(sub(pose.target, pose.eye));
    const right = unit(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    return { fwd, right, up };
}

/** A point on the stage, in pixels, for a pose: the same projection and
 *  lens shift flight-gl.ts writes into the projection matrix. `depth` is
 *  along the view axis (behind the camera when ≤ 0). */
export function screenOf(
    pose: { eye: Vec3; target: Vec3 },
    stage: Pick<Stage, "kpx" | "lens">,
    point: Vec3,
) {
    const { fwd, right, up } = viewAxes(pose);
    const v = sub(point, pose.eye);
    const depth = dot(v, fwd);
    const k = stage.kpx / Math.max(1e-6, Math.abs(depth));
    return {
        x: stage.lens.x + dot(v, right) * k,
        y: stage.lens.y - dot(v, up) * k,
        depth,
    };
}

/* ---- legs ------------------------------------------------------------------ */

interface Leg {
    /** The ship at phase u. */
    at(u: number): Vec3;
    /** What the camera follows: the world on a coast, else the ship. */
    guide(u: number): Vec3;
    /** The way the ship heads (unit). */
    dir(u: number): Vec3;
    /** The radius the camera frames. */
    frame(u: number): number;
    /** The camera's elevation. */
    el(u: number): number;
    /** A transfer's fly-to: 0 (the chase) to 1 (the wide shot at the
     *  transfer's midpoint). */
    fly(u: number): number;
}

/** A stretch where the camera's azimuth follows the heading at a set yaw
 *  (a chapter's hold, a flyby's pan). Between them the camera moves. */
interface Anchor {
    p0: number;
    p1: number;
    yaw: (p: number) => number;
    /** How much of the move before and after eases in and out: the
     *  ship's insertion and departure, for a hold. */
    in: number;
    out: number;
    /** A point the camera flies through at the pace of the moves either
     *  side (a flyby's entry). */
    through?: boolean;
}

/** One even move from 0 to 1 over x ∈ [0, 1]: the rate eases from `va` to
 *  a cruise over the first `a1`, cruises, and eases to `vb` over the last
 *  `a2` (rates relative to the average). */
function glide(x: number, a1: number, a2: number, va: number, vb: number) {
    const vc = (1 - (va * a1 + vb * a2) / 2) / (1 - (a1 + a2) / 2);
    const area = (t: number) => t * t * t - (t * t * t * t) / 2;
    if (x < a1) return a1 * (va * (x / a1) + (vc - va) * area(x / a1));
    const s1 = (a1 * (va + vc)) / 2;
    if (x <= 1 - a2 || a2 <= 0) return s1 + vc * (x - a1);
    const t = (x - (1 - a2)) / a2;
    return s1 + vc * (1 - a1 - a2) + a2 * (vc * t + (vb - vc) * area(t));
}

const angleAt = (w: World, t: number, epoch: number) =>
    w.phase + w.omega * (t - epoch);

function bezier(P0: Vec3, P1: Vec3, P2: Vec3, P3: Vec3) {
    return {
        at(u: number): Vec3 {
            const v = 1 - u;
            const a = v * v * v;
            const b = 3 * v * v * u;
            const c = 3 * v * u * u;
            const d = u * u * u;
            return [0, 1, 2].map(
                (i) => a * P0[i] + b * P1[i] + c * P2[i] + d * P3[i],
            ) as Vec3;
        },
        dir(u: number): Vec3 {
            const v = 1 - u;
            return unit(
                [0, 1, 2].map(
                    (i) =>
                        3 * v * v * (P1[i] - P0[i]) +
                        6 * v * u * (P2[i] - P1[i]) +
                        3 * u * u * (P3[i] - P2[i]),
                ) as Vec3,
            );
        },
    };
}

/** A prograde spiral from A to B about the Sun: the angle runs evenly, the
 *  radius and height ease, so it leaves and arrives tangentially. */
export function spiral(A: Vec3, B: Vec3, minSweep = 40 * D2R) {
    const ra = Math.hypot(A[0], A[2]);
    const aa = Math.atan2(A[2], A[0]);
    const rb = Math.hypot(B[0], B[2]);
    let ab = Math.atan2(B[2], B[0]);
    while (ab < aa + minSweep) ab += TAU;
    return {
        at(u: number): Vec3 {
            const e = ease(u);
            const r = lerp(ra, rb, e);
            const a = lerp(aa, ab, u);
            return [r * Math.cos(a), lerp(A[1], B[1], e), r * Math.sin(a)];
        },
        dir(u: number): Vec3 {
            const e = ease(u);
            const r = lerp(ra, rb, e);
            const a = lerp(aa, ab, u);
            const de = (Math.PI / 2) * Math.sin(Math.PI * clamp01(u));
            const dr = (rb - ra) * de;
            const da = ab - aa;
            return unit([
                dr * Math.cos(a) - r * Math.sin(a) * da,
                (B[1] - A[1]) * de,
                dr * Math.sin(a) + r * Math.cos(a) * da,
            ]);
        },
    };
}

/** The centre of the smallest sphere round three points: the longest
 *  side's midpoint when the triangle is obtuse, else its circumcentre. */
function boundCentre(a: Vec3, b: Vec3, c: Vec3): Vec3 {
    const sides: [Vec3, Vec3, Vec3][] = [
        [a, b, c],
        [b, c, a],
        [c, a, b],
    ];
    for (const [p, q, r] of sides) {
        const m = mix(p, q, 0.5);
        if (dist(m, r) <= dist(p, q) / 2 + 1e-9) return m;
    }
    const ab = sub(b, a);
    const ac = sub(c, a);
    const n = cross(ab, ac);
    const nn = dot(n, n) || 1;
    const k = add(
        scale(cross(n, ab), dot(ac, ac)),
        scale(cross(ac, n), dot(ab, ab)),
    );
    return add(a, scale(k, 1 / (2 * nn)));
}

/* ---- the plan -------------------------------------------------------------- */

export interface FlightPlan {
    worlds: World[];
    /** The current chapter, whose leg is the accent (−1: none). */
    current: number;
    /** Where the current leg starts (the transfer onto its orbit). */
    currentFrom: number;
    /** The dashed orbit and leg of the plan, when there is one. */
    planned: { orbit: number; plane: Plane; path: Vec3[]; end: Vec3 } | null;
    /** The outermost orbit, for the overview's framing. */
    reach: number;
    epoch: number;
    /** The ship at progress p. */
    shipAt(p: number): Vec3;
    /** A world's centre at mission time t. */
    worldAt(w: World, t: number): Vec3;
    /** A world's spin about its axis at progress p (radians). */
    spinAt(w: World, p: number): number;
    /** The camera at a frame, for a stage laid out as `layout`. */
    pose(frame: Frame, layout: Layout): Pose;
    /** The Sun–world–eye angle, degrees: 0 is full, 90 half, 180 new. */
    phaseAngle(pose: Pose, world: World, t: number): number;
    /** Ship positions over [0, route.flown], n samples. */
    trail(n: number): Vec3[];
}

export interface Pose {
    eye: Vec3;
    target: Vec3;
    /** 0 on the chase, 1 in the overview. */
    overview: number;
    /** A transfer's fly-to, 0 (the chase) to 1 (its wide midpoint); 0
     *  outside transfers. */
    fly: number;
}

const CHASE_EL = 19 * D2R;
/** Behind the ship and well to the Sun's side: the orbits are circles with
 *  the Sun radially inward, so this one yaw lights every held world
 *  gibbous (a 45–63° phase) from screen right, with the Sun about 125° off
 *  the view axis. Each coast and the plan pan a little across the world. */
const CHASE_YAW = -36 * D2R;
const COAST_SWING = 8 * D2R;
/** A hold turns the view by at most this much, its pan and the world's
 *  own orbital motion together. */
const HOLD_TURN = 22 * D2R;
/** Where a coast's hold starts and ends (its u): the ship's insertion and
 *  departure are brief, and the camera's moves happen with them. */
const HOLD_IN = 0.14;
const HOLD_OUT = 0.86;
/** The camera enters a flyby at this yaw and pans across the world on
 *  the moves' even pace, which brings it round to about −5° at the
 *  closest approach (Mars gibbous, not a full disc); the moves either side
 *  ease through the entry over this share of the flyby's span. Entering
 *  well toward the Sun keeps the camera from lagging the transfer's turn,
 *  so its eye stays clear of the Sun on the push-in. */
const FLYBY_YAW = -50 * D2R;
const FLYBY_RAMP = 0.15;
/** A transfer's fly-to rises this much above the chase, and pulls out to
 *  frame both worlds (the chord's share, plus the destination's size),
 *  as tight as keeps both inside the subject's box on every stage. */
const FLY_EL = 13 * D2R;
const FLY_CHORD = 0.45;
const FLY_POWER = 1.4;
/** …leans the wide shot toward the Sun, so the worlds show more day, and
 *  toward the world left behind, which is nearer the camera and would
 *  otherwise sit under the record's scrim. */
const FLY_YAW = -10 * D2R;
const FLY_BIAS = 0.35;
/** The flyby's closest approach: the camera leans toward the world and
 *  pushes in. */
const FLYBY_LEAN = 0.6;
const FLYBY_PUSH = 0.5;
/** …and arrives from, and leaves on, a wider shot leaning a little
 *  toward the world, so the transfers' push-in carries on into the
 *  approach and the world stays in frame as it recedes. */
const FLYBY_WIDE = 1.0;
const FLYBY_TAIL = 0.3;
/** A coast's shot widens by this share of its loop where it joins a
 *  transfer, over this much of its u. */
const EDGE_WIDEN = 1.2;
const EDGE_SPAN = 0.06;
const AHEAD = 0.1;
const OVER_EL = 54 * D2R;
/** The overview turns so the ship sits on the near side, to the right. */
const OVER_AZ = 38 * D2R;
const SAMPLES = 1400;
const SIGMA = 0.006;
/** Where the ship rests at a card's settled frame: on the near side, below
 *  and right of its world (screen angle below the horizontal), clear of
 *  the disc and of Saturn's ring. */
const REST_ANGLE = 35 * D2R;
const REST_CLEAR = 1.4;
/** The loop may run ahead or behind by this much at most (radians), so
 *  the ship never stalls or turns back. */
const PHASE_MAX = 1.2;

/** The fly-to's weight over a transfer: zero slope at both joins. */
const flyOf = (u: number) =>
    Math.pow(Math.sin(Math.PI * clamp01(u)), FLY_POWER);

export function buildFlight(data: TrajectoryData, route: Route): FlightPlan {
    const chapters = data.chapters;
    const kinds = worldKinds(chapters.length);
    const epoch = chapters[0]?.start ?? 0;
    let lastCurrent = -1;
    chapters.forEach((c, i) => {
        if (c.current) lastCurrent = i;
    });
    const coastOf = (i: number) =>
        route.segments.find(
            (s) =>
                s.chapter === i && (s.kind === "coast" || s.kind === "flyby"),
        );

    // Worlds, outward in time order, each placed so the transfer into it
    // sweeps SWEEP about the Sun from where the last chapter ended.
    const worlds: World[] = [];
    let orbit = FIRST_ORBIT;
    let endAngle = LAUNCH - SWEEP;
    chapters.forEach((chapter, i) => {
        const kind = kinds[i];
        const body = BODY[kind];
        if (i > 0) orbit += GAP + 0.9 * (worlds[i - 1].park + body.park);
        const omega = OMEGA0 * D2R * Math.pow(FIRST_ORBIT / orbit, 1.5);
        const seg = coastOf(i);
        const loops = Math.max(1, Math.round((seg?.w ?? 1) * 0.9));
        const w: World = {
            chapter: i,
            kind,
            radius: body.radius,
            orbit,
            plane: plane(
                INCL[i % INCL.length] * D2R,
                NODE[i % NODE.length] * D2R,
            ),
            omega,
            phase: 0,
            park: body.park,
            loops,
            tilt: body.tilt * D2R,
            pole: [0, 1, 0],
            frame: chapter.flyby ? body.frame + 0.6 : body.frame,
        };
        if (chapter.flyby) {
            const mid = (chapter.start + chapter.end) / 2;
            w.phase = endAngle + SWEEP + FLYBY_SPAN - omega * (mid - epoch);
            endAngle = angleAt(w, mid, epoch) + FLYBY_SPAN;
        } else {
            const start = i === 0 ? LAUNCH : endAngle + SWEEP;
            w.phase = start - omega * (chapter.start - epoch);
            endAngle = angleAt(w, chapter.end, epoch);
        }
        // The axis leans mostly sideways and a little toward the chase
        // camera, so a ring opens to it.
        const mid = angleAt(w, (chapter.start + chapter.end) / 2, epoch);
        const out = onPlane(w.plane, 1, mid);
        const back = scale(tangentOn(w.plane, mid), -1);
        const toward = Math.min(1, Math.sin(POLE_TIP) / Math.sin(w.tilt));
        const lean = add(
            scale(back, toward),
            scale(out, Math.sqrt(1 - toward * toward)),
        );
        w.pole = unit(
            add(
                scale(w.plane.ey, Math.cos(w.tilt)),
                scale(lean, Math.sin(w.tilt)),
            ),
        );
        worlds.push(w);
    });

    const worldAt = (w: World, t: number) =>
        onPlane(w.plane, w.orbit, angleAt(w, t, epoch));
    const loopAt = (w: World, t: number, gamma: number): Vec3 => {
        const th = angleAt(w, t, epoch);
        const r = onPlane(w.plane, 1, th);
        const tg = tangentOn(w.plane, th);
        const c = Math.cos(gamma) * w.park;
        const s = Math.sin(gamma) * w.park;
        // Tilted about the heading, so the loop leaves its outer point
        // along the orbit and joins the transfers without a kink.
        return [0, 1, 2].map(
            (k) =>
                (r[k] * Math.cos(LOOP_TILT) +
                    w.plane.ey[k] * Math.sin(LOOP_TILT)) *
                    c +
                tg[k] * s,
        ) as Vec3;
    };
    const tOf = (s: Segment, u: number) => lerp(s.t0, s.t1, u);

    // Each coast's loop phase, solved once the camera track exists (the
    // camera never follows the ship on a coast, so it doesn't depend on
    // it). The shift is zero, with zero slope, where the loop joins a
    // transfer; the first coast has no join at its start.
    const phaseShift = route.segments.map(() => 0);
    const shiftShape = (seg: Segment, u: number) =>
        seg.chapter === 0
            ? Math.cos((Math.PI / 2) * clamp01(u)) ** 2
            : Math.sin(Math.PI * clamp01(u)) ** 2;

    // The legs, in route order; a transfer joins the legs either side.
    const last = chapters.length - 1;
    const legs: Leg[] = route.segments.map((seg, index) => {
        const w = worlds[Math.min(seg.chapter, last)];
        if (seg.kind === "coast" || seg.kind === "plan") {
            const plan = seg.kind === "plan";
            const first = seg.chapter === 0;
            const final = seg.chapter >= last;
            const gammaOf = (u: number) =>
                plan
                    ? TAU * (w.loops + u)
                    : TAU * w.loops * u +
                      phaseShift[index] * shiftShape(seg, u);
            // Insertion and departure are brief, so the camera settles on
            // the world for the card: the guide leaves the loop's outer
            // point for the world's centre by u 0.12 and returns after
            // 0.88. The hold's pan is set with the camera's moves, below.
            const edge = (u: number) => {
                if (plan) return 0;
                const inn = first ? 0 : 1 - smoothstep(0, 0.12, u);
                const out = final ? 0 : 1 - smoothstep(0, 0.12, 1 - u);
                return Math.max(inn, out);
            };
            // The loop spirals in from a wider arc and out again, so the
            // curvature changes gradually.
            const wide = (u: number) =>
                plan
                    ? 1
                    : 1 +
                      INSERT *
                          ((first ? 0 : 1 - smoothstep(0, 0.14, u)) +
                              (final ? 0 : smoothstep(0.86, 1, u)));
            // The whole loop stays in frame, with one slow push over the
            // hold; the plan keeps where the last coast ends. Right at a
            // join the shot is wider, so the world stays in it while the
            // guide is out at the loop's outer point.
            const held = w.frame + 0.5 * w.park;
            return {
                at: (u) => {
                    const t = tOf(seg, u);
                    return add(
                        worldAt(w, t),
                        scale(loopAt(w, t, gammaOf(u)), wide(u)),
                    );
                },
                guide: (u) => {
                    const t = tOf(seg, u);
                    const e = edge(u);
                    if (e <= 0) return worldAt(w, t);
                    return add(
                        worldAt(w, t),
                        scale(loopAt(w, t, 0), wide(u) * e),
                    );
                },
                dir: (u) => tangentOn(w.plane, angleAt(w, tOf(seg, u), epoch)),
                frame: (u) =>
                    plan
                        ? held * 0.96
                        : held * (1.04 - 0.08 * ease(u)) +
                          EDGE_WIDEN *
                              w.park *
                              Math.max(
                                  first ? 0 : 1 - smoothstep(0, EDGE_SPAN, u),
                                  final ? 0 : smoothstep(1 - EDGE_SPAN, 1, u),
                              ),
                el: () => CHASE_EL,
                fly: () => 0,
            };
        }
        if (seg.kind === "flyby") {
            const am = angleAt(w, (seg.t0 + seg.t1) / 2, epoch);
            const a0 = am - FLYBY_SPAN;
            const a1 = am + FLYBY_SPAN;
            const P0 = onPlane(w.plane, w.orbit - FLYBY_IN, a0);
            const P3 = onPlane(w.plane, w.orbit + FLYBY_OUT, a1);
            const L = (w.orbit * 2 * FLYBY_SPAN) / 3;
            const curve = bezier(
                P0,
                add(P0, scale(tangentOn(w.plane, a0), L)),
                add(P3, scale(tangentOn(w.plane, a1), -L)),
                P3,
            );
            // Closest approach: lean toward the world and push in. At the
            // ends the shot is wider and leans a little toward the world,
            // so it is in frame as the ship arrives and as it recedes.
            const bump = (u: number) =>
                smoothstep(0.2, 0.5, u) * (1 - smoothstep(0.5, 0.95, u));
            const ends = (u: number) =>
                1 - smoothstep(0, 0.3, u) + smoothstep(0.7, 1, u);
            return {
                at: curve.at,
                guide: (u) =>
                    mix(
                        curve.at(u),
                        worldAt(w, tOf(seg, u)),
                        FLYBY_LEAN * bump(u) + FLYBY_TAIL * ends(u),
                    ),
                dir: curve.dir,
                frame: (u) =>
                    w.frame * (1 - FLYBY_PUSH * bump(u) + FLYBY_WIDE * ends(u)),
                el: () => CHASE_EL,
                fly: () => 0,
            };
        }
        // Transfers are resolved below, once their neighbours exist.
        return null as unknown as Leg;
    });
    route.segments.forEach((seg, i) => {
        if (seg.kind !== "transfer") return;
        const before = legs[i - 1];
        const after = legs[i + 1];
        const path = spiral(before.at(1), after.at(0));
        const f0 = before.frame(1);
        const f1 = after.frame(0);
        // The fly-to: pull out to a shot of the world left behind and the
        // one ahead (the smallest sphere round both and the arc's middle),
        // cross, and push in, as one move.
        const from = worlds[seg.from ?? Math.max(0, seg.chapter - 1)];
        const to = worlds[Math.min(seg.chapter, last)];
        const dep = worldAt(from, seg.t0);
        const dest = worldAt(to, seg.t1);
        const centre = mix(boundCentre(dep, dest, path.at(0.5)), dep, FLY_BIAS);
        const wideFrame = FLY_CHORD * dist(dep, dest) + 2 * to.radius;
        // The chase follows the ship, offset as the legs either side are
        // where they join (a flyby's shot leans toward its world).
        const lead = sub(before.guide(1), before.at(1));
        const trail = sub(after.guide(0), after.at(0));
        const chase = (u: number) => add(path.at(u), mix(lead, trail, ease(u)));
        legs[i] = {
            at: path.at,
            // The target settles on the chase a little before the zoom.
            guide: (u) => mix(chase(u), centre, flyOf(u) ** 2),
            dir: path.dir,
            frame: (u) =>
                Math.exp(
                    lerp(
                        Math.log(lerp(f0, f1, ease(u))),
                        Math.log(wideFrame),
                        flyOf(u),
                    ),
                ),
            el: (u) => CHASE_EL + FLY_EL * flyOf(u),
            fly: flyOf,
        };
    });

    const shipAt = (p: number) => {
        const f = frameAt(route, p);
        return legs[f.index].at(f.u);
    };

    // The plan: a dashed spiral from the parking loop out to the next orbit.
    let planned: FlightPlan["planned"] = null;
    let reach = worlds.at(-1)?.orbit ?? FIRST_ORBIT;
    const planSeg = route.segments.find((s) => s.kind === "plan");
    if (planSeg && worlds.length) {
        const w = worlds[last];
        const porbit = w.orbit + GAP + 0.9 * (w.park + BODY.saturn.park) + 2;
        const pplane = plane(
            INCL[(last + 1) % INCL.length] * D2R,
            NODE[(last + 1) % NODE.length] * D2R,
        );
        const t = planSeg.t0;
        const A = add(worldAt(w, t), loopAt(w, t, 0));
        const aA = Math.atan2(A[2], A[0]);
        const end = onPlane(pplane, porbit, aA + 150 * D2R);
        const leg = spiral(A, end);
        const path = Array.from({ length: 241 }, (_, k) => leg.at(k / 240));
        planned = { orbit: porbit, plane: pplane, path, end };
        reach = porbit;
    }

    // The camera's track, sampled once and smoothed (a Gaussian in p): the
    // guide, the framing radius, the elevation and the azimuth.
    const K = SAMPLES;
    const G = new Float64Array(K * 3);
    const D = new Float64Array(K * 3);
    const F = new Float64Array(K);
    const E = new Float64Array(K);
    const H = new Float64Array(K);
    const A = new Float64Array(K);
    const flyK = new Float64Array(K);
    for (let k = 0; k < K; k++) {
        const f = frameAt(route, k / (K - 1));
        const leg = legs[f.index];
        flyK[k] = leg.fly(f.u);
        G.set(leg.guide(f.u), k * 3);
        F[k] = leg.frame(f.u);
        E[k] = leg.el(f.u);
        const d = leg.dir(f.u);
        D.set(d, k * 3);
        // Behind the heading, unwrapped.
        const a = Math.atan2(-d[2], -d[0]);
        H[k] = k > 0 ? H[k - 1] + wrapPi(a - H[k - 1]) : a;
    }
    const behind = (p: number) => {
        const x = clamp01(p) * (K - 1);
        const k = Math.min(K - 2, Math.floor(x));
        return lerp(H[k], H[k + 1], x - k);
    };

    // The azimuth: behind the heading and panned toward the Sun. It is
    // still while a chapter holds (its slow pan and its world's orbit
    // together turn the view by HOLD_TURN at most), pans across a flyby,
    // and makes one even move from each of these to the next.
    const anchors: Anchor[] = [];
    route.segments.forEach((seg, i) => {
        const span = seg.p1 - seg.p0;
        if (seg.kind === "transfer") return;
        const prev = anchors.at(-1);
        if (
            seg.kind === "plan" &&
            prev &&
            Math.abs(prev.p1 + prev.out - seg.p0) < 1e-9
        ) {
            // The finale holds on from the last chapter.
            prev.p1 = seg.p1;
            prev.out = 0;
            return;
        }
        if (seg.kind === "flyby") {
            // The camera enters the flyby at its own yaw and flies on,
            // panning across the world at the moves' pace.
            anchors.push({
                p0: seg.p0,
                p1: seg.p0,
                yaw: () => FLYBY_YAW,
                in: FLYBY_RAMP * span,
                out: FLYBY_RAMP * span,
                through: true,
            });
            return;
        }
        const first = i === 0;
        const joinsAfter = route.segments[i + 1]?.kind === "transfer";
        const p0 = seg.p0 + (first ? 0 : HOLD_IN) * span;
        const p1 = seg.p0 + (joinsAfter ? HOLD_OUT : 1) * span;
        const orbital = Math.abs(behind(p1) - behind(p0));
        const swing =
            seg.kind === "plan"
                ? 0
                : Math.min(
                      2 * COAST_SWING,
                      Math.max(0, HOLD_TURN / Math.cos(CHASE_EL) - orbital),
                  );
        anchors.push({
            p0,
            p1,
            yaw: (p) =>
                CHASE_YAW + swing * (ease((p - p0) / (p1 - p0 || 1)) - 0.5),
            in: p0 - seg.p0,
            out: seg.p1 - p1,
        });
    });
    const azHeld = (a: Anchor, p: number) => behind(p) + a.yaw(p);
    /** An anchor's azimuth and its rate (per unit p) at one end. */
    const edgeOf = (
        a: Anchor,
        end: boolean,
    ): { p: number; az: number; rate: number } => {
        const p = end ? a.p1 : a.p0;
        const az = azHeld(a, p);
        const k = anchors.indexOf(a);
        if (a.through) {
            // The secant through the neighbours' ends.
            const at = (x: Anchor | undefined, atEnd: boolean) => {
                if (!x) return null;
                const q = atEnd ? x.p1 : x.p0;
                return { p: q, az: azHeld(x, q) };
            };
            const u = at(anchors[k - 1], true);
            const v = at(anchors[k + 1], false);
            const rate =
                u && v
                    ? (v.az - u.az) / (v.p - u.p || 1)
                    : u
                      ? (az - u.az) / (p - u.p || 1)
                      : v
                        ? (v.az - az) / (v.p - p || 1)
                        : 0;
            return { p, az, rate };
        }
        const h = Math.min(1e-4, (a.p1 - a.p0) / 4 || 1e-4);
        const rate = end
            ? (az - azHeld(a, p - h)) / h
            : (azHeld(a, p + h) - az) / h;
        return { p, az, rate };
    };
    const azAt = (p: number): number => {
        const j = anchors.findIndex((a) => p <= a.p1);
        const next = j < 0 ? null : anchors[j];
        if (next && p >= next.p0) return azHeld(next, p);
        const prev = j < 0 ? anchors.at(-1) : j > 0 ? anchors[j - 1] : null;
        if (!prev && !next) return behind(p) + CHASE_YAW;
        if (!prev) return azHeld(next!, p);
        if (!next) return azHeld(prev, p);
        // A move from one anchor to the next: it eases out of the first at
        // its rate, cruises, and eases into the next at that one's rate.
        const a = edgeOf(prev, true);
        const b = edgeOf(next, false);
        const span = b.p - a.p;
        const turn = b.az - a.az;
        if (span <= 1e-9 || Math.abs(turn) < 1e-9) return a.az;
        const fit = Math.min(1, (0.9 * span) / (prev.out + next.in || 1));
        return (
            a.az +
            turn *
                glide(
                    (p - a.p) / span,
                    (prev.out * fit) / span,
                    (next.in * fit) / span,
                    (a.rate * span) / turn,
                    (b.rate * span) / turn,
                )
        );
    };
    for (let k = 0; k < K; k++) A[k] = azAt(k / (K - 1)) + FLY_YAW * flyK[k];
    const blur = (src: Float64Array, stride: number) => {
        const out = new Float64Array(src.length);
        const sigma = SIGMA * (K - 1);
        const reachK = Math.ceil(sigma * 3);
        const weights = Array.from({ length: reachK * 2 + 1 }, (_, j) =>
            Math.exp(-(((j - reachK) / sigma) ** 2) / 2),
        );
        for (let k = 0; k < K; k++) {
            for (let c = 0; c < stride; c++) {
                let sum = 0;
                let wsum = 0;
                for (let j = -reachK; j <= reachK; j++) {
                    const q = Math.min(K - 1, Math.max(0, k + j));
                    const wt = weights[j + reachK];
                    sum += src[q * stride + c] * wt;
                    wsum += wt;
                }
                out[k * stride + c] = sum / wsum;
            }
        }
        return out;
    };
    const Gs = blur(G, 3);
    const Ds = blur(D, 3);
    const Fs = blur(F, 1);
    const Es = blur(E, 1);
    const As = blur(A, 1);
    const sample = (p: number) => {
        const x = clamp01(p) * (K - 1);
        const k = Math.min(K - 2, Math.floor(x));
        const f = x - k;
        const v3 = (arr: Float64Array): Vec3 => [
            lerp(arr[k * 3], arr[k * 3 + 3], f),
            lerp(arr[k * 3 + 1], arr[k * 3 + 4], f),
            lerp(arr[k * 3 + 2], arr[k * 3 + 5], f),
        ];
        return {
            g: v3(Gs),
            d: unit(v3(Ds)),
            f: lerp(Fs[k], Fs[k + 1], f),
            el: lerp(Es[k], Es[k + 1], f),
            az: lerp(As[k], As[k + 1], f),
        };
    };

    /** From the target, toward the eye. */
    const outward = (az: number, el: number): Vec3 => [
        Math.cos(el) * Math.cos(az),
        Math.sin(el),
        Math.cos(el) * Math.sin(az),
    ];
    const orbitFrom = (target: Vec3, d: number, az: number, el: number) =>
        add(target, scale(outward(az, el), d));

    const planStart = planSeg ? sample(planSeg.p0) : null;
    const planShip = planSeg ? shipAt(planSeg.p0) : null;

    const pose = (frame: Frame, layout: Layout): Pose => {
        const half = Math.max(1, Math.min(layout.halfW, layout.halfH));
        const s = sample(frame.p);
        const dChase = (s.f * layout.kpx) / half;
        const target = add(s.g, scale(s.d, AHEAD * s.f));
        const eyeChase = orbitFrom(target, dChase, s.az, s.el);
        const fly = frame.segment.kind === "transfer" ? flyOf(frame.u) : 0;
        if (frame.segment.kind !== "plan" || !planStart || !planShip)
            return { eye: eyeChase, target, overview: 0, fly };

        // Crane up and out: target to the Sun, distance (in log) to the
        // whole system, elevation up, azimuth round to the ship's side.
        const e = smoother(frame.u / 0.78);
        const fit = reach * 1.1;
        const el = lerp(s.el, OVER_EL, e);
        const dOver =
            Math.max(
                (fit * layout.kpx) / Math.max(1, layout.halfW),
                (fit * Math.sin(OVER_EL) * layout.kpx) /
                    Math.max(1, layout.halfH),
            ) * 1.04;
        let azOver = Math.atan2(planShip[2], planShip[0]) + OVER_AZ;
        azOver += TAU * Math.round((planStart.az - azOver) / TAU);
        const d = Math.exp(lerp(Math.log(dChase), Math.log(dOver), e));
        const aim = mix(target, [0, 0, 0], smoother(frame.u / 0.62));
        return {
            eye: orbitFrom(aim, d, lerp(s.az, azOver, e), el),
            target: aim,
            overview: e,
            fly: 0,
        };
    };

    const phaseAngle = (p: Pose, world: World, t: number) => {
        const c = worldAt(world, t);
        const toSun = unit(scale(c, -1));
        const toEye = unit(sub(p.eye, c));
        return Math.acos(Math.min(1, Math.max(-1, dot(toSun, toEye)))) / D2R;
    };

    // Compose the rest frames (where the rail sends each card, and the
    // still frame under reduced motion): shift each coast's loop so the
    // ship sits on the near side, below and right of its world, clear of
    // the disc and the ring. Directions only, so any stage agrees.
    const restAim = [Math.cos(REST_ANGLE), -Math.sin(REST_ANGLE)];
    route.segments.forEach((seg, index) => {
        if (seg.kind !== "coast") return;
        const p = route.rest[seg.chapter];
        if (p === undefined || p < seg.p0 || p > seg.p1) return;
        const f = frameAt(route, p);
        if (f.index !== index) return;
        const shape = shiftShape(seg, f.u);
        if (shape < 0.05) return;
        const w = worlds[seg.chapter];
        const s = sample(p);
        const view = { eye: add(s.g, outward(s.az, s.el)), target: s.g };
        const { fwd, right, up } = viewAxes(view);
        const leg = legs[index];
        const centre = worldAt(w, f.t);
        // The first coast has no join before it, so its loop may start
        // anywhere; the others may run a little ahead or behind.
        const limit = seg.chapter === 0 ? Math.PI : PHASE_MAX;
        let best = 0;
        let bestScore = Infinity;
        for (let j = 0; j <= 360; j++) {
            const shift = ((j / 360) * 2 - 1) * limit * shape;
            phaseShift[index] = shift / shape;
            const off = sub(leg.at(f.u), centre);
            const x = dot(off, right);
            const y = dot(off, up);
            const z = dot(off, fwd);
            const across = Math.hypot(x, y);
            let score = Math.abs(
                wrapPi(Math.atan2(y, x) - Math.atan2(restAim[1], restAim[0])),
            );
            if (z > 0) score += 4;
            if (across < REST_CLEAR * w.radius) score += 4;
            if (w.kind === "saturn") {
                // Behind the ring: the sight line toward the camera
                // crosses the ring plane inside the ring.
                const n = w.pole;
                const denom = dot(fwd, n);
                if (Math.abs(denom) > 1e-6) {
                    const back = dot(off, n) / denom;
                    const hit = sub(off, scale(fwd, back));
                    const r = Math.hypot(...hit) / w.radius;
                    if (back > 0 && r > RING.inner && r < RING.outer)
                        score += 4;
                }
            }
            score += 0.02 * Math.abs(shift);
            if (score < bestScore) {
                bestScore = score;
                best = shift / shape;
            }
        }
        phaseShift[index] = best;
    });

    const trail = (n: number) =>
        Array.from({ length: n }, (_, k) =>
            shipAt((k / (n - 1)) * route.flown),
        );

    const curSeg =
        lastCurrent < 0
            ? null
            : (route.segments.find(
                  (s) => s.kind === "transfer" && s.chapter === lastCurrent,
              ) ?? coastOf(lastCurrent));

    return {
        worlds,
        current: lastCurrent,
        currentFrom: curSeg ? curSeg.p0 : 1,
        planned,
        reach,
        epoch,
        shipAt,
        worldAt,
        spinAt: (w, p) => p * TAU * (1.1 + 0.25 * w.chapter) + w.chapter,
        pose,
        phaseAngle,
        trail,
    };
}
