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
 * scrubbing backwards retraces the same frames.
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
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
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
        const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
        const cross: Vec3 = [
            k[1] * v[2] - k[2] * v[1],
            k[2] * v[0] - k[0] * v[2],
            k[0] * v[1] - k[1] * v[0],
        ];
        return [
            v[0] * c + cross[0] * s + k[0] * kv * (1 - c),
            v[1] * c + cross[1] * s + k[1] * kv * (1 - c),
            v[2] * c + cross[2] * s + k[2] * kv * (1 - c),
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
/** Transfers widen the shot a little. */
const WIDEN = 1.0;
/** …and rise above the plane, so the orbits open into ellipses. */
const LIFT = 22 * D2R;

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

/* ---- legs ------------------------------------------------------------------ */

interface Leg {
    /** The ship at phase u. */
    at(u: number): Vec3;
    /** What the camera follows: the world on a coast, else the ship. */
    guide(u: number): Vec3;
    /** The way the camera faces (unit). */
    dir(u: number): Vec3;
    /** The radius the camera frames. */
    frame(u: number): number;
    /** The camera's pan about its heading, and its lift above it. */
    yaw(u: number): number;
    lift(u: number): number;
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
    /** Ship positions over [0, route.flown], n samples. */
    trail(n: number): Vec3[];
}

export interface Layout {
    /** Pixels per unit of tan(angle) from the lens centre. */
    kpx: number;
    /** Half the subject's box, pixels. */
    halfW: number;
    halfH: number;
}

export interface Pose {
    eye: Vec3;
    target: Vec3;
    /** 0 on the chase, 1 in the overview. */
    overview: number;
}

const CHASE_EL = 19 * D2R;
/** Behind the ship and a little to the Sun's side, so the worlds show
 *  more day than night; each coast pans across the world and each
 *  transfer pans back. */
const CHASE_YAW = -14 * D2R;
const SWING = 20 * D2R;
const AHEAD = 0.1;
const OVER_EL = 54 * D2R;
/** The overview turns so the ship sits on the near side, to the right. */
const OVER_AZ = 38 * D2R;
const SAMPLES = 1400;
const SIGMA = 0.011;

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

    // The legs, in route order; a transfer joins the legs either side.
    const last = chapters.length - 1;
    const legs: Leg[] = route.segments.map((seg) => {
        const w = worlds[Math.min(seg.chapter, last)];
        if (seg.kind === "coast" || seg.kind === "plan") {
            const plan = seg.kind === "plan";
            const first = seg.chapter === 0;
            const final = seg.chapter >= last;
            const gammaOf = (u: number) =>
                plan ? TAU * (w.loops + u) : TAU * w.loops * u;
            const edge = (u: number) => {
                if (plan) return 0;
                const inn = first ? 0 : 1 - smoothstep(0, 0.3, u);
                const out = final ? 0 : 1 - smoothstep(0, 0.3, 1 - u);
                return Math.max(inn, out);
            };
            // Insertion and departure: the loop spirals in from a wider
            // arc and out again, so the curvature changes gradually.
            const wide = (u: number) =>
                plan
                    ? 1
                    : 1 +
                      INSERT *
                          ((first ? 0 : 1 - smoothstep(0, 0.4, u)) +
                              (final ? 0 : smoothstep(0.6, 1, u)));
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
                    return add(
                        worldAt(w, t),
                        scale(loopAt(w, t, 0), wide(u) * edge(u)),
                    );
                },
                dir: (u) => tangentOn(w.plane, angleAt(w, tOf(seg, u), epoch)),
                // Wider while the guide is off the world, so it stays in.
                frame: (u) => w.frame + 0.8 * w.park * wide(u) * edge(u),
                yaw: (u) => (plan ? SWING : SWING * (2 * ease(u) - 1)),
                lift: () => 0,
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
            return {
                at: curve.at,
                guide: curve.at,
                dir: curve.dir,
                frame: () => w.frame,
                yaw: (u) => SWING * (2 * ease(u) - 1),
                lift: () => 0,
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
        legs[i] = {
            at: path.at,
            guide: path.at,
            dir: path.dir,
            frame: (u) =>
                lerp(f0, f1, ease(u)) *
                (1 + WIDEN * Math.sin(Math.PI * clamp01(u))),
            yaw: (u) => SWING * (1 - 2 * ease(u)),
            lift: (u) => LIFT * Math.sin(Math.PI * clamp01(u)),
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

    // The camera's guide track, sampled once and smoothed (a Gaussian in p).
    const K = SAMPLES;
    const G = new Float64Array(K * 3);
    const D = new Float64Array(K * 3);
    const F = new Float64Array(K);
    const Y = new Float64Array(K);
    const E = new Float64Array(K);
    for (let k = 0; k < K; k++) {
        const f = frameAt(route, k / (K - 1));
        const leg = legs[f.index];
        const g = leg.guide(f.u);
        const d = leg.dir(f.u);
        G.set(g, k * 3);
        D.set(d, k * 3);
        F[k] = leg.frame(f.u);
        Y[k] = leg.yaw(f.u);
        E[k] = leg.lift(f.u);
    }
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
    const Ys = blur(Y, 1);
    const Es = blur(E, 1);
    // The camera sits behind the heading: its azimuth, unwrapped.
    const AZ = new Float64Array(K);
    for (let k = 0; k < K; k++) {
        let a = Math.atan2(-Ds[k * 3 + 2], -Ds[k * 3]);
        if (k > 0) {
            while (a - AZ[k - 1] > Math.PI) a -= TAU;
            while (a - AZ[k - 1] < -Math.PI) a += TAU;
        }
        AZ[k] = a;
    }
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
            yaw: lerp(Ys[k], Ys[k + 1], f),
            lift: lerp(Es[k], Es[k + 1], f),
            az: lerp(AZ[k], AZ[k + 1], f),
        };
    };

    const orbitFrom = (target: Vec3, d: number, az: number, el: number) =>
        add(target, [
            d * Math.cos(el) * Math.cos(az),
            d * Math.sin(el),
            d * Math.cos(el) * Math.sin(az),
        ]);

    const planStart = planSeg ? sample(planSeg.p0) : null;
    const planShip = planSeg ? shipAt(planSeg.p0) : null;

    const pose = (frame: Frame, layout: Layout): Pose => {
        const half = Math.max(1, Math.min(layout.halfW, layout.halfH));
        const s = sample(frame.p);
        const dChase = (s.f * layout.kpx) / half;
        const target = add(s.g, scale(s.d, AHEAD * s.f));
        const azChase = s.az + CHASE_YAW + s.yaw;
        const elChase = CHASE_EL + s.lift;
        const eyeChase = orbitFrom(target, dChase, azChase, elChase);
        if (frame.segment.kind !== "plan" || !planStart || !planShip)
            return { eye: eyeChase, target, overview: 0 };

        // Crane up and out: target to the Sun, distance (in log) to the
        // whole system, elevation up, azimuth round to the ship's side.
        const e = smoother(frame.u / 0.78);
        const fit = reach * 1.1;
        const el = lerp(elChase, OVER_EL, e);
        const dOver =
            Math.max(
                (fit * layout.kpx) / Math.max(1, layout.halfW),
                (fit * Math.sin(OVER_EL) * layout.kpx) /
                    Math.max(1, layout.halfH),
            ) * 1.04;
        let azOver = Math.atan2(planShip[2], planShip[0]) + OVER_AZ;
        const az0 = planStart.az + CHASE_YAW + planStart.yaw;
        azOver += TAU * Math.round((az0 - azOver) / TAU);
        const d = Math.exp(lerp(Math.log(dChase), Math.log(dOver), e));
        const aim = mix(target, [0, 0, 0], smoother(frame.u / 0.62));
        return {
            eye: orbitFrom(aim, d, lerp(azChase, azOver, e), el),
            target: aim,
            overview: e,
        };
    };

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
        trail,
    };
}
