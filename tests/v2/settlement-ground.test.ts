import { existsSync, readFileSync, statSync } from "node:fs";
import sharp from "sharp";
import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { SETTLEMENT_GROUND_EDGE } from "../../src/scripts/settlement-ground";

// Where each settlement stands on its globe (attachOutpost) and the sun the
// Experience scene lights it with. The site maps hold shadows worked out
// for that sun, so the two must not drift apart.
const stands = {
    moon: new Vector3(0.08, 0.94, 0.33),
    mars: new Vector3(-0.12, 0.94, 0.4),
};
const sceneSun = new Vector3(5, 2, 1.8).normalize();

const sites = (["moon", "mars"] as const).flatMap((world) => [
    { world, path: `public/terrain/${world}-site-v1/`, size: 2048 },
    { world, path: `public/terrain/${world}-site-v1/half/`, size: 1024 },
]);

describe.each(sites)(
    "the $world site maps in $path",
    ({ world, path, size }) => {
        const manifest = JSON.parse(readFileSync(path + "site.json", "utf8"));

        it("describes a map the ground mesh reaches the end of", () => {
            expect(manifest.world).toBe(world);
            expect(manifest.metres).toBe(512);
            expect(manifest.steepest).toBeGreaterThan(0);
            const [from, to] = manifest.reach as number[];
            expect(from).toBeLessThan(to);
            // The maps fade out inside their own picture and before the drawn
            // ground does, so neither edge can show.
            expect(to).toBeLessThanOrEqual(manifest.metres / 2);
            expect(to).toBeLessThan(SETTLEMENT_GROUND_EDGE[1]);
        });

        it("was shaded under the sun the scene uses on that world", () => {
            const local = sceneSun
                .clone()
                .applyQuaternion(
                    new Quaternion()
                        .setFromUnitVectors(
                            new Vector3(0, 1, 0),
                            stands[world].clone().normalize(),
                        )
                        .invert(),
                );
            const [x, y, z] = manifest.sun as number[];
            expect(x).toBeCloseTo(local.x, 2);
            expect(y).toBeCloseTo(local.y, 2);
            expect(z).toBeCloseTo(local.z, 2);
        });

        it("names sixteen stencilled designations", () => {
            expect(manifest.labels).toHaveLength(16);
            for (const label of manifest.labels as string[]) {
                expect(label).toMatch(/^[A-Z0-9][A-Z0-9 ·.-]{1,13}$/);
            }
        });

        it("has both pictures, square and at the stated size", async () => {
            for (const name of ["site.webp", "relief.webp"]) {
                const file = path + name;
                expect(existsSync(file), file).toBe(true);
                const { width, height } = await sharp(file).metadata();
                expect([width, height], file).toEqual([size, size]);
                // A phone downloads these: keep them small.
                expect(statSync(file).size, file).toBeLessThan(
                    size === 2048 ? 600_000 : 200_000,
                );
            }
        });
    },
);

describe.each([
    { path: "public/terrain/regolith-v1/", size: 1024 },
    { path: "public/terrain/regolith-v1/half/", size: 512 },
])("the lunar soil square in $path", ({ path, size }) => {
    const manifest = JSON.parse(readFileSync(path + "floor.json", "utf8"));

    it("is in the homepage floor's format", async () => {
        expect(manifest.metres).toBe(12);
        expect(manifest.steepest).toBe(2.5);
        expect(manifest.size).toBe(size);
        for (const name of ["colour", "slope-x", "slope-z", "sun"]) {
            const file = `${path}${name}.webp`;
            expect(existsSync(file), file).toBe(true);
            const { width, height } = await sharp(file).metadata();
            expect([width, height], file).toEqual([size, size]);
        }
    });
});
