import { existsSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { HOME_FLOOR } from "../../src/scripts/home-floor";
import { HOME_SUN_DIRECTION } from "../../src/scripts/home-lighting";

const folders = [
    { path: "public/terrain/floor-v1/", size: 2048 },
    { path: "public/terrain/floor-v1/half/", size: 1024 },
];
const names = ["colour", "slopeX", "slopeZ", "sun"];

describe.each(folders)("the baked floor in $path", ({ path, size }) => {
    const manifest = JSON.parse(readFileSync(path + "floor.json", "utf8"));

    it("agrees with the constants the shader uses", () => {
        expect(manifest.metres).toBe(HOME_FLOOR.metres);
        expect(manifest.steepest).toBe(HOME_FLOOR.steepest);
        expect(manifest.size).toBe(size);
    });

    it("was baked under the scene's sun", () => {
        const [x, y, z] = manifest.sun as number[];
        const length = Math.hypot(x, y, z);
        // The manifest holds the unnormalised source values.
        expect(x / length).toBeCloseTo(HOME_SUN_DIRECTION.x, 2);
        expect(y / length).toBeCloseTo(HOME_SUN_DIRECTION.y, 2);
        expect(z / length).toBeCloseTo(HOME_SUN_DIRECTION.z, 2);
    });

    it("lists four pictures that exist and are square", async () => {
        expect(Object.keys(manifest.files).sort()).toEqual([...names].sort());
        for (const name of names) {
            const file = path + manifest.files[name];
            expect(existsSync(file), file).toBe(true);
            const { width, height } = await sharp(file).metadata();
            expect([width, height], file).toEqual([size, size]);
        }
    });
});
