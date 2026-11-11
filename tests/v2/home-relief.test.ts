import { afterAll, describe, expect, it } from "vitest";
import {
    HOME_BEDS,
    HOME_BEDS_GLSL,
    makeHomeBeds,
    makeHomeShadow,
} from "../../src/scripts/home-relief";
import {
    HOME_SHADOW,
    HOME_SUN_DIRECTION,
} from "../../src/scripts/home-lighting";

type Noise = { noise(x: number, y: number, z: number): number };

const zeroNoise: Noise = { noise: () => 0 };
// Smooth, bounded to [-0.8, 0.8], and different at every scale the beds ask for.
const smoothNoise: Noise = {
    noise: (x, y, z) =>
        0.8 * Math.sin(1.3 * x + 0.7 * z) * Math.cos(0.9 * y + 0.4 * x),
};
const noises = { zero: zeroNoise, smooth: smoothNoise };

/** A cone of the given slope, apex `peak` metres above flat ground at zero. */
const cone =
    (cx: number, cz: number, slope: number, peak = 90) =>
    (x: number, z: number) =>
        Math.max(0, peak - slope * Math.hypot(x - cx, z - cz));

const centreOf = (beds: ReturnType<typeof makeHomeBeds>) => ({
    x: (beds.left + beds.right) / 2,
    z: (beds.back + beds.front) / 2,
});

