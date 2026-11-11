import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as T from "three";
import { readPngSamples } from "../../src/lib/png-samples";
import {
    HOME_SITE,
    homeScenePoint,
    loadHomeTerrain,
} from "../../src/scripts/home-terrain";

const heading = T.MathUtils.degToRad(HOME_SITE.heading);
const cos = Math.cos(heading),
    sin = Math.sin(heading);
// The same formulas heightAt uses to find the data position of a scene one.
const eastOf = (x: number, z: number) => HOME_SITE.east + x * cos - z * sin;
const northOf = (x: number, z: number) => HOME_SITE.north - x * sin - z * cos;

describe("homeScenePoint", () => {
    it("puts the site at the origin", () => {
        const origin = homeScenePoint(HOME_SITE.east, HOME_SITE.north);
        expect(origin.x).toBeCloseTo(0, 10);
        expect(Math.abs(origin.z)).toBeCloseTo(0, 10);
    });

    it("sends the heading's bearing along -Z", () => {
        for (const distance of [1, 100, 2500]) {
            const point = homeScenePoint(
                HOME_SITE.east + distance * sin,
                HOME_SITE.north + distance * cos,
            );
            expect(point.x).toBeCloseTo(0, 8);
            expect(point.z).toBeCloseTo(-distance, 8);
        }
    });

    it("sends the bearing's right-hand side along +X", () => {
        // A quarter turn clockwise from the heading, as compass bearings go.
        const right = T.MathUtils.degToRad(HOME_SITE.heading + 90);
        const point = homeScenePoint(
            HOME_SITE.east + 40 * Math.sin(right),
            HOME_SITE.north + 40 * Math.cos(right),
        );
        expect(point.x).toBeCloseTo(40, 8);
        expect(point.z).toBeCloseTo(0, 8);
    });

    it("preserves distances", () => {
        const pairs = [
            [-262, 96, 14.5, 425.5],
            [0, 0, 1000, -300],
            [-4000, 3500, 2200, -1800],
        ];
        for (const [e1, n1, e2, n2] of pairs) {
            const a = homeScenePoint(e1, n1),
                b = homeScenePoint(e2, n2);
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(
                Math.hypot(e1 - e2, n1 - n2),
                8,
            );
        }
    });

    it("is the inverse of the east and north formulas heightAt uses", () => {
        for (const [east, north] of [
            [-262, 96],
            [14.5, 425.5],
            [0, 0],
            [-3000, 2500],
            [4100, -3900],
        ]) {
            const { x, z } = homeScenePoint(east, north);
            expect(eastOf(x, z)).toBeCloseTo(east, 8);
            expect(northOf(x, z)).toBeCloseTo(north, 8);
        }
        // And the other way round.
        for (const [x, z] of [
            [0, 0],
            [10, -31],
            [-440, 310],
            [3000, -2000],
        ]) {
            const back = homeScenePoint(eastOf(x, z), northOf(x, z));
            expect(back.x).toBeCloseTo(x, 8);
            expect(back.z).toBeCloseTo(z, 8);
        }
    });
});

