import { ShaderLib } from "three";
import "three/examples/jsm/lines/LineMaterial.js";
import { describe, expect, it } from "vitest";
import { patchLineShader } from "@/components/trajectory/flight-gl";
import { firstMaps, flightMaps } from "@/components/trajectory/flight-maps";
import { OPEN_LIMB } from "@/components/trajectory/flight-opening";
import {
    CRANE,
    FLIGHT_PACING,
    LOOP_CLEAR,
    OPEN_SPAN,
    RING,
    buildFlight,
    smoothstep,
    dist,
    drawingRatio,
    labelBox,
    labelGap,
    labelMinX,
    labelSafe,
    lineMask,
    mapNamesAll,
    ringReach,
    roomGap,
    screenOf,
    stageFrame,
    viewAxes,
    worldKinds,
    type Box,
    type LabelSide,
    type Pose,
    type Stage,
    type Vec3,
} from "@/components/trajectory/flight-route";
import { cvEntries } from "@/lib/cv";
import { FIXTURE_PROFILE as fixtureProfile } from "@/lib/fixtures";
import { buildRoute, frameAt, trajectoryData } from "@/lib/trajectory";

const data = trajectoryData(
    cvEntries(fixtureProfile.timeline).all,
    fixtureProfile.availability,
    "2026-09-29",
);
const route = buildRoute(data);
const flight = buildFlight(data, route);
const wide = stageFrame(1440, 828, true);
const phone = stageFrame(390, 780, false);
const STEPS = 4000;
const ps = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);

describe("the 3D flight", () => {
    it("gives Earth to the first chapter and Saturn to the last", () => {
        expect(worldKinds(4)).toEqual(["earth", "mars", "jupiter", "saturn"]);
        expect(flight.worlds.map((w) => w.kind)).toEqual(
            worldKinds(data.chapters.length),
        );
        // Orbits run outward in time order.
        const orbits = flight.worlds.map((w) => w.orbit);
        expect([...orbits].sort((a, b) => a - b)).toEqual(orbits);
        expect(flight.planned!.orbit).toBeGreaterThan(orbits.at(-1)!);
    });

    it("flies a continuous route that never enters a world", () => {
        const ships = ps.map((p) => flight.shipAt(p));
        const steps = ships.slice(1).map((s, i) => dist(s, ships[i]));
        // No jumps: every step is in line with the steps around it.
        for (let i = 2; i < steps.length - 2; i++)
            expect(steps[i]).toBeLessThan(
                3 * Math.max(steps[i - 2], steps[i + 2]) + 0.005,
            );
        ps.forEach((p, i) => {
            const t = frameAt(route, p).t;
            for (const w of flight.worlds) {
                const clear =
                    w.kind === "saturn" ? w.radius * 2.4 : w.radius * 1.6;
                expect(dist(ships[i], w.at)).toBeGreaterThan(clear);
            }
        });
    });

    it("keeps the camera smooth, outside every world and deterministic", () => {
        for (const layout of [wide, phone]) {
            let prev = flight.pose(frameAt(route, 0), layout);
            for (const p of ps) {
                const frame = frameAt(route, p);
                const pose = flight.pose(frame, layout);
                // Each step moves the eye by a small part of its distance.
                expect(dist(pose.eye, prev.eye)).toBeLessThan(
                    0.02 * dist(pose.eye, pose.target),
                );
                for (const w of flight.worlds)
                    expect(dist(pose.eye, w.at)).toBeGreaterThan(
                        w.radius * 1.5,
                    );
                prev = pose;
            }
            const f = frameAt(route, 0.4321);
            expect(flight.pose(f, layout)).toEqual(flight.pose(f, layout));
        }
    });

    it("starts the current leg on the transfer into the current chapter", () => {
        const current = data.chapters.findIndex((c) => c.current);
        const transfer = route.segments.find(
            (s) => s.kind === "transfer" && s.chapter === current,
        )!;
        expect(flight.current).toBe(current);
        expect(flight.currentFrom).toBe(transfer.p0);
    });
});

/* ---- the flight as paced on the page (FLIGHT_PACING) ------------------- */

const paced = buildRoute(data, FLIGHT_PACING.route);
const flown = buildFlight(data, paced);
/** The stage at 1440×900 (under a 72px header) and at 390×844. */
const stages: [string, Stage][] = [
    ["wide", stageFrame(1440, 828, true)],
    ["phone", stageFrame(390, 780, false)],
];
const D2R = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const turn = (a: Pose, b: Pose) => {
    const u = viewAxes(a).fwd;
    const v = viewAxes(b).fwd;
    const c = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    return Math.acos(Math.min(1, Math.max(-1, c))) / D2R;
};
const inBox = (stage: Stage, q: { x: number; y: number }) =>
    q.x >= stage.box.x0 &&
    q.x <= stage.box.x1 &&
    q.y >= stage.box.y0 &&
    q.y <= stage.box.y1;
const track = (stage: Stage) =>
    ps.map((p) => {
        const frame = frameAt(paced, p);
        return { p, frame, pose: flown.pose(frame, stage) };
    });