describe("home beds", () => {
    for (const [label, noise] of Object.entries(noises)) {
        describe(`with ${label} noise`, () => {
            const flat = () => 0;
            const probe = makeHomeBeds(flat, noise);
            const centre = centreOf(probe);
            const beds = makeHomeBeds(cone(centre.x, centre.z, 0.3), noise);
            const measured = cone(centre.x, centre.z, 0.3);

            it("returns bounds around a sensible area", () => {
                expect(beds.left).toBeLessThan(beds.right);
                expect(beds.back).toBeLessThan(beds.front);
            });

            it("never cuts upward and keeps strength within 0 to 1 over the rebuilt area", () => {
                let cut = 0;
                for (let x = beds.left - 20; x <= beds.right + 20; x += 6)
                    for (let z = beds.back - 20; z <= beds.front + 20; z += 6) {
                        const result = beds.at(x, z);
                        expect(result.cut).toBeLessThanOrEqual(0);
                        expect(Number.isFinite(result.cut)).toBe(true);
                        expect(Number.isFinite(result.bed)).toBe(true);
                        expect(result.strength).toBeGreaterThanOrEqual(0);
                        expect(result.strength).toBeLessThanOrEqual(1);
                        if (result.cut < 0) cut++;
                    }
                // The sample is only meaningful if beds exist at all.
                expect(cut).toBeGreaterThan(100);
            });

            it("does nothing at or beyond the rebuilt edge", () => {
                const outside: [number, number][] = [];
                for (let t = -300; t <= 300; t += 25)
                    for (const over of [0, 1, 5, 30]) {
                        outside.push([beds.left - over, centre.z + t]);
                        outside.push([beds.right + over, centre.z + t]);
                        outside.push([centre.x + t, beds.back - over]);
                        outside.push([centre.x + t, beds.front + over]);
                    }
                for (const [x, z] of outside) {
                    const result = beds.at(x, z);
                    expect(Math.abs(result.cut), `${x}, ${z}`).toBe(0);
                    expect(result.strength).toBe(0);
                }
            });

            it("fades out inside the edge so the rebuilt ground meets the measured height", () => {
                // Even a few metres inside the edge, courses are gone.
                const z = centre.z;
                expect(Math.abs(beds.at(beds.left + 2, z).cut)).toBe(0);
                expect(Math.abs(beds.at(beds.right - 2, z).cut)).toBe(0);
                const x = centre.x;
                expect(Math.abs(beds.at(x, beds.back + 2).cut)).toBe(0);
                expect(Math.abs(beds.at(x, beds.front - 2).cut)).toBe(0);
            });

            it("is untouched wherever the measured ground is below the buried level", () => {
                const low = makeHomeBeds(() => 11.9, noise);
                const rim = makeHomeBeds(() => 12, noise);
                for (let x = -200; x <= 200; x += 20)
                    for (let z = -200; z <= 200; z += 20) {
                        const c = centreOf(low);
                        for (const b of [low, rim]) {
                            const result = b.at(c.x + x, c.z + z);
                            expect(Math.abs(result.cut)).toBe(0);
                            expect(result.strength).toBe(0);
                        }
                    }
                // On the cone, every point at or below 12 m is untouched.
                let checked = 0;
                for (let r = 0; r < 400; r += 3)
                    for (let a = 0; a < Math.PI * 2; a += 0.5) {
                        const x = centre.x + r * Math.cos(a),
                            z = centre.z + r * Math.sin(a);
                        if (measured(x, z) > 12) continue;
                        checked++;
                        expect(Math.abs(beds.at(x, z).cut)).toBe(0);
                        expect(beds.at(x, z).strength).toBe(0);
                    }
                expect(checked).toBeGreaterThan(50);
            });

            it("never raises the carved surface above the measured one", () => {
                for (const slope of [0.1, 0.3, 0.6]) {
                    const m = cone(centre.x, centre.z, slope);
                    const b = makeHomeBeds(m, noise);
                    for (let r = 0; r < 240; r += 0.5) {
                        const x = centre.x + r,
                            z = centre.z + 0.4 * r;
                        expect(m(x, z) + b.at(x, z).cut).toBeLessThanOrEqual(
                            m(x, z),
                        );
                    }
                }
            });

            it("keeps the carved surface continuous, including across course boundaries", () => {
                for (const slope of [0.1, 0.3, 0.6]) {
                    const m = cone(centre.x, centre.z, slope);
                    const b = makeHomeBeds(m, noise);
                    // The largest change between neighbours at a spacing,
                    // and how many course boundaries the walk crossed.
                    const walk = (step: number) => {
                        let previous: number | undefined,
                            previousBed = 0,
                            worst = 0,
                            boundaries = 0;
                        for (let r = 0; r < 200; r += step) {
                            const here = b.at(centre.x + r, centre.z);
                            const surface =
                                m(centre.x + r, centre.z) + here.cut;
                            if (previous !== undefined) {
                                worst = Math.max(
                                    worst,
                                    Math.abs(surface - previous),
                                );
                                if (
                                    Math.floor(here.bed) !==
                                    Math.floor(previousBed)
                                )
                                    boundaries++;
                            }
                            previous = surface;
                            previousBed = here.bed;
                        }
                        return { worst, boundaries };
                    };
                    const coarse = walk(0.02),
                        fine = walk(0.002);
                    expect(coarse.boundaries).toBeGreaterThanOrEqual(2);
                    // A face climbs at about eight times the measured slope,
                    // and up to three times that where a course is thinning
                    // (the ratio of the fastest to the slowest bed rate). A
                    // seam would be a step of metres at any spacing.
                    expect(coarse.worst, `slope ${slope}`).toBeLessThan(
                        0.02 * (26 * (slope + 0.15) + 0.3),
                    );
                    // A continuous surface closes up as the spacing does.
                    expect(fine.worst, `slope ${slope}`).toBeLessThan(
                        coarse.worst * 0.2,
                    );
                }
            });

            it("meets itself at the exact boundary between two courses", () => {
                const m = cone(centre.x, centre.z, 0.3);
                const b = makeHomeBeds(m, noise);
                const eps = 1e-7;
                let found = 0;
                let previous = b.at(centre.x, centre.z).bed;
                for (let r = 0.05; r < 200 && found < 12; r += 0.05) {
                    const bed = b.at(centre.x + r, centre.z).bed;
                    if (Math.floor(bed) !== Math.floor(previous)) {
                        // Bisect to the boundary, then compare both sides.
                        let lo = r - 0.05,
                            hi = r;
                        for (let i = 0; i < 50; i++) {
                            const mid = (lo + hi) / 2;
                            if (
                                Math.floor(
                                    b.at(centre.x + mid, centre.z).bed,
                                ) === Math.floor(previous)
                            )
                                lo = mid;
                            else hi = mid;
                        }
                        const below =
                            m(centre.x + lo - eps, centre.z) +
                            b.at(centre.x + lo - eps, centre.z).cut;
                        const above =
                            m(centre.x + hi + eps, centre.z) +
                            b.at(centre.x + hi + eps, centre.z).cut;
                        // Two nearly equal points either side of the seam.
                        expect(Math.abs(above - below)).toBeLessThan(1e-3);
                        found++;
                    }
                    previous = bed;
                }
                expect(found).toBeGreaterThan(3);
            });

            // Course levels are solved for exactly, so a slope that only
            // falls is cut into steps that only fall. Where the noise makes
            // the rubble mantle thicken along the walk the cut deepens and
            // eases, which can tilt a tread back by a few centimetres in a
            // metre; that is a hollow in scree, not an overhang.
            it("keeps a monotonic slope monotonic: ledges never overhang", () => {
                const back = label === "zero" ? 0 : 0.2;
                for (const slope of [0.1, 0.3, 0.6]) {
                    const m = cone(centre.x, centre.z, slope);
                    const b = makeHomeBeds(m, noise);
                    let previous = Infinity;
                    // Walking outward and downhill, the carved surface must
                    // never climb back up.
                    for (let r = 0; r < 200; r += 0.05) {
                        const x = centre.x + r,
                            z = centre.z;
                        const surface = m(x, z) + b.at(x, z).cut;
                        expect(
                            surface,
                            `${label} noise, slope ${slope}, r ${r}`,
                        ).toBeLessThanOrEqual(previous + back * 0.05 + 1e-9);
                        previous = surface;
                    }
                }
            });
        });
    }
});

