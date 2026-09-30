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
 * The camera's track is sampled once over the whole route and smoothed,
 * so every pose is a function of the progress alone and scrubbing
 * backwards retraces the same frames. It holds on a chapter's world while
 * its card is read (the ship loops or passes, the camera doesn't), and
 * moves between chapters: each transfer backs off to a two-shot of the
 * world left behind and the one ahead, then flies to the next world. The
 * finale cranes up to a map of the whole route, centred on the Sun, and
 * holds there while the planned leg draws.
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
    /** While the camera holds on the world, it frames a sphere about
     *  this big around it. */
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
 *  transfer and the Sun's angle at launch. A short sweep keeps the two
 *  worlds of a transfer on the same side of the Sun, so one shot frames
 *  both without it. */
const FIRST_ORBIT = 16;
const GAP = 6.5;
const SWEEP = 50 * D2R;
const LAUNCH = 200 * D2R;
/** The planned leg's sweep about the Sun: the first of these (degrees)
 *  whose end sits well inside the map on a wide stage and a phone. */
const PLAN_SWEEPS = [90, 100, 80, 110, 70, 120, 130];
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
    box: Box;
    /** The finale's map: where its centre lands, the box the outermost
     *  orbit is fitted into (pixels), and that orbit's share of it. */
    map: { lens: { x: number; y: number }; box: Box; fit: number };
}

export interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
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
            // Off the record's scrim, clear of the caption band.
            map: {
                lens: { x: W * 0.7, y: H * 0.5 },
                box: { x0: W * 0.46, y0: 24, x1: W - 48, y1: H - 56 },
                fit: 1.06,
            },
        };
    }
    const lens = { x: W * 0.5, y: H * 0.29 };
    return {
        W,
        H,
        wide,
        fov,
        kpx,
        lens,
        halfW: W * 0.46,
        halfH: H * 0.25,
        box: { x0: 12, y0: 16, x1: W - 12, y1: H * 0.55 },
        // The map fills the width above the record; its outermost orbit
        // may run a little past the sides.
        map: {
            lens,
            box: {
                x0: lens.x - W * 0.46,
                y0: lens.y - H * 0.3,
                x1: lens.x + W * 0.46,
                y1: lens.y + H * 0.3,
            },
            fit: 0.95,
        },
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
 *  lens shift flight-gl.ts writes into the projection matrix (the pose's
 *  lens, else the stage's). `depth` is along the view axis (behind the
 *  camera when ≤ 0). */
export function screenOf(
    pose: { eye: Vec3; target: Vec3; lens?: { x: number; y: number } },
    stage: Pick<Stage, "kpx" | "lens" | "W" | "H">,
    point: Vec3,
) {
    return projector(pose, stage)(point);
}

/** screenOf for many points of one pose: the axes are found once. */
function projector(
    pose: { eye: Vec3; target: Vec3; lens?: { x: number; y: number } },
    stage: Pick<Stage, "kpx" | "lens" | "W" | "H">,
) {
    const { fwd, right, up } = viewAxes(pose);
    const lx = pose.lens ? pose.lens.x * stage.W : stage.lens.x;
    const ly = pose.lens ? pose.lens.y * stage.H : stage.lens.y;
    return (point: Vec3) => {
        const v = sub(point, pose.eye);
        const depth = dot(v, fwd);
        const k = stage.kpx / Math.max(1e-6, Math.abs(depth));
        return {
            x: lx + dot(v, right) * k,
            y: ly - dot(v, up) * k,
            depth,
        };
    };
}

/** How far Saturn's ring reaches from its centre toward direction v on
 *  the stage, in the planet's radii: where a ray along v leaves the
 *  ring's outer edge as projected (0 when the ring is edge-on), so a
 *  leader ends on the ring or, past it, on the disc. */
export function ringReach(
    pose: { eye: Vec3; target: Vec3 },
    pole: Vec3,
    v: { x: number; y: number },
) {
    const { right, up } = viewAxes(pose);
    const e1 = unit(
        cross(pole, Math.abs(pole[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]),
    );
    const e2 = cross(pole, e1);
    // The ring's two radii on the stage (y down), per unit of radius.
    const ax = dot(e1, right);
    const ay = -dot(e1, up);
    const bx = dot(e2, right);
    const by = -dot(e2, up);
    const det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-4) return 0;
    const m = Math.hypot(by * v.x - bx * v.y, ax * v.y - ay * v.x) / det;
    return RING.outer / Math.max(1e-6, Math.abs(m));
}

/* ---- labels ---------------------------------------------------------------- */

/** No world is drawn smaller than this radius on the stage, pixels, so the
 *  map shows worlds, not empty rings. */
export const minWorldPx = (stage: Pick<Stage, "wide">) => (stage.wide ? 6 : 5);
/** Labels keep right of the record on a wide stage. */
export const labelMinX = (stage: Pick<Stage, "wide" | "W">) =>
    stage.wide ? stage.W * 0.37 : 8;

/** Where labels and marks may print, pixels: right of the record and
 *  above the caption band on a wide stage; above the record on a phone
 *  (`record` is its top edge, measured when the stage is sized). A label
 *  fades out as it reaches an edge rather than sliding along it. */
export function labelSafe(
    stage: Pick<Stage, "W" | "H" | "wide" | "box">,
    record?: number,
): Box {
    if (stage.wide)
        return {
            x0: labelMinX(stage),
            y0: 8,
            x1: stage.W - 12,
            y1: stage.H - 54,
        };
    return { x0: 8, y0: 8, x1: stage.W - 8, y1: (record ?? stage.box.y1) - 8 };
}

/** How far a label stands off its world's centre, pixels: past the world
 *  as drawn (Saturn's ring included) and past `radial` of its parking
 *  loop (the whole loop for a world the ship circles, else only in the
 *  overview). `depth` is the world's, along the view axis. */
export function labelGap(
    stage: Stage,
    w: World,
    depth: number,
    radial: number,
) {
    const px = (w.radius * stage.kpx) / Math.max(1e-3, depth);
    const drawn = Math.max(px, minWorldPx(stage));
    const ring = w.kind === "saturn" ? drawn * RING.outer : drawn;
    const loop = (w.park * stage.kpx * radial) / Math.max(0.1, depth);
    const small = 1 - smoothstep(3, 7, px);
    return Math.min(stage.W * 0.3, Math.max(ring, loop, 6 * small)) + 9;
}

export interface LabelSize {
    w: number;
    h: number;
}
/** A label's side in the map: a direction on the stage, and how many of
 *  its gaps it stands off. */
export interface LabelSide {
    x: number;
    y: number;
    reach: number;
}

/** A label's box `gap` pixels off `at` toward direction v: the edge or
 *  corner nearest the world faces it. */
export function labelBox(
    at: { x: number; y: number },
    v: { x: number; y: number },
    gap: number,
    size: LabelSize,
): Box {
    const x0 = at.x + v.x * gap + (-0.5 + 0.5 * v.x) * size.w;
    const y0 = at.y + v.y * gap + (-0.5 + 0.5 * v.y) * size.h;
    return { x0, y0, x1: x0 + size.w, y1: y0 + size.h };
}

/** The farthest a label may stand off `at` toward v and keep its box
 *  inside `room` (pixels; Infinity when v leads to no edge). */
export function roomGap(
    at: { x: number; y: number },
    v: { x: number; y: number },
    size: LabelSize,
    room: Box,
) {
    let most = Infinity;
    const axis = (
        d: number,
        from: number,
        lo: number,
        hi: number,
        n: number,
    ) => {
        // The box spans from + d·gap + (−0.5 + 0.5·d)·n, n long.
        if (d > 1e-6)
            most = Math.min(most, (hi - from - (0.5 + 0.5 * d) * n) / d);
        if (d < -1e-6)
            most = Math.min(most, (lo - from - (-0.5 + 0.5 * d) * n) / d);
    };
    axis(v.x, at.x, room.x0, room.x1, size.w);
    axis(v.y, at.y, room.y0, room.y1, size.h);
    return most;
}

/** A label fades out over this many pixels as it reaches the edge of
 *  the area it may print in. */
export const LABEL_FADE = 24;
/** On the chase a label stands this far off the route flown near its
 *  world, its loop included (pixels): the ship's half-length and glow,
 *  and a margin. */
export const LOOP_CLEAR = 30;
/** A side within this angle of its world's orbit on the stage would lay
 *  the leader along the orbit line (cosine of 20°). */
const ALONG_ORBIT = 0.94;
/** A side beside a world may tilt this much (30°) off the level. */
const TILT_COS = Math.cos(Math.PI / 6);
const TILT_SIN = Math.sin(Math.PI / 6);

/** Box `b` shrunk by `m` on every side. */
export const inset = (b: Box, m: number): Box => ({
    x0: b.x0 + m,
    y0: b.y0 + m,
    x1: b.x1 - m,
    y1: b.y1 - m,
});

/** A point as an empty box. */
export const pointBox = (q: { x: number; y: number }): Box => ({
    x0: q.x,
    y0: q.y,
    x1: q.x,
    y1: q.y,
});

/** Whether box `r` lies within box `b`. */
export const within = (r: Box, b: Box) =>
    r.x0 >= b.x0 && r.x1 <= b.x1 && r.y0 >= b.y0 && r.y1 <= b.y1;

/* ---- legs ------------------------------------------------------------------ */

/** The camera at one moment: the point it looks at, the radius of the
 *  sphere it frames there, and the eye's elevation and azimuth seen from
 *  that point (see outward()). */
interface Shot {
    target: Vec3;
    frame: number;
    el: number;
    az: number;
}

interface Leg {
    /** The ship at phase u. */
    at(u: number): Vec3;
    /** The camera at phase u. */
    shot(u: number): Shot;
    /** A transfer's fly-to: 0 (the chase) to 1 (its two-shot). */
    fly(u: number): number;
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
    };
}