describe("loadHomeTerrain", () => {
    const folder = "public/terrain/jezero-v1/";
    const file = (name: string) => readFileSync(folder + name);
    const asBuffer = (bytes: Buffer) =>
        bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer;

    const textures: T.Texture[] = [];
    const stubTextures = () =>
        vi
            .spyOn(T.TextureLoader.prototype, "loadAsync")
            .mockImplementation(async () => {
                const texture = new T.Texture();
                textures.push(texture);
                return texture;
            });
    const serve = (
        override: (name: string) => Response | undefined = () => undefined,
    ) =>
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string) => {
                expect(url.startsWith("/terrain/jezero-v1/")).toBe(true);
                const name = url.slice("/terrain/jezero-v1/".length);
                return (
                    override(name) ?? new Response(file(name), { status: 200 })
                );
            }),
        );

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        textures.length = 0;
    });

    it("is zero at the origin and finite across eight kilometres", async () => {
        stubTextures();
        serve();
        const terrain = await loadHomeTerrain();
        expect(terrain.heightAt(0, 0)).toBe(0);
        const span = 4000;
        let lowest = Infinity,
            highest = -Infinity;
        for (let x = -span; x <= span; x += 125)
            for (let z = -span; z <= span; z += 125) {
                const height = terrain.heightAt(x, z);
                expect(Number.isFinite(height), `${x}, ${z}`).toBe(true);
                lowest = Math.min(lowest, height);
                highest = Math.max(highest, height);
            }
        // Within the range the files encode (-2660.8 to -2271.9 m).
        expect(highest - lowest).toBeLessThanOrEqual(388.9 + 1e-6);
        expect(highest - lowest).toBeGreaterThan(50);
        // Far past every grid, the edge height is held, not NaN.
        for (const [x, z] of [
            [1e6, 0],
            [0, -1e6],
            [-1e7, 1e7],
        ])
            expect(Number.isFinite(terrain.heightAt(x, z))).toBe(true);
        terrain.dispose();
    });

    it("reads the elevation pack the way the files describe it", async () => {
        stubTextures();
        serve();
        const terrain = await loadHomeTerrain();
        const grid = await readPngSamples(asBuffer(file("height-0.png")));
        expect([grid.width, grid.height, grid.channels]).toEqual([512, 512, 3]);
        const metres = (column: number, row: number) => {
            const at = (row * 512 + column) * 3;
            return (
                -2660.8 +
                (((grid.samples[at] << 8) | grid.samples[at + 1]) / 65535) *
                    (-2271.9 + 2660.8)
            );
        };
        // Cell centres: east = (column + 0.5 - 256) * 2 from the data's centre,
        // north = (256 - row - 0.5) * 2 (north-up, rows increase southward).
        const at = (column: number, row: number) => {
            const { x, z } = homeScenePoint(
                (column + 0.5 - 256) * 2,
                (256 - row - 0.5) * 2,
            );
            return terrain.heightAt(x, z);
        };
        for (const [[c1, r1], [c2, r2]] of [
            [
                [200, 240],
                [230, 260],
            ],
            [
                [180, 300],
                [190, 200],
            ],
        ])
            expect(at(c1, r1) - at(c2, r2)).toBeCloseTo(
                metres(c1, r1) - metres(c2, r2),
                2,
            );
        // The butte north of the site stands well above the floor around it.
        const summit = homeScenePoint(14.5, 425.5);
        expect(terrain.heightAt(summit.x, summit.z)).toBeGreaterThan(40);
        terrain.dispose();
    });

    it("hands back the frame of the scene and releases its textures", async () => {
        stubTextures();
        serve();
        const terrain = await loadHomeTerrain();
        expect(terrain.frame.x).toBeCloseTo(cos, 12);
        expect(terrain.frame.y).toBeCloseTo(sin, 12);
        expect(terrain.frame.z).toBe(HOME_SITE.east);
        expect(terrain.frame.w).toBe(HOME_SITE.north);
        expect(textures).toHaveLength(3);
        for (const texture of textures)
            expect(texture.colorSpace).toBe(T.NoColorSpace);
        const disposed = textures.map((texture) => {
            const listener = vi.fn();
            texture.addEventListener("dispose", listener);
            return listener;
        });
        terrain.dispose();
        for (const listener of disposed)
            expect(listener).toHaveBeenCalledOnce();
    });

    it("rejects with the file's name when a height file does not answer", async () => {
        stubTextures();
        serve((name) =>
            name === "height-1.png"
                ? new Response("gone", { status: 404 })
                : undefined,
        );
        await expect(loadHomeTerrain()).rejects.toThrow(
            /height-1\.png answered 404/,
        );
    });

    it("rejects with the file's name when a height file is the wrong grid", async () => {
        stubTextures();
        // The outer grid is 256 square; it is not the inner one's size.
        serve((name) =>
            name === "height-0.png"
                ? new Response(file("height-2.png"))
                : undefined,
        );
        await expect(loadHomeTerrain()).rejects.toThrow(
            /height-0\.png is not the expected grid/,
        );
    });

    it("rejects, rather than building an empty scene, when a file is not a PNG", async () => {
        stubTextures();
        serve((name) =>
            name === "height-2.png"
                ? new Response("<html>not found</html>", { status: 200 })
                : undefined,
        );
        await expect(loadHomeTerrain()).rejects.toThrow(/Not a PNG/);
    });

    it("rejects when a texture cannot be loaded", async () => {
        vi.spyOn(T.TextureLoader.prototype, "loadAsync").mockRejectedValue(
            new Error("detail-0.webp failed"),
        );
        serve();
        await expect(loadHomeTerrain()).rejects.toThrow(/failed/);
    });
});