describe("the chase camera", () => {
    it("gives the opening, transfers and the finale the room their moves need", () => {
        const kinds = (kind: string) =>
            paced.segments.filter((s) => s.kind === kind).map((s) => s.w);
        expect(kinds("transfer").every((w) => w === 0.95)).toBe(true);
        expect(kinds("plan")).toEqual([1.8]);
        expect(100 + paced.weight * 52).toBeLessThanOrEqual(600);
        // The first card settles after the opening, on Earth's loop.
        const first = paced.segments[0];
        const rest = frameAt(paced, paced.rest[0]);
        expect(rest.index).toBe(0);
        expect(rest.u).toBeGreaterThan(OPEN_SPAN);
        expect(flown.pose(rest, stages[0][1]).open).toBe(0);
        expect(first.kind).toBe("coast");
    });

    it.each(stages)(
        "holds still while a chapter's card is read (%s)",
        (_, stage) => {
            const poses = track(stage);
            for (const seg of paced.segments) {
                if (seg.kind !== "coast") continue;
                // The first coast's hold begins once the opening is over.
                const from = seg === paced.segments[0] ? OPEN_SPAN : 0.14;
                const hold = poses.filter(
                    (x) =>
                        x.frame.segment === seg &&
                        x.frame.u >= from &&
                        x.frame.u <= 0.86,
                );
                expect(hold.length).toBeGreaterThan(50);
                const d = hold.map((x) => dist(x.pose.eye, x.pose.target));
                const median = [...d].sort((a, b) => a - b)[
                    Math.floor(d.length / 2)
                ];
                for (const v of d) {
                    expect(v / median).toBeGreaterThan(0.9);
                    expect(v / median).toBeLessThan(1.1);
                }
                let turned = 0;
                for (let k = 1; k < hold.length; k++)
                    turned += turn(hold[k].pose, hold[k - 1].pose);
                expect(turned).toBeLessThanOrEqual(25);
            }
        },
    );

    it.each(stages)(
        "turns between chapters without a whip, and never rolls (%s)",
        (_, stage) => {
            const poses = track(stage);
            const steps = poses
                .slice(1)
                .map((x, i) => turn(x.pose, poses[i].pose));
            // The holds are still, so the moves between them do the
            // turning: at most 0.5° per 1/4000 of progress outside the
            // opening's rise and the finale's crane.
            steps.forEach((step, i) => {
                const { pose, frame } = poses[i + 1];
                if (frame.segment.kind !== "plan" && pose.open === 0)
                    expect(step).toBeLessThanOrEqual(0.5);
            });
            // Never more than 120° in any 0.05 of progress.
            const window = STEPS / 20;
            let sum = steps.slice(0, window).reduce((a, b) => a + b, 0);
            for (let i = window; i < steps.length; i++) {
                expect(sum).toBeLessThanOrEqual(120);
                sum += steps[i] - steps[i - window];
            }
            // World-up stays up: the view's right is level, its up is up.
            for (const { pose } of poses) {
                const { right, up } = viewAxes(pose);
                expect(Math.abs(right[1])).toBeLessThan(1e-9);
                expect(up[1]).toBeGreaterThan(0);
            }
        },
    );

    it.each(stages)(
        "frames the world left behind and the one ahead at each transfer's midpoint (%s)",
        (name, stage) => {
            for (const seg of paced.segments) {
                if (seg.kind !== "transfer") continue;
                const frame = frameAt(paced, (seg.p0 + seg.p1) / 2);
                const pose = flown.pose(frame, stage);
                expect(pose.fly).toBeCloseTo(1, 3);
                const at = (i: number) =>
                    screenOf(pose, stage, flown.worlds[i].at);
                const from = at(seg.from!);
                const to = at(seg.chapter);
                expect(inBox(stage, from)).toBe(true);
                expect(inBox(stage, to)).toBe(true);
                if (name === "wide") expect(from.x).toBeLessThan(to.x);
                // The card hands over on the wide shot.
                const mid = (seg.p0 + seg.p1) / 2;
                expect(frameAt(paced, mid - 1e-6).card).toBe(seg.from);
                expect(frameAt(paced, mid + 1e-6).card).toBe(seg.chapter);
            }
        },
    );

    it.each(stages)(
        "lights every rest gibbous, with the ship in view beside its world (%s)",
        (_, stage) => {
            paced.segments.forEach((seg) => {
                if (seg.kind !== "coast") return;
                const p = paced.rest[seg.chapter];
                const frame = frameAt(paced, p);
                const pose = flown.pose(frame, stage);
                const w = flown.worlds[seg.chapter];
                const phase = flown.phaseAngle(pose, w);
                expect(phase).toBeGreaterThanOrEqual(45);
                expect(phase).toBeLessThanOrEqual(63);
                const centre = w.at;
                const ship3 = flown.shipAt(p);
                const c = screenOf(pose, stage, centre);
                const s = screenOf(pose, stage, ship3);
                const R = (w.radius * stage.kpx) / c.depth;
                expect(inBox(stage, s)).toBe(true);
                expect(Math.hypot(s.x - c.x, s.y - c.y)).toBeGreaterThan(
                    1.4 * R,
                );
                // Unoccluded: nearer than the world's centre, and not
                // behind Saturn's ring on the sight line.
                expect(s.depth).toBeLessThan(c.depth);
                if (w.kind === "saturn") {
                    const n = w.pole;
                    const back = [0, 1, 2].map(
                        (k) => pose.eye[k] - ship3[k],
                    ) as Vec3;
                    const along =
                        -(
                            (ship3[0] - centre[0]) * n[0] +
                            (ship3[1] - centre[1]) * n[1] +
                            (ship3[2] - centre[2]) * n[2]
                        ) /
                        (back[0] * n[0] + back[1] * n[1] + back[2] * n[2]);
                    if (along > 0 && along < 1) {
                        const hit = [0, 1, 2].map(
                            (k) => ship3[k] + back[k] * along - centre[k],
                        ) as Vec3;
                        const r = Math.hypot(...hit) / w.radius;
                        expect(r < RING.inner || r > RING.outer).toBe(true);
                    }
                }
            });
        },
    );

    it.each(stages)(
        "keeps the Sun out of frame from the opening until the finale (%s)",
        (_, stage) => {
            for (const { frame, pose } of track(stage)) {
                if (frame.segment.kind === "plan" || pose.open > 0) continue;
                const { fwd } = viewAxes(pose);
                const toSun = pose.eye.map((v) => -v) as Vec3;
                const cos =
                    (fwd[0] * toSun[0] +
                        fwd[1] * toSun[1] +
                        fwd[2] * toSun[2]) /
                    Math.hypot(...toSun);
                expect(Math.acos(cos) / D2R).toBeGreaterThan(45);
            }
        },
    );

    it("pushes in on the flyby's world as the ship skims its limb", () => {
        const stage = stageFrame(1440, 828, true);
        const seg = paced.segments.find((s) => s.kind === "flyby")!;
        const w = flown.worlds[seg.chapter];
        // Around closest approach the world is large and a bright
        // gibbous, and the ship passes within a quarter radius of its limb.
        let closest = Infinity;
        for (let u = 0.4; u <= 0.6; u += 0.005) {
            const frame = frameAt(paced, lerp(seg.p0, seg.p1, u));
            const pose = flown.pose(frame, stage);
            const c = screenOf(pose, stage, w.at);
            const s = screenOf(pose, stage, flown.shipAt(frame.p));
            const R = (w.radius * stage.kpx) / c.depth;
            expect(R).toBeGreaterThan(95);
            expect(flown.phaseAngle(pose, w)).toBeLessThan(63);
            const off = Math.abs(Math.hypot(s.x - c.x, s.y - c.y) - R) / R;
            closest = Math.min(closest, off);
        }
        expect(closest).toBeLessThan(0.25);
    });

    it("uses one projection for the lens and the tests", () => {
        const stage = stageFrame(1440, 828, true);
        const frame = frameAt(paced, 0.5);
        const pose = flown.pose(frame, stage);
        // The target lands on the lens: the stage's on the chase, the
        // map's (further right on a wide stage) in the finale.
        const t = screenOf(pose, stage, pose.target);
        expect(t.x).toBeCloseTo(stage.lens.x, 6);
        expect(t.y).toBeCloseTo(stage.lens.y, 6);
        const end = flown.pose(frameAt(paced, 1), stage);
        const m = screenOf(end, stage, end.target);
        expect(m.x).toBeCloseTo(1440 * 0.7, 6);
        expect(m.y).toBeCloseTo(828 * 0.5, 6);
        expect(stage.box.x0).toBeCloseTo(1440 * 0.46);
        expect(stageFrame(390, 780, false).box.y1).toBeCloseTo(780 * 0.55);
    });

    it("rests each chapter's ship below and right of its world", () => {
        for (const [, stage] of stages)
            paced.segments.forEach((seg) => {
                if (seg.kind !== "coast") return;
                const p = paced.rest[seg.chapter];
                const frame = frameAt(paced, p);
                const pose = flown.pose(frame, stage);
                const w = flown.worlds[seg.chapter];
                const c = screenOf(pose, stage, w.at);
                const s = screenOf(pose, stage, flown.shipAt(p));
                // The rest aim is 35° below the horizontal, on the right.
                const angle = Math.atan2(c.y - s.y, s.x - c.x) / D2R;
                expect(Math.abs(angle + 35)).toBeLessThan(20);
            });
    });
});