/** From the camera's target toward its eye. */
const outward = (az: number, el: number): Vec3 => [
    Math.cos(el) * Math.cos(az),
    Math.sin(el),
    Math.cos(el) * Math.sin(az),
];
/** The azimuth that puts the eye behind a heading. */
const behind = (d: Vec3) => Math.atan2(-d[2], -d[0]);

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
    /** Where a world is drawn: at mission time t on the chase, moving to
     *  where its chapter ended as the map rises, so each sits on its own
     *  loop of the route there. */
    mapAt(w: World, t: number, overview: number): Vec3;
    /** How far the route at progress p moves in the map: the first
     *  coast's loop goes with its world to where the chapter ended, so the
     *  route opens on a loop round Earth rather than a curl along its
     *  orbit. Zero elsewhere, and zero with zero slope where the loop
     *  leaves. */
    carry(p: number, overview: number): Vec3;
    /** Whether the ship circles each world (a coast), so its label
     *  stands clear of the loop. */
    looped: boolean[];
    /** Each world's label side in the map on a stage, for labels of these
     *  sizes (the "Open to" label's too, which keeps outward): chosen once
     *  at the map's pose, so no label changes side as the map rises. */
    mapSides(
        stage: Stage,
        sizes: LabelSize[],
        open: LabelSize | null,
        safe?: Box,
    ): LabelSide[];
    /** Each world's label side on the chase, per segment: one per world,
     *  of away from the Sun on screen (level or tilted 30°), below, above
     *  and the Sun's side, the one where the label fits well inside
     *  `safe`, clear of the route flown near the world and of its orbit,
     *  in the most of the frames it shows in (its approach, hold and
     *  departure). Into the map (the plan, judged at its start) the `map`
     *  side or the nearest that fits, so the label turns with the crane.
     *  A phone, narrow beside its worlds, always puts it below. Chosen
     *  once per stage, so a label never changes side within its chapter. */
    chaseSides(
        stage: Stage,
        sizes: LabelSize[],
        safe: Box,
        map?: LabelSide[],
    ): LabelSide[][];
    /** How far off its centre `c` toward direction v a world's label of
     *  `size` stands on the chase so the route flown near the world (its
     *  arrival, loop or flyby) keeps LOOP_CLEAR off it: the farthest the
     *  route reaches that way through the label's band across v, plus
     *  LOOP_CLEAR (pixels; 0 where nothing runs through the band). */
    flownGap(
        i: number,
        view: Pose,
        stage: Stage,
        c: Vec3,
        v: { x: number; y: number },
        size: LabelSize,
    ): number;
    /** A world's spin about its axis at progress p (radians). */
    spinAt(w: World, p: number): number;
    /** The camera at a frame, for a stage. */
    pose(frame: Frame, stage: Stage): Pose;
    /** The Sun–world–eye angle, degrees: 0 is full, 90 half, 180 new. */
    phaseAngle(pose: Pose, world: World, t: number): number;
    /** Ship positions over [0, route.flown], n samples. */
    trail(n: number): Vec3[];
}

export interface Pose {
    eye: Vec3;
    target: Vec3;
    /** Where the target lands on the stage, as shares of its width and
     *  height. */
    lens: { x: number; y: number };
    /** 0 on the chase, 1 in the overview. */
    overview: number;
    /** A transfer's fly-to, 0 (the chase) to 1 (its two-shot); 0
     *  outside transfers. */
    fly: number;
}

const CHASE_EL = 19 * D2R;
/** Behind the world's heading and well to the Sun's side: the orbits are
 *  circles with the Sun radially inward, so this one yaw lights every held
 *  world gibbous (a 45–63° phase) from screen right, with the Sun about
 *  125° off the view axis. */
const CHASE_YAW = -36 * D2R;
/** Each coast pans this much across its world, against the world's own
 *  turn about the Sun, so the view barely moves while the card is read. */
const COAST_SWING = 8 * D2R;
/** The flyby holds on its world like a coast, from further round toward
 *  the Sun: the ship passes on the far side, so at closest approach it
 *  skims the limb of a bright gibbous world. There the shot leans toward
 *  the ship and pushes in. */
const FLYBY_YAW = -48 * D2R;
const FLYBY_LEAN = 0.3;
const FLYBY_PUSH = 0.4;
/** A transfer's two-shot, the move between two chapters: from behind the
 *  world left behind (A), turned toward the Sun and raised, looking past
 *  it at the world ahead (B) with the ship between. A is near and left,
 *  B far and right, both lit from the right, and the Sun out of frame.
 *  The eye sits this many of A's radii from it; the view looks this share
 *  of the way toward B and toward the ship. */
const SHOT_BACK = 18;
const SHOT_YAW = 18 * D2R;
const SHOT_EL = 22 * D2R;
const SHOT_AIM = 0.4;
const SHOT_AIM_SHIP = 0.2;
/** The reference stage (1440×828): the two-shot is composed for it, and
 *  its lens over its subject's half box turns the eye's distance into a
 *  framing radius, which scales it to any other stage. */
const REF_SCALE = (() => {
    const s = stageFrame(1440, 828, true);
    return s.kpx / Math.min(s.halfW, s.halfH);
})();
/** The finale: one crane up to the map over this share of the plan, then
 *  the camera holds while the planned leg draws. The map looks down at
 *  this elevation, from within ±30° of the chase's azimuth, so the crane
 *  is a rise and pull-back rather than a swing round the system. */
export const CRANE = 0.55;
const OVER_EL = 56 * D2R;
const OVER_TURN = -15 * D2R;
/** The camera's track: samples over the route and the smoothing (a
 *  Gaussian in p). */
const SAMPLES = 800;
const SIGMA = 0.006;
/** Where the ship rests at a card's settled frame: on the near side, below
 *  and right of its world (screen angle below the horizontal), clear of
 *  the disc and of Saturn's ring. */
const REST_ANGLE = 35 * D2R;
const REST_CLEAR = 1.4;
/** The loop may run ahead or behind by this much at most (radians), so
 *  the ship never stalls or turns back. */
const PHASE_MAX = 1.2;

/** The fly-to over a transfer: out to the two-shot, held across the
 *  card's handover at u = 0.5, and on to the next world; zero slope at
 *  both joins. */
