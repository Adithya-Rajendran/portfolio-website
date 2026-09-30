import { describe, expect, it } from "vitest";
import {
    CRANE,
    FLIGHT_PACING,
    RING,
    buildFlight,
    dist,
    screenOf,
    stageFrame,
    viewAxes,
    worldKinds,
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
                expect(dist(ships[i], flight.worldAt(w, t))).toBeGreaterThan(
                    clear,
                );
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
                    expect(
                        dist(pose.eye, flight.worldAt(w, frame.t)),
                    ).toBeGreaterThan(w.radius * 1.5);
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
    it("gives transfers and the finale the room their moves need", () => {
        const kinds = (kind: string) =>
            paced.segments.filter((s) => s.kind === kind).map((s) => s.w);
        expect(kinds("transfer").every((w) => w === 0.95)).toBe(true);
        expect(kinds("plan")).toEqual([2]);
        expect(100 + paced.weight * 52).toBeLessThanOrEqual(600);
    });

    it.each(stages)(
        "holds still while a chapter's card is read (%s)",
        (_, stage) => {
            const poses = track(stage);
            for (const seg of paced.segments) {
                if (seg.kind !== "coast") continue;
                const hold = poses.filter(
                    (x) =>
                        x.frame.segment === seg &&
                        x.frame.u >= 0.14 &&
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
            // finale's crane.
            steps.forEach((step, i) => {
                if (poses[i + 1].frame.segment.kind !== "plan")
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
                    screenOf(
                        pose,
                        stage,
                        flown.worldAt(flown.worlds[i], frame.t),
                    );
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
                const phase = flown.phaseAngle(pose, w, frame.t);
                expect(phase).toBeGreaterThanOrEqual(45);
                expect(phase).toBeLessThanOrEqual(63);
                const centre = flown.worldAt(w, frame.t);
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
        "keeps the Sun out of frame until the finale (%s)",
        (_, stage) => {
            for (const { frame, pose } of track(stage)) {
                if (frame.segment.kind === "plan") continue;
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
            const c = screenOf(pose, stage, flown.worldAt(w, frame.t));
            const s = screenOf(pose, stage, flown.shipAt(frame.p));
            const R = (w.radius * stage.kpx) / c.depth;
            expect(R).toBeGreaterThan(95);
            expect(flown.phaseAngle(pose, w, frame.t)).toBeLessThan(63);
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

    it("sets the route off on a clean curve, along the first orbit", () => {
        const w = flown.worlds[0];
        const a = flown.shipAt(0);
        const b = flown.shipAt(0.0005);
        const e0 = flown.worldAt(w, frameAt(paced, 0).t);
        const e1 = flown.worldAt(w, frameAt(paced, 0.0005).t);
        const heading = [0, 1, 2].map((k) => e1[k] - e0[k]);
        const v = [0, 1, 2].map((k) => b[k] - a[k]);
        const cos =
            (v[0] * heading[0] + v[1] * heading[1] + v[2] * heading[2]) /
            (Math.hypot(...v) * Math.hypot(...heading));
        expect(cos).toBeGreaterThan(0.5);
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
                ...flown.worlds.map((w) => flown.mapAt(w, frame.t, 1)),
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

    it("sits each world on its own loop in the map", () => {
        const frame = frameAt(paced, 1);
        const trail = flown.trail(2400);
        flown.worlds.forEach((w, i) => {
            const chapter = data.chapters[i];
            expect(flown.mapAt(w, frame.t, 0)).toEqual(
                flown.worldAt(w, frame.t),
            );
            const at = flown.mapAt(w, frame.t, 1);
            expect(at).toEqual(flown.worldAt(w, chapter.end));
            // Inside the loop the ship flew round it.
            const near = Math.min(...trail.map((s) => dist(s, at)));
            expect(near).toBeLessThan(1.25 * w.park);
        });
    });
});