/* ---- the sunrise, Saturn's ring, the Moon and the belt -------------------- */

const unitOf = (v: Vec3): Vec3 => {
    const n = Math.hypot(...v) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
};
const dotOf = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const minus = (a: Vec3, b: Vec3): Vec3 => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];
const crossOf = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

describe("the opening", () => {
    const first = paced.segments[0];

    it.each(stages)(
        "opens on the Sun just under Earth's limb, across the subject's box (%s)",
        (name, stage) => {
            const frame = frameAt(paced, 0);
            const pose = flown.pose(frame, stage);
            expect(pose.open).toBe(1);
            // Where the home page's sunrise has it on a wide stage.
            const sun = screenOf(pose, stage, [0, 0, 0]);
            if (name === "wide") {
                expect(sun.x / stage.W).toBeCloseTo(0.69, 3);
                expect(sun.y / stage.H).toBeCloseTo(0.34, 3);
            }
            // The Sun's centre is under 1° behind the limb as the eye sees
            // it, so only its corona shows, and the eye is above the air.
            const w = flown.worlds[0];
            const E = w.at;
            const d = dist(pose.eye, E);
            const apart = Math.acos(
                dotOf(
                    unitOf(minus(E, pose.eye)),
                    unitOf(minus([0, 0, 0], pose.eye)),
                ),
            );
            const radius = Math.asin(w.radius / d);
            expect(radius - apart).toBeGreaterThan(0);
            expect(radius - apart).toBeLessThan(1 * D2R);
            expect(d).toBeGreaterThan(1.5 * w.radius);
            // The limb crosses the subject's box from side to side.
            const n = unitOf(minus(pose.eye, E));
            const centre = add(
                E,
                n.map((v) => v * (w.radius ** 2 / d)) as Vec3,
            );
            const r = w.radius * Math.sqrt(1 - (w.radius / d) ** 2);
            const e1 = unitOf([n[2], 0, -n[0]]);
            const e2: Vec3 = [
                n[1] * e1[2] - n[2] * e1[1],
                n[2] * e1[0] - n[0] * e1[2],
                n[0] * e1[1] - n[1] * e1[0],
            ];
            const xs = Array.from({ length: 720 }, (_, k) => {
                const a = (k / 720) * 2 * Math.PI;
                return screenOf(
                    pose,
                    stage,
                    add(
                        centre,
                        [0, 1, 2].map(
                            (j) =>
                                (e1[j] * Math.cos(a) + e2[j] * Math.sin(a)) * r,
                        ) as Vec3,
                    ),
                );
            })
                .filter((q) => q.depth > 0 && inBox(stage, q))
                .map((q) => q.x);
            const box = stage.box.x1 - stage.box.x0;
            expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(
                0.9 * box,
            );
        },
    );

    it("rises into the chase over a few hundred pixels of scroll", () => {
        // At 1440×900 the stage is 828px under the header, and the section
        // 100 + weight × 52 svh tall.
        const scroll = ((100 + paced.weight * 52) / 100) * 900 - 828;
        const rise = OPEN_SPAN * (first.p1 - first.p0) * scroll;
        expect(rise).toBeGreaterThanOrEqual(330);
        const end = frameAt(
            paced,
            first.p0 + OPEN_SPAN * (first.p1 - first.p0),
        );
        expect(flown.pose(end, stages[0][1]).open).toBe(0);
    });
});

describe("Saturn's ring", () => {
    it.each(stages)(
        "opens its lit face to the camera at 25–32° through Saturn's hold (%s)",
        (_, stage) => {
            const seg = paced.segments.find(
                (s) =>
                    s.kind === "coast" && s.chapter === flown.worlds.length - 1,
            )!;
            const w = flown.worlds[seg.chapter];
            expect(w.kind).toBe("saturn");
            for (let u = 0.1; u <= 1; u += 0.01) {
                const frame = frameAt(paced, lerp(seg.p0, seg.p1, u));
                const pose = flown.pose(frame, stage);
                const c = w.at;
                const nV = dotOf(w.pole, unitOf(minus(pose.eye, c)));
                const nL = dotOf(w.pole, unitOf(minus([0, 0, 0], c)));
                expect(nL).toBeGreaterThan(0);
                expect(nV).toBeGreaterThan(0);
                const opening = Math.asin(nV) / D2R;
                expect(opening).toBeGreaterThanOrEqual(25);
                expect(opening).toBeLessThanOrEqual(32);
            }
        },
    );
});