const flyOf = (u: number) =>
    smoothstep(0, 0.42, u) * (1 - smoothstep(0.54, 1, u));

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
            frame: body.frame,
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
    /** Behind a world's heading at time t. */
    const behindWorld = (w: World, t: number) =>
        behind(tangentOn(w.plane, angleAt(w, t, epoch)));

    // Each coast's loop phase, solved below (the camera looks at the world
    // on a coast, so it doesn't depend on it). The shift is zero, with
    // zero slope, where the loop joins a transfer; the first coast has no
    // join at its start.
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
            // The loop spirals in from a wider arc and out again, so the
            // curvature changes gradually; insertion and departure are
            // brief, so the loop holds for the card.
            const wide = (u: number) =>
                plan
                    ? 1
                    : 1 +
                      INSERT *
                          ((first ? 0 : 1 - smoothstep(0, 0.14, u)) +
                              (final ? 0 : smoothstep(0.86, 1, u)));
            // The camera holds on the world, the whole loop in frame, with
            // one slow push; the ship moves, the camera doesn't. The plan
            // keeps the shot the last coast ends on.
            const own = plan ? (coastOf(last) ?? seg) : seg;
            const turn = wrapPi(
                behindWorld(w, own.t1) - behindWorld(w, own.t0),
            );
            const pan = -Math.sign(turn) * COAST_SWING;
            const held = w.frame + 0.5 * w.park;
            return {
                at: (u) => {
                    const t = tOf(seg, u);
                    return add(
                        worldAt(w, t),
                        scale(loopAt(w, t, gammaOf(u)), wide(u)),
                    );
                },
                shot: (u) => {
                    const t = tOf(seg, u);
                    const e = plan ? 1 : ease(u);
                    return {
                        target: worldAt(w, t),
                        frame: held * (1.04 - 0.08 * e),
                        el: CHASE_EL,
                        az: behindWorld(w, t) + CHASE_YAW + pan * (e - 0.5),
                    };
                },
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
            // The camera holds on the world, as on a coast, and the ship
            // flies past it: at closest approach the shot leans toward the
            // ship and pushes in, so it crosses the world's limb.
            const bump = (u: number) =>
                smoothstep(0.2, 0.5, u) * (1 - smoothstep(0.5, 0.95, u));
            const turn = wrapPi(
                behindWorld(w, seg.t1) - behindWorld(w, seg.t0),
            );
            const pan = -Math.sign(turn) * COAST_SWING;
            return {
                at: curve.at,
                shot: (u) => {
                    const t = tOf(seg, u);
                    return {
                        target: mix(
                            worldAt(w, t),
                            curve.at(u),
                            FLYBY_LEAN * bump(u),
                        ),
                        frame: w.frame * (1 - FLYBY_PUSH * bump(u)),
                        el: CHASE_EL,
                        az:
                            behindWorld(w, t) +
                            FLYBY_YAW +
                            pan * (ease(u) - 0.5),
                    };
                },
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
        const a = before.shot(1);
        const b = after.shot(0);
        // The two-shot, composed at the transfer's midpoint: the eye
        // behind A, turned toward the Sun and raised, looking a set share
        // of the way toward B and toward the ship, so every transfer
        // frames alike. The target is at A's depth, so a narrower stage
        // backs off from A.
        const from = worlds[seg.from ?? Math.max(0, seg.chapter - 1)];
        const tm = (seg.t0 + seg.t1) / 2;
        const A = worldAt(from, tm);
        const B = worldAt(worlds[Math.min(seg.chapter, last)], tm);
        const line = Math.atan2(A[2] - B[2], A[0] - B[0]);
        const sunward = Math.sign(wrapPi(Math.atan2(-A[2], -A[0]) - line)) || 1;
        const eye = add(
            A,
            scale(
                outward(line + sunward * SHOT_YAW, SHOT_EL),
                SHOT_BACK * from.radius,
            ),
        );
        const toward = (q: Vec3, k: number) => scale(unit(sub(q, eye)), k);
        const axis = unit(
            add(
                add(
                    toward(A, 1 - SHOT_AIM - SHOT_AIM_SHIP),
                    toward(B, SHOT_AIM),
                ),
                toward(path.at(0.5), SHOT_AIM_SHIP),
            ),
        );
        const C = add(eye, scale(axis, dot(sub(A, eye), axis)));
        // The holds' eyes either side, on the reference stage. The eye
        // backs off from A to the two-shot; then the view turns to B,
        // which sends A out of frame, and the eye flies to B's hold.
        const eyeOf = (s: Shot) =>
            add(s.target, scale(outward(s.az, s.el), s.frame * REF_SCALE));
        const eyeA = eyeOf(a);
        const eyeB = eyeOf(b);

        const shotOf = (target: Vec3, at: Vec3): Shot => {
            const v = sub(at, target);
            const d = Math.hypot(v[0], v[1], v[2]);
            return {
                target,
                frame: d / REF_SCALE,
                el: Math.asin(v[1] / d),
                az: Math.atan2(v[2], v[0]),
            };
        };
        legs[i] = {
            at: path.at,
            shot: (u) => {
                const m = flyOf(u);
                if (u <= 0.5)
                    return shotOf(mix(a.target, C, m), mix(eyeA, eye, m));
                return shotOf(
                    mix(C, b.target, smoothstep(0, 0.6, 1 - m)),
                    mix(eye, eyeB, 1 - m),
                );
            },
            fly: flyOf,
        };
    });

    const shipAt = (p: number) => {
        const f = frameAt(route, p);
        return legs[f.index].at(f.u);
    };

    // The camera's track, sampled once and smoothed (a Gaussian in p): the
    // target, the framing radius, the elevation and the azimuth (unwrapped).
    const K = SAMPLES;
    const G = new Float64Array(K * 3);
    const F = new Float64Array(K);
    const E = new Float64Array(K);
    const Z = new Float64Array(K);
    for (let k = 0; k < K; k++) {
        const f = frameAt(route, k / (K - 1));
        const s = legs[f.index].shot(f.u);
        G.set(s.target, k * 3);
        F[k] = s.frame;
        E[k] = s.el;
        Z[k] = k > 0 ? Z[k - 1] + wrapPi(s.az - Z[k - 1]) : s.az;
    }
    const sigma = SIGMA * (K - 1);
    const reachK = Math.ceil(sigma * 3);
    const weights = Array.from({ length: reachK * 2 + 1 }, (_, j) =>
        Math.exp(-(((j - reachK) / sigma) ** 2) / 2),
    );
    const blur = (src: Float64Array, stride: number) => {
        const out = new Float64Array(src.length);
        for (let k = 0; k < K; k++) {
            for (let c = 0; c < stride; c++) {
                let sum = 0;
                let wsum = 0;
                for (let j = -reachK; j <= reachK; j++) {
                    const q = Math.min(K - 1, Math.max(0, k + j));
                    sum += src[q * stride + c] * weights[j + reachK];
                    wsum += weights[j + reachK];
                }
                out[k * stride + c] = sum / wsum;
            }
        }
        return out;
    };
    const Gs = blur(G, 3);
    const Fs = blur(F, 1);
    const Es = blur(E, 1);
    const Zs = blur(Z, 1);
    const sample = (p: number) => {
        const x = clamp01(p) * (K - 1);
        const k = Math.min(K - 2, Math.floor(x));
        const f = x - k;
        return {
            g: [
                lerp(Gs[k * 3], Gs[k * 3 + 3], f),
                lerp(Gs[k * 3 + 1], Gs[k * 3 + 4], f),
                lerp(Gs[k * 3 + 2], Gs[k * 3 + 5], f),
            ] as Vec3,
            f: lerp(Fs[k], Fs[k + 1], f),
            el: lerp(Es[k], Es[k + 1], f),
            az: lerp(Zs[k], Zs[k + 1], f),
        };
    };

    const orbitFrom = (target: Vec3, d: number, az: number, el: number) =>
        add(target, scale(outward(az, el), d));

    // The finale's map looks down at the Sun from the azimuth the chase
    // ends on (OVER_TURN within ±30°).
    const planSeg = route.segments.find((s) => s.kind === "plan");
    const overAz = (planSeg ? sample(planSeg.p0).az : 0) + OVER_TURN;
    const sun: Vec3 = [0, 0, 0];

    // The outermost orbit, which the map frames: the planned one when
    // there is a plan.
    let reach = worlds.at(-1)?.orbit ?? FIRST_ORBIT;
    let outer = worlds.at(-1)?.plane ?? plane(0, 0);
    const pw = worlds[last];
    const pplane = plane(
        INCL[(last + 1) % INCL.length] * D2R,
        NODE[(last + 1) % NODE.length] * D2R,
    );
    if (planSeg && pw) {
        reach = pw.orbit + GAP + 0.9 * (pw.park + BODY.saturn.park) + 2;
        outer = pplane;
    }
    const rim = Array.from({ length: 96 }, (_, k) =>
        onPlane(outer, reach, (k / 96) * TAU),
    );

    /** The map on a stage: as far back as puts the outermost orbit, at
     *  `fit` of its size, inside the map's box. Each point bounds the
     *  distance: offset / (d + its depth past the Sun) ≤ the box's side. */
    const mapShot = (stage: Stage) => {
        const { lens, box, fit } = stage.map;
        const out = outward(overAz, OVER_EL);
        const { fwd, right, up } = viewAxes({ eye: out, target: sun });
        const k = stage.kpx;
        let d = 0;
        for (const q of rim) {
            const c = dot(q, fwd) * fit;
            const a = dot(q, right) * fit;
            const b = dot(q, up) * fit;
            const side = a > 0 ? box.x1 - lens.x : lens.x - box.x0;
            const level = b > 0 ? lens.y - box.y0 : box.y1 - lens.y;
            d = Math.max(
                d,
                (Math.abs(a) * k) / Math.max(1, side) - c,
                (Math.abs(b) * k) / Math.max(1, level) - c,
            );
        }
        return {
            eye: scale(out, d),
            target: sun,
            lens: { x: lens.x / stage.W, y: lens.y / stage.H },
            d,
        };
    };

    // The plan: a dashed spiral from the parking loop out to the planned
    // orbit, ending where it reads in the map on a wide stage and a phone:
    // well inside the frame, clear of the Sun, heading into the picture.
    let planned: FlightPlan["planned"] = null;
    if (planSeg && pw) {
        const t = planSeg.t0;
        const A = add(worldAt(pw, t), loopAt(pw, t, 0));
        const aA = Math.atan2(A[2], A[0]);
        const refs = [stageFrame(1440, 828, true), stageFrame(390, 780, false)];
        const reads = (deg: number) =>
            refs.every((stage) => {
                const shot = mapShot(stage);
                const a = aA + deg * D2R;
                const at = screenOf(shot, stage, onPlane(pplane, reach, a));
                const on = screenOf(
                    shot,
                    stage,
                    add(onPlane(pplane, reach, a), tangentOn(pplane, a)),
                );
                const s = screenOf(shot, stage, sun);
                const m = stage.wide ? 80 : 24;
                const inside = (x: number, y: number, m: number) =>
                    x >= stage.box.x0 + m &&
                    x <= stage.box.x1 - m &&
                    y >= stage.box.y0 + m &&
                    y <= stage.box.y1 - m;
                // 40px further along the leg is still in the picture.
                const n = Math.hypot(on.x - at.x, on.y - at.y) || 1;
                return (
                    inside(at.x, at.y, m) &&
                    inside(
                        at.x + ((on.x - at.x) / n) * 40,
                        at.y + ((on.y - at.y) / n) * 40,
                        m / 2,
                    ) &&
                    Math.hypot(at.x - s.x, at.y - s.y) > 60
                );
            });
        const sweep = PLAN_SWEEPS.find(reads) ?? PLAN_SWEEPS[0];
        const end = onPlane(pplane, reach, aA + sweep * D2R);
        const leg = spiral(A, end);
        const path = Array.from({ length: 241 }, (_, k) => leg.at(k / 240));
        planned = { orbit: reach, plane: pplane, path, end };
    }

    const pose = (frame: Frame, stage: Stage): Pose => {
        const half = Math.max(1, Math.min(stage.halfW, stage.halfH));
        const s = sample(frame.p);
        const dChase = (s.f * stage.kpx) / half;
        const lens = { x: stage.lens.x / stage.W, y: stage.lens.y / stage.H };
        const fly = frame.segment.kind === "transfer" ? flyOf(frame.u) : 0;
        if (frame.segment.kind !== "plan")
            return {
                eye: orbitFrom(s.g, dChase, s.az, s.el),
                target: s.g,
                lens,
                overview: 0,
                fly,
            };

        // One crane: distance (in log), elevation, azimuth and lens move
        // together. The target leaves the ship's world for the Sun only as
        // fast as the frame widens, so the shot's subject grows from the
        // ship and its world to the whole system and always holds the
        // ship. Then the camera holds while the planned leg draws.
        const map = mapShot(stage);
        const e = smoother(frame.u / CRANE);
        const d = Math.exp(lerp(Math.log(dChase), Math.log(map.d), e));
        const k = map.d > dChase ? (d - dChase) / (map.d - dChase) : e;
        const target = mix(s.g, sun, k);
        return {
            eye: orbitFrom(
                target,
                d,
                lerp(s.az, overAz, e),
                lerp(s.el, OVER_EL, e),
            ),
            target,
            lens: {
                x: lerp(lens.x, map.lens.x, e),
                y: lerp(lens.y, map.lens.y, e),
            },
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
    const restAim = Math.atan2(-Math.sin(REST_ANGLE), Math.cos(REST_ANGLE));
    route.segments.forEach((seg, index) => {
        if (seg.kind !== "coast") return;
        const p = route.rest[seg.chapter];
        if (p === undefined || p < seg.p0 || p > seg.p1) return;
        const f = frameAt(route, p);
        if (f.index !== index) return;
        const shape = shiftShape(seg, f.u);
        if (shape < 0.05) return;
        const w = worlds[seg.chapter];
        const leg = legs[index];
        const s = leg.shot(f.u);
        const { fwd, right, up } = viewAxes({
            eye: add(s.target, outward(s.az, s.el)),
            target: s.target,
        });
        const centre = worldAt(w, f.t);
        // The first coast has no join before it, so its loop may start
        // anywhere; the others may run a little ahead or behind.
        const limit = seg.chapter === 0 ? Math.PI : PHASE_MAX;
        let best = 0;
        let bestScore = Infinity;
        for (let j = 0; j <= 120; j++) {
            const shift = ((j / 120) * 2 - 1) * limit;
            phaseShift[index] = shift / shape;
            const off = sub(leg.at(f.u), centre);
            const x = dot(off, right);
            const y = dot(off, up);
            const z = dot(off, fwd);
            let score = Math.abs(wrapPi(Math.atan2(y, x) - restAim));
            if (z > 0) score += 4;
            if (Math.hypot(x, y) < REST_CLEAR * w.radius) score += 4;
            if (w.kind === "saturn") {
                // Behind the ring: the sight line toward the camera
                // crosses the ring plane inside the ring.
                const n = w.pole;
                const denom = dot(fwd, n);
                if (Math.abs(denom) > 1e-6) {
                    const back = dot(off, n) / denom;
                    const r = Math.hypot(...sub(off, scale(fwd, back)));
                    if (
                        back > 0 &&
                        r > RING.inner * w.radius &&
                        r < RING.outer * w.radius
                    )
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

    // Worlds move to where their chapters ended as the map rises; the
    // first coast's loop moves with Earth (it has no transfer before it),
    // letting go over the departure so it joins the route unbent.
    const mapShare = (overview: number) => smoothstep(0.3, 0.8, overview);
    const mapAt = (w: World, t: number, overview: number) =>
        worldAt(w, lerp(t, chapters[w.chapter]?.end ?? t, mapShare(overview)));
    const opening = route.segments[0];
    const carry = (p: number, overview: number): Vec3 => {
        const m = mapShare(overview);
        if (m === 0 || opening?.kind !== "coast" || p >= opening.p1)
            return [0, 0, 0];
        const f = frameAt(route, p);
        const w = worlds[0];
        return scale(
            sub(mapAt(w, f.t, 1), worldAt(w, f.t)),
            m * (1 - smoothstep(0.86, 1, f.u)),
        );
    };

    // Each label takes the side of its world with the least drawn under
    // it at the map's pose: of eight directions from outward (away from
    // the Sun), at one gap or one and a half, the box covering the least
    // of the route and the marks (an orbit counts for less), inside the
    // stage, clear of the Sun and of the labels placed before it, the
    // current world's first.
    const mapSides = (
        stage: Stage,
        sizes: LabelSize[],
        open: LabelSize | null,
        safe: Box = labelSafe(stage),
    ): LabelSide[] => {
        const end = frameAt(route, 1);
        const view = pose(end, stage);
        const at = (q: Vec3) => screenOf(view, stage, q);
        const points: { x: number; y: number; k: number }[] = [];
        const n = 1200;
        trail(n).forEach((q, i) => {
            const c = carry((i / (n - 1)) * route.flown, 1);
            points.push({ ...at(add(q, c)), k: 1 });
        });
        for (const q of planned?.path ?? []) points.push({ ...at(q), k: 1 });
        for (const w of worlds)
            for (let j = 0; j < 240; j++)
                points.push({
                    ...at(onPlane(w.plane, w.orbit, (j / 240) * TAU)),
                    k: 0.15,
                });
        const places = worlds.map((w) => at(mapAt(w, end.t, 1)));
        for (const q of [...places, at(shipAt(1))])
            points.push({ ...q, k: 20 });
        const s = at(sun);
        const outward = (q: { x: number; y: number }) =>
            Math.atan2(q.y - s.y, q.x - s.x);
        const taken: Box[] = [];
        if (open && planned) {
            const q = at(planned.end);
            const a = outward(q);
            taken.push(
                labelBox(q, { x: Math.cos(a), y: Math.sin(a) }, 12, open),
            );
        }
        const order = worlds
            .map((_, i) => i)
            .sort((a, b) =>
                a === lastCurrent ? -1 : b === lastCurrent ? 1 : a - b,
            );
        const sides: LabelSide[] = [];
        for (const i of order) {
            const size = sizes[i];
            if (!size) continue;
            const q = places[i];
            const gap = labelGap(stage, worlds[i], q.depth, 1);
            const near = 1.5 * gap + size.w + size.h;
            const around = points.filter(
                (m) => Math.abs(m.x - q.x) < near && Math.abs(m.y - q.y) < near,
            );
            let best: LabelSide = { x: 1, y: 0, reach: 1 };
            let bestBox: Box | null = null;
            let bestScore = Infinity;
            let tried = 0;
            for (const reach of [1, 1.5])
                for (const step of [0, 1, -1, 2, -2, 3, -3, 4]) {
                    const a = outward(q) + (step * Math.PI) / 4;
                    const v = { x: Math.cos(a), y: Math.sin(a) };
                    const r = labelBox(q, v, gap * reach, size);
                    let score = 0.1 * tried++;
                    for (const m of around)
                        if (
                            m.x > r.x0 - 3 &&
                            m.x < r.x1 + 3 &&
                            m.y > r.y0 - 3 &&
                            m.y < r.y1 + 3
                        )
                            score += m.k;
                    if (!within(r, safe)) score += 100;
                    const dx = Math.max(r.x0 - s.x, 0, s.x - r.x1);
                    const dy = Math.max(r.y0 - s.y, 0, s.y - r.y1);
                    if (Math.hypot(dx, dy) < 24) score += 20;
                    for (const t of taken)
                        if (
                            r.x0 < t.x1 + 6 &&
                            r.x1 > t.x0 - 6 &&
                            r.y0 < t.y1 + 4 &&
                            r.y1 > t.y0 - 4
                        )
                            score += 50;
                    if (score < bestScore) {
                        bestScore = score;
                        best = { ...v, reach };
                        bestBox = r;
                    }
                }
            sides[i] = best;
            if (bestBox) taken.push(bestBox);
        }
        return sides;
    };

    const looped = worlds.map((w) =>
        route.segments.some(
            (s) => s.chapter === w.chapter && s.kind === "coast",
        ),
    );
    // The route flown near each world while its label shows: its arrival
    // (the second half of the transfer into it, and a loop's spiral in),
    // its loop up to the spiral out or its flyby, and for the last world
    // on through the plan to the crane. It stays drawn, so the world's
    // chase label keeps clear of it. Only the part near the world counts
    // (the world moves on along its orbit as the ship circles it), and of
    // that only what runs through the label's band across its side: the
    // route may pass above or below a label beside its world.
    const nearPath = worlds.map((w, i) => {
        const path: Vec3[] = [];
        route.segments.forEach((s, index) => {
            const next = route.segments[index + 1];
            const span: [number, number] | null =
                s.kind === "coast" && s.chapter === i
                    ? [0, 0.86]
                    : s.kind === "flyby" && s.chapter === i
                      ? [0, 1]
                      : s.kind === "plan" && Math.min(s.chapter, last) === i
                        ? [0, CRANE]
                        : s.kind === "transfer" && next?.chapter === i
                          ? [0.5, 1]
                          : null;
            if (!span) return;
            for (let k = 0; k <= 160; k++)
                path.push(
                    shipAt(lerp(s.p0, s.p1, lerp(span[0], span[1], k / 160))),
                );
        });
        return path;
    });
    const flownGap: FlightPlan["flownGap"] = (i, view, stage, c, v, size) => {
        const path = nearPath[i];
        const w = worlds[i];
        if (!path?.length || !w) return 0;
        const at = projector(view, stage);
        const o = at(c);
        const band = (Math.abs(v.y) * size.w + Math.abs(v.x) * size.h) / 2;
        const reach = Math.max(w.park, 2 * w.radius);
        let most = 0;
        for (const p of path) {
            const near = 1 - smoothstep(2.2, 2.8, dist(p, c) / reach);
            if (near <= 0) continue;
            const q = at(p);
            if (q.depth <= 0) continue;
            const dx = q.x - o.x;
            const dy = q.y - o.y;
            const across = Math.abs(dx * v.y - dy * v.x);
            const k = near * (1 - smoothstep(band + 6, band + 30, across));
            most = Math.max(most, k * (dx * v.x + dy * v.y + LOOP_CLEAR));
        }
        return most;
    };
    /** A world's label gap on the chase toward v: past its disc (and
     *  ring, and a loop's radius), and clear of the route flown near it. */
    const chaseGap = (
        i: number,
        view: Pose,
        stage: Stage,
        c: Vec3,
        depth: number,
        v: { x: number; y: number },
        size: LabelSize,
    ) =>
        Math.max(
            labelGap(stage, worlds[i], depth, looped[i] ? 1 : 0),
            flownGap(i, view, stage, c, v, size),
        );

    const chaseSides = (
        stage: Stage,
        sizes: LabelSize[],
        safe: Box,
        map?: LabelSide[],
    ): LabelSide[][] => {
        // A phone has no room beside its worlds: always below.
        if (!stage.wide)
            return route.segments.map(() =>
                worlds.map(() => ({ x: 0, y: 1, reach: 1 })),
            );
        const room = inset(safe, LABEL_FADE);
        /** World i on screen at these shares of a segment: its centre,
         *  the view, its orbit's direction there, and which side of it is
         *  away from the Sun. */
        const look = (index: number, shares: number[], i: number) => {
            const seg = route.segments[index];
            const w = worlds[i];
            return shares.map((share) => {
                const f = frameAt(route, lerp(seg.p0, seg.p1, share));
                const view = pose(f, stage);
                const c = worldAt(w, f.t);
                const q = screenOf(view, stage, c);
                const a = angleAt(w, f.t, epoch);
                const ahead = screenOf(
                    view,
                    stage,
                    onPlane(w.plane, w.orbit, a + 0.01),
                );
                const n = Math.hypot(ahead.x - q.x, ahead.y - q.y) || 1;
                return {
                    c,
                    q,
                    view,
                    orbit: { x: (ahead.x - q.x) / n, y: (ahead.y - q.y) / n },
                    on: q.depth > 0 && within(pointBox(q), safe),
                    away: dot(scale(c, -1), viewAxes(view).right) > 0 ? -1 : 1,
                };
            });
        };
        /** Of away from the Sun (level, then tilted 30° up and down),
         *  below, above and the Sun's side, the side on which the label
         *  fits in the most of these frames, clear of the route flown near
         *  its world and of its orbit; the first on a tie. `toward`: of
         *  those that fit best, the one nearest that side. */
        const choose = (
            i: number,
            frames: ReturnType<typeof look>,
            away: number,
            toward?: { x: number; y: number },
        ): LabelSide => {
            const size = sizes[i];
            if (!size) return { x: away, y: 0, reach: 1 };
            const beside = (x: number) => [
                { x, y: 0 },
                { x: x * TILT_COS, y: -TILT_SIN },
                { x: x * TILT_COS, y: TILT_SIN },
            ];
            const sides = [
                ...beside(away),
                { x: 0, y: 1 },
                { x: 0, y: -1 },
                ...beside(-away),
            ];
            if (toward) {
                const near = (v: { x: number; y: number }) =>
                    v.x * toward.x + v.y * toward.y;
                sides.unshift(toward);
                sides.sort((a, b) => near(b) - near(a));
            }
            /** Inside the room, and neither the leader along the orbit
             *  nor the orbit through the label. */
            const fitsAt = (
                o: ReturnType<typeof look>[number],
                v: { x: number; y: number },
            ) => {
                if (!o.on) return false;
                const { x: ox, y: oy } = o.orbit;
                if (Math.abs(ox * v.x + oy * v.y) >= ALONG_ORBIT) return false;
                const gap = chaseGap(i, o.view, stage, o.c, o.q.depth, v, size);
                const b = labelBox(o.q, v, gap, size);
                if (!within(b, room)) return false;
                const off = [b.x0, b.x1].flatMap((x) =>
                    [b.y0, b.y1].map(
                        (y) => ox * (y - o.q.y) - oy * (x - o.q.x),
                    ),
                );
                return Math.min(...off) > 6 || Math.max(...off) < -6;
            };
            let best = sides[0];
            let most = 0;
            for (const v of sides) {
                const fits = frames.filter((o) => fitsAt(o, v)).length;
                if (fits > most) {
                    most = fits;
                    best = v;
                }
            }
            return { x: best.x, y: best.y, reach: 1 };
        };
        // One side per world for the chase, judged over every frame its
        // label shows: its approach (flight-gl.ts names it from u 0.35),
        // its hold (the middle and quarters) and its departure while the
        // label fades (over the transfer's first quarter). So no label
        // changes side within its chapter.
        const own = worlds.map((_, i) => {
            const frames: ReturnType<typeof look> = [];
            let away = 0;
            route.segments.forEach((seg, index) => {
                if (seg.kind === "transfer" && seg.chapter === i)
                    frames.push(
                        ...look(index, [0.4, 0.5, 0.65, 0.8, 0.9, 0.97], i),
                    );
                else if (seg.kind === "transfer" && seg.from === i)
                    frames.push(...look(index, [0.05, 0.12, 0.2], i));
                else if (seg.kind !== "plan" && seg.chapter === i) {
                    const held = look(index, [0.5, 0.2, 0.8], i);
                    away = held[0].away;
                    frames.push(...held);
                }
            });
            return frames.length ? choose(i, frames, away || -1) : null;
        });
        // Into the map (judged at the plan's start, before the crane): the
        // map's side, or the nearest that fits, so it turns with the crane.
        return route.segments.map((seg, index) =>
            worlds.map((_, i) => {
                if (seg.kind === "plan") {
                    const frames = look(index, [0.02], i);
                    return choose(i, frames, frames[0].away, map?.[i]);
                }
                return own[i] ?? { x: -1, y: 0, reach: 1 };
            }),
        );
    };

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
        mapAt,
        carry,
        looped,
        mapSides,
        chaseSides,
        flownGap,
        spinAt: (w, p) => p * TAU * (1.1 + 0.25 * w.chapter) + w.chapter,
        pose,
        phaseAngle,
        trail,
    };
}
