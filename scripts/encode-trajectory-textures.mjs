import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The planet maps for the 3D flight on /resume/trajectory
// (components/trajectory/flight-gl.ts). Solar System Scope's equirectangular
// textures, CC BY 4.0 (credited in the figure line and in
// public/images/trajectory/README.md). Downloads each source once into the
// OS temp directory, then writes public/images/trajectory/*.webp with sharp
// (the encoder installed with Next.js). Run from any directory with:
//   node scripts/encode-trajectory-textures.mjs
// /public images are cached immutably: rename a file when re-encoding it.

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const outDir = new URL("public/images/trajectory/", root);
const cache = join(tmpdir(), "trajectory-textures");
const SOURCE = "https://www.solarsystemscope.com/textures/download/";

const MAPS = [
    { out: "earth-2k.webp", src: "2k_earth_daymap.jpg", width: 2048, q: 74 },
    { out: "mars-2k.webp", src: "2k_mars.jpg", width: 2048, q: 66 },
    { out: "jupiter-2k.webp", src: "2k_jupiter.jpg", width: 2048, q: 72 },
    { out: "saturn-1k.webp", src: "2k_saturn.jpg", width: 1024, q: 80 },
    {
        out: "saturn-ring-1k.webp",
        src: "2k_saturn_ring_alpha.png",
        width: 1024,
        height: 64,
        alpha: true,
    },
];

async function source(name) {
    const file = join(cache, name);
    try {
        return await readFile(file);
    } catch {
        const response = await fetch(SOURCE + name);
        if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        await mkdir(cache, { recursive: true });
        await writeFile(file, bytes);
        return bytes;
    }
}

await mkdir(outDir, { recursive: true });
for (const map of MAPS) {
    const input = await source(map.src);
    const target = new URL(map.out, outDir);
    await sharp(input)
        .resize(map.width, map.height ?? map.width / 2, { fit: "fill" })
        // The ring's alpha is its detail: keep it lossless.
        .webp(
            map.alpha
                ? { lossless: true, effort: 6 }
                : { quality: map.q, effort: 6, smartSubsample: true },
        )
        .toFile(target.pathname);
    const { size } = await stat(target);
    console.log(`${map.out}\t${(size / 1024).toFixed(1)} KB`);
}