describe("the poster", () => {
    it.each([
        ["wide", stageFrame(1440, 828, true), 4] as const,
        ["narrow", stageFrame(390, 788, false), 1.5] as const,
    ])(
        "draws the limb where the opening shows it (%s)",
        (at, stage, within) => {
            // The limb: the circle where the view grazes Earth, projected
            // over the part of the stage the scene shows.
            const frame = frameAt(paced, 0);
            const pose = flown.pose(frame, stage);
            const w = flown.worlds[0];
            const c = w.at;
            const d = c.map((v, k) => v - pose.eye[k]) as Vec3;
            const L = Math.hypot(...d);
            const u = d.map((v) => v / L) as Vec3;
            const e1 = [u[2], 0, -u[0]].map(
                (v) => v / Math.hypot(u[2], u[0]),
            ) as Vec3;
            const e2: Vec3 = [
                u[1] * e1[2] - u[2] * e1[1],
                u[2] * e1[0] - u[0] * e1[2],
                u[0] * e1[1] - u[1] * e1[0],
            ];
            const back = (w.radius * w.radius) / L;
            const r = w.radius * Math.sqrt(1 - (w.radius / L) ** 2);
            const { cx, cy, r: limb } = OPEN_LIMB[at];
            const k = stage.H / 1000;
            const lx = pose.lens.x * stage.W;
            const ly = pose.lens.y * stage.H;
            let seen = 0;
            for (let i = 0; i < 720; i++) {
                const a = (i / 720) * 2 * Math.PI;
                const q = [0, 1, 2].map(
                    (j) =>
                        c[j] -
                        u[j] * back +
                        r * (Math.cos(a) * e1[j] + Math.sin(a) * e2[j]),
                ) as Vec3;
                const s = screenOf(pose, stage, q);
                const x0 = stage.wide ? 0.4 * stage.W : 0;
                if (s.depth <= 0 || s.x < x0 || s.x > stage.W) continue;
                if (s.y < 0 || s.y > stage.H) continue;
                seen++;
                const off = Math.hypot(s.x - lx - cx * k, s.y - ly - cy * k);
                expect(Math.abs(off - limb * k)).toBeLessThan(within);
            }
            expect(seen).toBeGreaterThan(20);
        },
    );
});

describe("the Moon and the belt", () => {
    it("keeps the Moon clear of Earth and the route, in the sunrise and at Earth's rest", () => {
        const moon = flown.moon!;
        const w = flown.worlds[0];
        const upto = paced.segments[1].p1;
        for (let p = 0; p <= upto; p += 0.0005) {
            const t = frameAt(paced, p).t;
            const m = moon.at(t);
            expect(dist(m, w.at)).toBeGreaterThan(3 * w.radius);
            expect(dist(m, flown.shipAt(p))).toBeGreaterThan(4 * moon.radius);
        }
        const stage = stages[0][1];
        for (const p of [0, paced.rest[0]]) {
            const frame = frameAt(paced, p);
            const pose = flown.pose(frame, stage);
            const q = screenOf(pose, stage, moon.at(frame.t));
            expect(q.depth).toBeGreaterThan(0);
            expect(inBox(stage, q)).toBe(true);
            // In front of the sky, not behind Earth's disc.
            const e = screenOf(pose, stage, w.at);
            const R = (w.radius * stage.kpx) / e.depth;
            expect(Math.hypot(q.x - e.x, q.y - e.y)).toBeGreaterThan(R);
        }
    });

    it("lays the belt between Mars's and Jupiter's orbits, across a transfer", () => {
        const belt = flown.belt!;
        const mars = flown.worlds.find((w) => w.kind === "mars")!;
        const jupiter = flown.worlds.find((w) => w.kind === "jupiter")!;
        expect(belt.mid - belt.half).toBeGreaterThan(mars.orbit);
        expect(belt.mid + belt.half).toBeLessThan(jupiter.orbit);
        const into = paced.segments.find(
            (s) => s.kind === "transfer" && s.chapter === jupiter.chapter,
        )!;
        const r = (p: number) =>
            Math.hypot(flown.shipAt(p)[0], flown.shipAt(p)[2]);
        expect(r(into.p0)).toBeLessThan(belt.mid - belt.half);
        expect(r(into.p1)).toBeGreaterThan(belt.mid + belt.half);
    });
});

/* ---- the finale: one crane, then the map holds --------------------------- */