describe("HOME_BEDS_GLSL", () => {
    const text = HOME_BEDS_GLSL.replace(/\s+/g, " ");
    const body = /float homeBedSlope[^{]*\{(.*)\}/.exec(text)![1];
    const parsed =
        /along < ([\d.]+) \? ([\d.]+) : along < ([\d.]+) \? ([\d.]+) : ([\d.]+);/.exec(
            body,
        );
    const [treadEnds, treadSlope, rubbleEnds, rubbleSlope, faceSlope] = (
        parsed ?? []
    )
        .slice(1)
        .map(Number);

    it("writes every numeric literal as a GLSL float", () => {
        // Numbers not part of an identifier or of a longer number.
        const literals = text.match(/(?<![\w.])\d[\d.]*/g) ?? [];
        expect(literals.length).toBeGreaterThan(5);
        for (const literal of literals)
            expect(literal, literal).toMatch(/^\d+\.\d+$/);
    });

    it("states the same breakpoints and multipliers as HOME_BEDS", () => {
        const { tread, rubble } = HOME_BEDS;
        expect(parsed).not.toBeNull();
        expect(treadEnds).toBeCloseTo(tread.ends, 5);
        expect(rubbleEnds).toBeCloseTo(rubble.ends, 5);
        expect(treadSlope).toBeCloseTo(tread.gained / tread.ends, 5);
        expect(rubbleSlope).toBeCloseTo(
            (rubble.gained - tread.gained) / (rubble.ends - tread.ends),
            5,
        );
        expect(faceSlope).toBeCloseTo(
            (1 - rubble.gained) / (1 - rubble.ends),
            5,
        );
        // The part selector steps at the same two breakpoints.
        const steps = [...text.matchAll(/step\(([\d.]+), along\)/g)].map((m) =>
            Number(m[1]),
        );
        expect(steps).toEqual([treadEnds, rubbleEnds]);
    });

    it("has slopes whose widths sum to exactly one course of climb", () => {
        // Slope times width over the tread, the rubble and the face.
        expect(
            treadSlope * treadEnds +
                rubbleSlope * (rubbleEnds - treadEnds) +
                faceSlope * (1 - rubbleEnds),
        ).toBeCloseTo(1, 4);
        // And from HOME_BEDS itself, independent of GLSL rounding.
        const { tread: t, rubble: r } = HOME_BEDS;
        expect(
            (t.gained / t.ends) * t.ends +
                ((r.gained - t.gained) / (r.ends - t.ends)) *
                    (r.ends - t.ends) +
                ((1 - r.gained) / (1 - r.ends)) * (1 - r.ends),
        ).toBeCloseTo(1, 12);
    });

    it("orders the parts of a course", () => {
        const { tread, rubble } = HOME_BEDS;
        expect(tread.ends).toBeGreaterThan(0);
        expect(tread.ends).toBeLessThan(rubble.ends);
        expect(rubble.ends).toBeLessThan(1);
        expect(tread.gained).toBeGreaterThan(0);
        expect(tread.gained).toBeLessThan(rubble.gained);
        expect(rubble.gained).toBeLessThan(1);
    });
});

describe("home shadow", () => {
    const sun = HOME_SUN_DIRECTION;
    const tanElevation = sun.y / Math.hypot(sun.x, sun.z);
    // Shadow leans this far in x for each metre of z, and each metre of z
    // along the ray is this much longer than the metre it covers in z.
    const lean = sun.x / sun.z;
    const stretch = Math.hypot(1, lean);
    const cell = 3;
    const bounds = { left: -100, right: 100, back: -60, front: 200 };
    const flat = () => 0;

    afterAll(() => {
        HOME_SHADOW.homeShadow.value = null;
        HOME_SHADOW.homeShadowSize.value.set(0, 0);
    });

    it("casts nothing on flat ground", () => {
        const shadow = makeHomeShadow(bounds, flat, flat);
        for (let x = bounds.left; x <= bounds.right; x += 7)
            for (let z = bounds.back; z <= bounds.front; z += 7)
                expect(shadow.topAt(x, z), `${x}, ${z}`).toBeLessThan(0);
        shadow.dispose();
    });

    describe("behind a wall", () => {
        const H = 8;
        const wall = (_x: number, z: number) => (z >= 0 && z < 6 ? H : 0);
        const shadow = makeHomeShadow(bounds, wall, flat);
        afterAll(() => shadow.dispose());

        // The far end of the shadow along z at the given x, ground being 0.
        const shadowEnd = (x: number) => {
            let end = NaN;
            for (let z = 10; z < bounds.front; z += 0.25)
                if (shadow.topAt(x, z) > 0) end = z;
            return end;
        };

        it("is as long as height over tan(elevation), within two cells", () => {
            const expected = 6 + H / (tanElevation * stretch);
            for (const x of [-50, 0, 40]) {
                const end = shadowEnd(x);
                expect(Math.abs(end - expected), `x ${x}`).toBeLessThanOrEqual(
                    2 * cell,
                );
            }
        });

        it("leaves the sunward side lit", () => {
            for (let z = bounds.back + 1; z < -1; z += 2)
                expect(shadow.topAt(0, z), `z ${z}`).toBeLessThan(0);
        });

        it("falls at tan(elevation) with distance behind the wall", () => {
            const z1 = 12,
                z2 = 30;
            const rate =
                (shadow.topAt(0, z1) - shadow.topAt(0, z2)) / (z2 - z1);
            expect(rate).toBeCloseTo(tanElevation * stretch, 3);
            // Absolute height: H at the lip, losing the rate with distance,
            // to within one cell's fall.
            const fall = tanElevation * stretch * cell;
            for (const z of [12, 20, 30])
                expect(
                    Math.abs(shadow.topAt(0, z) - (H - (z - 6) * rate)),
                ).toBeLessThanOrEqual(fall + 1e-6);
        });

        it("shades what is below the surface and lights what is above", () => {
            const z = 20;
            const top = shadow.topAt(0, z);
            expect(top).toBeGreaterThan(0);
            expect(0).toBeLessThan(top); // the ground itself
            expect(top + 0.5).toBeGreaterThan(top); // a point above is lit
            // Wall-top height clears the shadow everywhere behind the wall.
            for (let zz = 10; zz < bounds.front; zz += 5)
                expect(H + 1).toBeGreaterThan(shadow.topAt(0, zz));
            // Past the end of the shadow the ground is lit again.
            expect(shadow.topAt(0, shadowEnd(0) + 2 * cell)).toBeLessThan(0);
        });
    });

    describe("behind a mesa", () => {
        const H = 20;
        const half = 6;
        const mesa = (x: number, z: number) =>
            Math.abs(x) <= half && z >= 0 && z < 24 ? H : 0;
        const shadow = makeHomeShadow(bounds, mesa, flat);
        afterAll(() => shadow.dispose());

        it("shades the lee side, leaning away from the sun, and nowhere else", () => {
            const z = 54; // 30 m beyond the mesa's far face
            const dz = z - 24;
            expect(shadow.topAt(lean * dz, z)).toBeGreaterThan(0);
            // The mirror image (as if the sun leaned the other way) is lit.
            expect(shadow.topAt(-lean * dz, z)).toBeLessThan(0);
            // Wide of the shadow is lit.
            expect(shadow.topAt(60, z)).toBeLessThan(0);
            expect(shadow.topAt(-60, z)).toBeLessThan(0);
            // The sunward side of the mesa is lit.
            for (const dx of [-5, 0, 5])
                expect(shadow.topAt(dx, -20)).toBeLessThan(0);
        });

        it("ends at the right distance", () => {
            const x = (z: number) => lean * (z - 24);
            const expected = 24 + H / (tanElevation * stretch);
            let end = NaN;
            for (let z = 30; z < bounds.front; z += 0.25)
                if (shadow.topAt(x(z), z) > 0) end = z;
            expect(Math.abs(end - expected)).toBeLessThanOrEqual(2 * cell);
        });
    });

    it("lets a far ridge on the sunward side shade the near ground", () => {
        // A wall 1 km high, 4 km toward the sun, sampled by the coarse sweep.
        const ridge = (_x: number, z: number) =>
            z >= -4000 && z < -3900 ? 1000 : 0;
        const shadow = makeHomeShadow(bounds, flat, ridge);
        for (const z of [-50, 0, 100]) {
            const expected = 1000 - tanElevation * stretch * (z + 3900);
            expect(expected).toBeGreaterThan(0);
            expect(Math.abs(shadow.topAt(0, z) - expected)).toBeLessThan(40);
        }
        shadow.dispose();
    });

    it("answers far below the ground outside every swept area", () => {
        const shadow = makeHomeShadow(bounds, flat, flat);
        expect(shadow.topAt(1e5, 0)).toBeLessThan(-1000);
        expect(shadow.topAt(0, -1e5)).toBeLessThan(-1000);
        shadow.dispose();
    });

    it("publishes a texture and clears it on dispose", () => {
        const shadow = makeHomeShadow(bounds, flat, flat);
        const texture = HOME_SHADOW.homeShadow.value;
        expect(texture).not.toBeNull();
        const size = HOME_SHADOW.homeShadowSize.value;
        expect(size.x).toBeGreaterThan(0);
        expect(size.y).toBeGreaterThan(0);
        const image = texture!.image as { data: Uint16Array };
        expect(image.data.length).toBe(size.x * size.y);
        const frame = HOME_SHADOW.homeShadowFrame.value;
        expect(frame.z).toBeCloseTo(lean, 10);
        expect(frame.w).toBe(cell);
        shadow.dispose();
        expect(HOME_SHADOW.homeShadow.value).toBeNull();
        expect(HOME_SHADOW.homeShadowSize.value.x).toBe(0);
        expect(HOME_SHADOW.homeShadowSize.value.y).toBe(0);
    });
});