describe("the finale", () => {
    const plan = paced.segments.find((s) => s.kind === "plan")!;
    const azimuth = (pose: Pose) =>
        Math.atan2(pose.eye[2] - pose.target[2], pose.eye[0] - pose.target[0]);
    const margin = (stage: Stage, q: { x: number; y: number }) =>
        Math.min(
            q.x - stage.box.x0,
            stage.box.x1 - q.x,
            q.y - stage.box.y0,
            stage.box.y1 - q.y,
        );

    it.each(stages)(
        "keeps the ship (and then its now mark) in the box, then holds still (%s)",
        (_, stage) => {
            let held: Pose | null = null;
            for (let i = 1; i <= STEPS; i++) {
                const p = lerp(plan.p0, 1, i / STEPS);
                const frame = frameAt(paced, p);
                expect(frame.segment).toBe(plan);
                const pose = flown.pose(frame, stage);
                // The now mark is drawn where the ship is.
                const ship = screenOf(pose, stage, flown.shipAt(p));
                expect(ship.depth).toBeGreaterThan(0);
                expect(margin(stage, ship)).toBeGreaterThanOrEqual(0);
                if (frame.u < CRANE) continue;
                held ??= pose;
                expect(pose.eye).toEqual(held.eye);
                expect(pose.target).toEqual(held.target);
                expect(pose.overview).toBe(1);
            }
            // A rise and pull-back, not a swing round the system.
            const start = flown.pose(frameAt(paced, plan.p0), stage);
            const turned = Math.abs(
                Math.atan2(
                    Math.sin(azimuth(held!) - azimuth(start)),
                    Math.cos(azimuth(held!) - azimuth(start)),
                ),
            );
            expect(turned / D2R).toBeLessThanOrEqual(30);
        },
    );

    it.each(stages)(
        "composes the map inside the box, clear of the record (%s)",
        (name, stage) => {
            const frame = frameAt(paced, 1);
            const pose = flown.pose(frame, stage);
            const need = name === "wide" ? 80 : 24;
            const marks = [
                ...flown.worlds.map((w) => w.at),
                flown.shipAt(1),
                flown.planned!.end,
            ];
            for (const q of marks) {
                const s = screenOf(pose, stage, q);
                expect(margin(stage, s)).toBeGreaterThanOrEqual(need);
                if (name === "wide")
                    expect(s.x).toBeGreaterThan(stage.W * 0.46);
                else expect(s.y).toBeLessThan(stage.H * 0.55);
            }
            // The map spans the phone's width.
            if (name === "phone") {
                const xs = Array.from({ length: 180 }, (_, k) => {
                    const a = (k / 180) * 2 * Math.PI;
                    const { ex, ez } = flown.planned!.plane;
                    const r = flown.planned!.orbit;
                    const v = [0, 1, 2].map(
                        (j) => (ex[j] * Math.cos(a) + ez[j] * Math.sin(a)) * r,
                    ) as Vec3;
                    return screenOf(pose, stage, v).x;
                });
                expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
                    0.85 * stage.W,
                );
            }
        },
    );

    it("rings each coast world where the track touches it", () => {
        const line = [...flown.track.points, ...flown.planned!.path];
        const eps = 1e-7;
        const heading = (p: number, q: number) =>
            unitOf(minus(flown.shipAt(q), flown.shipAt(p)));
        flown.worlds.forEach((w, i) => {
            const near = Math.min(...line.map((q) => dist(q, w.at)));
            const ring = flown.rings[i];
            expect(flown.looped[i]).toBe(!!ring);
            if (!ring) {
                // A flyby passes close by.
                expect(near).toBeGreaterThan(1.6 * w.radius);
                expect(near).toBeLessThan(1.5 * w.park);
                return;
            }
            // A circle of the parking radius round the world, which the
            // track touches from outside: the ship joins it and leaves it
            // along the track.
            for (const q of ring.points)
                expect(Math.abs(dist(q, w.at) - w.park)).toBeLessThan(1e-9);
            expect(Math.abs(near - w.park)).toBeLessThan(1e-3);
            const coast = paced.segments.find(
                (s) => s.kind === "coast" && s.chapter === i,
            )!;
            for (const p of [coast.p0, coast.p1]) {
                if (p === 0) continue;
                expect(dist(flown.shipAt(p), w.at)).toBeCloseTo(w.park, 6);
                const turn = Math.acos(
                    Math.min(
                        1,
                        dotOf(
                            heading(p - 2 * eps, p - eps),
                            heading(p + eps, p + 2 * eps),
                        ),
                    ),
                );
                expect(turn / D2R).toBeLessThan(0.05);
            }
            // No line runs through a ring's disc.
            const n = unitOf(
                crossOf(
                    minus(ring.points[0], w.at),
                    minus(ring.points[48], w.at),
                ),
            );
            for (const q of line) {
                const off = minus(q, w.at);
                const up = dotOf(off, n);
                const flat = Math.hypot(
                    ...minus(off, n.map((v) => v * up) as Vec3),
                );
                expect(Math.abs(up) < 0.2 && flat < 0.98 * w.park).toBe(false);
            }
        });
    });

    it.each([
        ["1440", stageFrame(1440, 828, true)],
        ["1280", stageFrame(1280, 648, true)],
        ["1920", stageFrame(1920, 1008, true)],
        ["1024", stageFrame(1024, 680, true)],
        // The record's 27rem column ends at 480 below 1280.
        ["1024 (column 480)", stageFrame(1024, 696, true, 480)],
        ["960 (column 480)", stageFrame(960, 628, true, 480)],
        ["390", stageFrame(390, 780, false)],
        ["360", stageFrame(360, 676, false)],
    ] as [string, Stage][])(
        "keeps the map's labels off the route, the Sun and each other (%s)",
        (_, stage) => {
            // The labels as the page sets them: a name over its dates.
            const sizes = [
                { w: 63, h: 31 },
                { w: 133, h: 31 },
                { w: 133, h: 31 },
                { w: 126, h: 31 },
            ];
            const open = { w: 75, h: 14 };
            const sides = flown.mapSides(
                stage,
                sizes,
                stage.wide ? open : null,
            );
            const frame = frameAt(paced, 1);
            const pose = flown.pose(frame, stage);
            const at = (q: Vec3) => screenOf(pose, stage, q);
            const route = [
                ...flown.track.points,
                ...flown.rings.flatMap((r) => r?.points ?? []),
                ...flown.planned!.path,
            ].map(at);
            const sun = at([0, 0, 0]);
            // The map names every world where it has the room; a phone,
            // or a narrow window, names none.
            const shown = mapNamesAll(stage) ? [0, 1, 2, 3] : [];
            const boxes = shown.map((i) => {
                const w = flown.worlds[i];
                const q = at(w.at);
                const side = sides[i];
                const gap = labelGap(stage, w, q.depth, 1) * side.reach;
                return labelBox(q, side, gap, sizes[i]);
            });
            boxes.forEach((r, n) => {
                const under = route.filter(
                    (m) => m.x > r.x0 && m.x < r.x1 && m.y > r.y0 && m.y < r.y1,
                );
                expect(under).toEqual([]);
                expect(r.x0).toBeGreaterThanOrEqual(labelMinX(stage));
                expect(r.x1).toBeLessThanOrEqual(stage.W - 12);
                expect(r.y0).toBeGreaterThanOrEqual(8);
                expect(r.y1).toBeLessThanOrEqual(
                    stage.wide ? stage.H - 48 : stage.box.y1,
                );
                const dx = Math.max(r.x0 - sun.x, 0, sun.x - r.x1);
                const dy = Math.max(r.y0 - sun.y, 0, sun.y - r.y1);
                expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(24);
                for (const o of boxes.slice(n + 1))
                    expect(
                        r.x1 < o.x0 ||
                            o.x1 < r.x0 ||
                            r.y1 < o.y0 ||
                            o.y1 < r.y0,
                    ).toBe(true);
            });
        },
    );

    it("opens on Earth's ring and leaves it along the track", () => {
        const first = paced.segments[0];
        const w = flown.worlds[0];
        const ring = flown.rings[0]!;
        // The ship circles Earth at the parking radius, at least once,
        // drawing its ring from where it starts; the ring is whole before
        // it leaves.
        let turned = 0;
        let prev: Vec3 | null = null;
        for (let i = 0; i <= 800; i++) {
            const p = lerp(first.p0, first.p1, i / 800);
            const off = minus(flown.shipAt(p), w.at);
            expect(Math.hypot(...off) / w.park).toBeCloseTo(1, 9);
            expect(flown.ringOf(p)).toBe(0);
            if (prev)
                turned += Math.acos(
                    Math.min(1, dotOf(unitOf(prev), unitOf(off))),
                );
            prev = off;
        }
        expect(turned / D2R).toBeGreaterThanOrEqual(360);
        expect(flown.ringOf(first.p1 + 1e-6)).toBe(-1);
        expect(ring.ps[0]).toBe(first.p0);
        expect(dist(ring.points[0], flown.shipAt(0))).toBeLessThan(1e-9);
        expect(ring.ps.at(-1)!).toBeLessThanOrEqual(first.p1);
        // The track starts where the ship leaves the ring, along it.
        expect(flown.track.ps[0]).toBe(first.p1);
        expect(
            dist(flown.track.points[0], flown.shipAt(first.p1)),
        ).toBeLessThan(1e-9);
        const into = unitOf(
            minus(flown.shipAt(first.p1), flown.shipAt(first.p1 - 1e-6)),
        );
        const out = unitOf(minus(flown.track.points[1], flown.track.points[0]));
        expect(Math.acos(Math.min(1, dotOf(into, out))) / D2R).toBeLessThan(1);
    });
});

/* ---- the track: one smooth line --------------------------------------- */

type Px = { x: number; y: number };
/** A drawn line's visible runs on the stage: in front of the camera and
 *  over the scene (right of the record on a wide stage). */
const visibleRuns = (points: Vec3[], pose: Pose, stage: Stage) => {
    const runs: Px[][] = [];
    let run: Px[] = [];
    for (const q of points) {
        const s = screenOf(pose, stage, q);
        const seen =
            s.depth > 0.05 &&
            s.x >= stage.record &&
            s.x <= stage.W &&
            s.y >= 0 &&
            s.y <= stage.H;
        if (seen) run.push(s);
        else {
            if (run.length > 1) runs.push(run);
            run = [];
        }
    }
    if (run.length > 1) runs.push(run);
    return runs;
};
/** Where segments ab and cd cross (null where they don't). */
const crossing = (a: Px, b: Px, c: Px, d: Px): Px | null => {
    const side = (p: Px, q: Px, r: Px) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = side(c, d, a);
    const d2 = side(c, d, b);
    if (d1 * d2 >= 0 || side(a, b, c) * side(a, b, d) >= 0) return null;
    const t = d1 / (d1 - d2);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
};
/** Where the runs cross themselves (non-adjacent segments). */
const selfCrossings = (runs: Px[][]) => {
    const segs = runs.flatMap((run, r) =>
        run.slice(1).map((b, i) => ({ a: run[i], b, r, i })),
    );
    const out: Px[] = [];
    for (let m = 0; m < segs.length; m++)
        for (let n = m + 1; n < segs.length; n++) {
            const s = segs[m];
            const t = segs[n];
            if (s.r === t.r && t.i - s.i < 2) continue;
            const at = crossing(s.a, s.b, t.a, t.b);
            if (at) out.push(at);
        }
    return out;
};
/** A run's bends, resampled at 1px: its tightest radius, and how often
 *  its turn changes side where both sides turn tighter than 150px. */
const bendsOf = (run: Px[]) => {
    const even: Px[] = [run[0]];
    let carry = 0;
    for (let i = 0; i + 1 < run.length; i++) {
        const a = run[i];
        const b = run[i + 1];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        let s = 1 - carry;
        for (; s <= d; s += 1)
            even.push({
                x: a.x + ((b.x - a.x) * s) / d,
                y: a.y + ((b.y - a.y) * s) / d,
            });
        carry = d - (s - 1);
    }
    let tightest = Infinity;
    let flips = 0;
    let sign = 0;
    for (let k = 3; k + 3 < even.length; k++) {
        const a = even[k - 3];
        const b = even[k];
        const c = even[k + 3];
        const k1 = ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) / 27;
        if (Math.abs(k1) > 1e-9)
            tightest = Math.min(tightest, 1 / Math.abs(k1));
        if (Math.abs(k1) < 1 / 150) continue;
        if (sign && Math.sign(k1) !== sign) flips++;
        sign = Math.sign(k1);
    }
    return { tightest, flips };
};

describe("the track", () => {
    /** The track the ship flies, densely: its legs on the track, in order
     *  (each coast leaves and rejoins it at the same touch point). */
    const curve: Vec3[] = [];
    for (const s of paced.segments) {
        if (s.kind !== "transfer" && s.kind !== "flyby") continue;
        for (let k = curve.length ? 1 : 0; k <= 4000; k++)
            curve.push(flown.shipAt(lerp(s.p0, s.p1, k / 4000)));
    }

    it("flies one smooth track, curving toward the Sun all the way", () => {
        let tightest = Infinity;
        let prev: number | null = null;
        for (let i = 1; i + 1 < curve.length; i++) {
            const a = minus(curve[i], curve[i - 1]);
            const b = minus(curve[i + 1], curve[i]);
            const la = Math.hypot(...a);
            const lb = Math.hypot(...b);
            // No kink: consecutive chords (about 0.01u) turn by a hair.
            const turn = Math.acos(Math.min(1, dotOf(a, b) / (la * lb)));
            expect(turn / D2R).toBeLessThan(0.5);
            // The curvature (Menger's, for uneven steps): toward the Sun
            // in the ecliptic everywhere, never tighter than 10u, and
            // changing smoothly (a C2 curve has no joins to break it).
            const k = unitOf(minus(unitOf(b), unitOf(a))).map(
                (v) => (v * 2 * Math.sin(turn / 2)) / ((la + lb) / 2),
            ) as Vec3;
            const q = curve[i];
            const r = Math.hypot(q[0], q[2]);
            if (turn > 0) {
                expect(dotOf(k, [-q[0] / r, 0, -q[2] / r]) * r).toBeGreaterThan(
                    0,
                );
                tightest = Math.min(tightest, 1 / Math.hypot(...k));
            }
            const size = turn > 0 ? Math.hypot(...k) : 0;
            if (prev !== null) expect(Math.abs(size - prev)).toBeLessThan(0.01);
            prev = size;
        }
        expect(tightest).toBeGreaterThanOrEqual(10);
        // The dashed plan goes on along the same curve.
        const plan = flown.planned!.path;
        const last = unitOf(minus(curve.at(-1)!, curve.at(-2)!));
        const next = unitOf(minus(plan[1], plan[0]));
        expect(dist(plan[0], curve.at(-1)!)).toBeLessThan(1e-9);
        expect(Math.acos(Math.min(1, dotOf(last, next))) / D2R).toBeLessThan(1);
    });

    it("moves the ship smoothly, without a jump in speed or heading", () => {
        const n = 8000;
        const ships = Array.from({ length: n + 1 }, (_, k) =>
            flown.shipAt(k / n),
        );
        const steps = ships.slice(1).map((q, k) => dist(q, ships[k]));
        for (let k = 1; k < steps.length; k++) {
            const ratio = steps[k] / steps[k - 1];
            expect(ratio).toBeGreaterThan(1 / 1.05);
            expect(ratio).toBeLessThan(1.05);
        }
        // The heading as flight-gl.ts takes it turns at most 4° per
        // 0.001 of progress (about 5px of scroll).
        const heading = (p: number) =>
            unitOf(
                minus(
                    flown.shipAt(Math.min(1, p + 0.0006)),
                    flown.shipAt(Math.max(0, p - 0.0006)),
                ),
            );
        for (let p = 0.0006; p + 0.001 < 1 - 0.0006; p += 0.0005) {
            const c = dotOf(heading(p), heading(p + 0.001));
            expect(Math.acos(Math.min(1, c)) / D2R).toBeLessThanOrEqual(4);
        }
    });

    it("draws a clean line on the map and the chase", () => {
        const [wideStage, phoneStage] = [stages[0][1], stages[1][1]];
        const plan = paced.segments.find((s) => s.kind === "plan")!;
        const frames: [Stage, number, number][] = [
            [wideStage, 1, 40],
            [phoneStage, 1, 25],
            ...[...paced.rest, ...paced.segments.map((s) => s.p1)].map(
                (p) => [wideStage, p, 15] as [Stage, number, number],
            ),
        ];
        for (const [stage, p, radius] of frames) {
            const frame = frameAt(paced, p);
            const pose = flown.pose(frame, stage);
            const reached = (line: { points: Vec3[]; ps: number[] }) =>
                line.points.filter((_, k) => line.ps[k] <= p);
            // The track and the dashed plan as far as it has drawn.
            const on =
                frame.segment === plan ? smoothstep(CRANE, 0.85, frame.u) : 0;
            const path = flown.planned!.path;
            const line = [
                ...reached(flown.track),
                ...path.slice(1, Math.round(on * (path.length - 1)) + 1),
            ];
            const runs = visibleRuns(line, pose, stage);
            expect(selfCrossings(runs)).toEqual([]);
            for (const run of runs) {
                const { tightest, flips } = bendsOf(run);
                expect(flips).toBe(0);
                expect(tightest).toBeGreaterThanOrEqual(radius);
            }
            // A ring meets the line only at its touch point.
            flown.rings.forEach((ring, i) => {
                if (!ring || !line.length) return;
                const w = flown.worlds[i];
                const touch = line.reduce((a, b) =>
                    dist(a, w.at) < dist(b, w.at) ? a : b,
                );
                const t = screenOf(pose, stage, touch);
                for (const r of visibleRuns(reached(ring), pose, stage))
                    for (const run of runs)
                        for (let a = 1; a < r.length; a++)
                            for (let b = 1; b < run.length; b++) {
                                const at = crossing(
                                    r[a - 1],
                                    r[a],
                                    run[b - 1],
                                    run[b],
                                );
                                if (at)
                                    expect(
                                        Math.hypot(at.x - t.x, at.y - t.y),
                                    ).toBeLessThan(6);
                            }
            });
        }
    });
});

/* ---- labels and lines ----------------------------------------------------- */

describe("the labels and the lines", () => {
    const sizes = [
        { w: 71, h: 33 },
        { w: 141, h: 33 },
        { w: 141, h: 33 },
        { w: 134, h: 33 },
    ];

    const boxDistance = (b: Box, q: { x: number; y: number }) =>
        Math.hypot(
            Math.max(b.x0 - q.x, 0, q.x - b.x1),
            Math.max(b.y0 - q.y, 0, q.y - b.y1),
        );
    const wides = [stageFrame(1440, 828, true), stageFrame(1024, 624, true)];

    it("keeps each chase label off its world's sunward side, clear of its loop", () => {
        for (const stage of wides) {
            const chase = flown.chaseSides(stage, sizes, labelSafe(stage));
            expect(chase).toHaveLength(paced.segments.length);
            paced.segments.forEach((seg, index) => {
                if (seg.kind !== "coast" && seg.kind !== "flyby") return;
                const i = seg.chapter;
                const w = flown.worlds[i];
                const side = chase[index][i];
                // Away from the Sun, or above or below the world.
                const mid = frameAt(paced, (seg.p0 + seg.p1) / 2);
                const c = w.at;
                const { right } = viewAxes(flown.pose(mid, stage));
                const sunward = -(
                    c[0] * right[0] +
                    c[1] * right[1] +
                    c[2] * right[2]
                );
                expect(side.x * Math.sign(sunward)).toBeLessThanOrEqual(0);
                if (seg.kind !== "coast") return;
                // Through the held loop, the ship and the loop flown near
                // the world (the arrival included) stay LOOP_CLEAR off the
                // label, as flight-gl.ts places it.
                const from = i === 0 ? seg.p0 : seg.p0 - 0.05;
                for (let u = 0.14; u <= 0.86; u += 0.02) {
                    const p = lerp(seg.p0, seg.p1, u);
                    const frame = frameAt(paced, p);
                    const pose = flown.pose(frame, stage);
                    const at = w.at;
                    const q = screenOf(pose, stage, at);
                    const gap = Math.max(
                        labelGap(stage, w, q.depth, 1),
                        flown.flownGap(i, pose, stage, at, side, sizes[i]),
                    );
                    const box = labelBox(q, side, gap, sizes[i]);
                    for (let k = 0; k <= 60; k++) {
                        const ship = flown.shipAt(lerp(from, p, k / 60));
                        if (dist(ship, at) > 2.2 * w.park) continue;
                        expect(
                            boxDistance(box, screenOf(pose, stage, ship)),
                        ).toBeGreaterThan(LOOP_CLEAR - 2);
                    }
                }
            });
        }
        // A phone has no room beside its worlds: always below.
        const small = stageFrame(390, 780, false);
        for (const row of flown.chaseSides(small, sizes, labelSafe(small, 560)))
            for (const side of row)
                expect(side).toEqual({ x: 0, y: 1, reach: 1 });
    });

    it("gives each world one side on the chase, turning into the map with the crane", () => {
        for (const stage of [...wides, stageFrame(1920, 1008, true)]) {
            const safe = labelSafe(stage);
            const map = flown.mapSides(stage, sizes, { w: 60, h: 17 }, safe);
            const chase = flown.chaseSides(stage, sizes, safe, map);
            const plan = paced.segments.findIndex((s) => s.kind === "plan");
            flown.worlds.forEach((_, i) => {
                // From its approach to its departure, one side.
                const own = chase.filter((_, k) => k !== plan).map((r) => r[i]);
                for (const side of own) expect(side).toEqual(own[0]);
            });
            // The world held into the map turns with the crane.
            const i = flown.worlds.length - 1;
            const side = chase[plan][i];
            expect(side.x * map[i].x + side.y * map[i].y).toBeGreaterThan(-0.2);
        }
    });

    it("ends Saturn's leader on its ring as drawn", () => {
        const pole: Vec3 = [0, 1, 0];
        // 45° above the ring's plane: its full radius across, less up and
        // down; edge-on it is a line, so a leader ends on the disc.
        const above = { eye: [0, 5, 5] as Vec3, target: [0, 0, 0] as Vec3 };
        expect(ringReach(above, pole, { x: 1, y: 0 })).toBeCloseTo(
            RING.outer,
            6,
        );
        expect(ringReach(above, pole, { x: 0, y: -1 })).toBeCloseTo(
            RING.outer * Math.SQRT1_2,
            6,
        );
        const edge = { eye: [0, 0, 5] as Vec3, target: [0, 0, 0] as Vec3 };
        expect(ringReach(edge, pole, { x: 0, y: 1 })).toBe(0);
    });

    it("keeps the scene clear of the record's column on a narrow window", () => {
        // At 1440 the column ends at 496, and the frame is as without it.
        const at1440 = stageFrame(1440, 828, true, 496);
        expect(at1440.clear).toBeCloseTo(1440 * 0.46);
        expect(at1440.lens.x).toBeCloseTo(1440 * 0.65);
        expect(at1440.map.lens.x).toBeCloseTo(1440 * 0.7);
        expect(labelMinX(at1440)).toBeCloseTo(1440 * 0.37);
        expect(lineMask(at1440)[0]).toBeCloseTo(1440 * 0.3, -1);
        expect(lineMask(at1440)[1]).toBeCloseTo(1440 * 0.46);
        // At 960 and 1024 it ends at 480, past 0.46 of the width.
        const end = frameAt(paced, 1);
        for (const [W, H] of [
            [960, 628],
            [1024, 696],
        ]) {
            const stage = stageFrame(W, H, true, 480);
            expect(stage.box.x0).toBeGreaterThanOrEqual(504);
            expect(stage.map.box.x0).toBeGreaterThanOrEqual(504);
            expect(labelMinX(stage)).toBeGreaterThanOrEqual(504);
            // Lines are faint at the column's edge, whole clear of it.
            const [from, to] = lineMask(stage);
            expect(smoothstep(from, to, 480)).toBeLessThan(0.25);
            expect(to).toBe(stage.clear);
            // The map's worlds, the now mark and the plan's end keep right
            // of the column.
            const pose = flown.pose(end, stage);
            for (const q of [
                ...flown.worlds.map((w) => w.at),
                flown.shipAt(1),
                flown.planned!.end,
            ])
                expect(screenOf(pose, stage, q).x).toBeGreaterThan(to + 24);
        }
    });

    it("keeps labels off the caption band and the phone's record", () => {
        const stage = stageFrame(1440, 828, true);
        expect(labelSafe(stage)).toEqual({
            x0: labelMinX(stage),
            y0: 8,
            x1: 1440 - 12,
            y1: 828 - 54,
        });
        expect(labelSafe(stageFrame(390, 780, false), 560).y1).toBe(552);
        // A label pushed off its world by the route stops at its room's
        // edge rather than fading there.
        const room = { x0: 0, y0: 0, x1: 400, y1: 200 };
        const size = { w: 50, h: 20 };
        const at = { x: 100, y: 100 };
        expect(roomGap(at, { x: 0, y: 1 }, size, room)).toBe(80);
        expect(roomGap(at, { x: -1, y: 0 }, size, room)).toBe(50);
        expect(labelBox(at, { x: 0, y: 1 }, 80, size).y1).toBe(room.y1);
    });

    it("finds the lines it patches in three.js's line shader", () => {
        const { vertexShader, fragmentShader } = ShaderLib.line;
        const patched = patchLineShader(vertexShader, fragmentShader)!;
        expect(patched).not.toBeNull();
        expect(patched.vertex).toContain("vAge = instanceAge;");
        expect(patched.fragment).toContain("smoothstep(uMask.x, uMask.y");
        expect(patched.fragment).toContain("uKeep");
        expect(patched.fragment).toContain("uDiscs");
        expect(patchLineShader("void main() {}", fragmentShader)).toBeNull();
    });
});

/* ---- the engine: the drawing buffer and the maps ------------------------ */

describe("the drawing buffer and the maps", () => {
    it("keeps the drawing buffer within the 1.75 cap and a pixel budget", () => {
        const pixels = (w: number, h: number, wide: boolean, device: number) =>
            w * h * drawingRatio(w, h, wide, device) ** 2;
        // 1440×900 at 1 (a 72px header): one pixel per CSS pixel.
        expect(drawingRatio(1440, 828, true, 1)).toBe(1);
        // A 14" laptop, 1512×945 at 2: about 3 MP, not 4.
        expect(drawingRatio(1512, 873, true, 2)).toBeGreaterThan(1.4);
        expect(pixels(1512, 873, true, 2)).toBeLessThanOrEqual(3.0e6);
        // 2560×1440 at 1.5: never under one pixel per CSS pixel.
        expect(drawingRatio(2560, 1368, true, 1.5)).toBe(1);
        // A phone, 390×844 at 3: the cap, within its 1.4 MP.
        expect(drawingRatio(390, 788, false, 3)).toBe(1.75);
        expect(pixels(390, 788, false, 3)).toBeLessThanOrEqual(1.4e6);
        // Zoomed out below one device pixel per CSS pixel: one.
        expect(drawingRatio(1440, 828, true, 0.8)).toBe(1);
    });

    it("gives a phone the smaller maps, and waits only for the worlds shown", () => {
        const phone = flightMaps(true);
        const wide = flightMaps(false);
        const first = firstMaps(phone, 4);
        // The night lights stay 2k, and the sunrise's lands finer still:
        // the sunrise shows them large.
        for (const f of first.filter(
            (f) => f !== phone.night && f !== phone.nightFine,
        ))
            expect(f).not.toMatch(/-2k|-4k/);
        expect(first).toContain("earth-night-sunrise-2k.webp");
        expect(firstMaps(wide, 4)).toContain("earth-night-sunrise-3k.webp");
        expect(phone.sky).toBe("milky-way-band-2k.webp");
        expect(wide.sky).toBe("milky-way-band-4k.webp");
        expect(firstMaps(wide, 4)).toContain("earth-2k.webp");
        expect(first).toEqual(
            expect.arrayContaining(["saturn-ring-1k.webp", "moon-1k.webp"]),
        );
        // Two chapters: Earth and Saturn, no Mars or Jupiter.
        expect(firstMaps(phone, 2).join()).not.toMatch(/mars|jupiter/);
    });
});
