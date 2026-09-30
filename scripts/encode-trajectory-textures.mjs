import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The maps for the 3D flight on /resume/trajectory
// (components/trajectory/flight-maps.ts picks them per screen, flight-gl.ts
// draws them): Solar System Scope's
// equirectangular textures (CC BY 4.0) and NASA's Earth layers (public
// domain), credited in the figure line and in
// public/images/trajectory/README.md. Downloads each source once into the
// OS temp directory, then writes public/images/trajectory/*.webp with sharp
// (the encoder installed with Next.js). Run from any directory with:
//   node scripts/encode-trajectory-textures.mjs [file.webp …]
// /public images are cached immutably: rename a file when re-encoding it.

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const outDir = new URL("public/images/trajectory/", root);
const cache = join(tmpdir(), "trajectory-textures");
const SSS = "https://www.solarsystemscope.com/textures/download/";
const NASA = "https://eoimages.gsfc.nasa.gov/images/imagerecords/";

/**
 * Each map: its source, its size and how it is encoded.
 * - `q`: lossy WebP at this quality (`lossless`: exact);
 * - `grey`: one channel (the cloud cover, the night lights);
 * - `blur` (a Gaussian's sigma, source pixels) and `haze` (levels below
 *   this, of 255, cut to clear sky): the cloud cover, which needs neither
 *   its finest grain nor its thin haze at the sizes the flight draws;
 * - `zonal`: averaged across longitude (Saturn's bands), so the texture is
 *   a narrow strip that stays sharp at any size;
 * - `water`: 1 where the day map is ocean (b > r + 18 and b ≥ g), as a
 *   two-level mask;
 * - `gain`: brightened by this factor before encoding, so the faint sky
 *   keeps its detail through WebP (the renderer divides it back out);
 * - `destar`: the sky's point stars taken out (a median this many pixels
 *   wide at 4096 across), leaving the Milky Way's glow.
 */
const MAPS = [
    { out: "earth-2k.webp", src: SSS + "2k_earth_daymap.jpg", w: 2048, q: 74 },
    { out: "earth-1k.webp", src: SSS + "2k_earth_daymap.jpg", w: 1024, q: 72 },
    { out: "mars-2k.webp", src: SSS + "2k_mars.jpg", w: 2048, q: 66 },
    { out: "mars-1k.webp", src: SSS + "2k_mars.jpg", w: 1024, q: 66 },
    { out: "jupiter-2k.webp", src: SSS + "2k_jupiter.jpg", w: 2048, q: 72 },
    { out: "jupiter-1k.webp", src: SSS + "2k_jupiter.jpg", w: 1024, q: 72 },
    {
        out: "saturn-strip-v1.webp",
        src: SSS + "2k_saturn.jpg",
        w: 8,
        h: 1024,
        zonal: true,
        lossless: true,
    },
    {
        out: "saturn-ring-1k.webp",
        src: SSS + "2k_saturn_ring_alpha.png",
        w: 1024,
        h: 64,
        lossless: true,
    },
    {
        out: "earth-clouds-2k.webp",
        src: NASA + "57000/57747/cloud_combined_2048.jpg",
        w: 2048,
        q: 40,
        grey: true,
        blur: 0.8,
        haze: 20,
    },
    {
        out: "earth-clouds-1k.webp",
        src: NASA + "57000/57747/cloud_combined_2048.jpg",
        w: 1024,
        q: 40,
        grey: true,
        blur: 1.2,
        haze: 20,
    },
    {
        out: "earth-night-2k.webp",
        src: NASA + "144000/144897/BlackMarble_2016_01deg_gray.jpg",
        w: 2048,
        q: 70,
        grey: true,
    },
    {
        out: "earth-water-1k.webp",
        src: SSS + "2k_earth_daymap.jpg",
        w: 1024,
        water: true,
        lossless: true,
    },
    { out: "moon-1k.webp", src: SSS + "2k_moon.jpg", w: 1024, q: 45 },
    {
        out: "milky-way-band-4k.webp",
        src: SSS + "8k_stars_milky_way.jpg",
        w: 4096,
        q: 85,
        gain: 4,
        destar: 7,
    },
    {
        out: "milky-way-band-2k.webp",
        src: SSS + "8k_stars_milky_way.jpg",
        w: 2048,
        q: 85,
        gain: 4,
        destar: 7,
    },
];

async function source(url) {
    const file = join(cache, url.split("/").at(-1));
    try {
        return await readFile(file);
    } catch {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        await mkdir(cache, { recursive: true });
        await writeFile(file, bytes);
        return bytes;
    }
}

/** The ocean mask of a day map: its pixels at 2k, then resized. */
async function water(input, w, h) {
    const { data, info } = await sharp(input)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const mask = Buffer.alloc(info.width * info.height);
    for (let i = 0; i < mask.length; i++) {
        const [r, g, b] = [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
        mask[i] = b > r + 18 && b >= g ? 255 : 0;
    }
    // Lakes and rivers under a few pixels are dropped, the coast kept hard.
    const soft = await sharp(mask, {
        raw: { width: info.width, height: info.height, channels: 1 },
    })
        .median(5)
        .resize(w, h, { fit: "fill" })
        .png()
        .toBuffer();
    return sharp(soft).threshold(128);
}

/**
 * The sky without its point stars: a median filter this many pixels wide
 * at 4096 across, which keeps the Milky Way's glow and its dust lanes.
 * Magnified on screen the photograph's stars would read as soft blobs;
 * the seeded stars the renderer draws in front carry the sky's points.
 */
async function destar(input, size) {
    const band = await sharp(input)
        .resize(4096, 2048, { fit: "fill", kernel: "lanczos3" })
        .median(size)
        .png()
        .toBuffer();
    return sharp(band);
}

/** A zonal strip: every row averaged across longitude. */
async function zonal(input, w, h) {
    const row = await sharp(input)
        .resize(1, h, { fit: "fill", kernel: "cubic" })
        .png()
        .toBuffer();
    return sharp(row).resize(w, h, { fit: "fill", kernel: "nearest" });
}

// Named files only, if any are given.
const only = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
let total = 0;
for (const map of MAPS) {
    if (only.length && !only.includes(map.out)) continue;
    const input = await source(map.src);
    const target = new URL(map.out, outDir);
    const h = map.h ?? map.w / 2;
    let image = map.water
        ? await water(input, map.w, h)
        : map.zonal
          ? await zonal(input, map.w, h)
          : map.destar
            ? await destar(input, map.destar)
            : sharp(input);
    if (map.grey) image = image.greyscale();
    if (map.blur) image = image.blur(map.blur);
    if (!map.water && !map.zonal)
        image = image.resize(map.w, h, { fit: "fill", kernel: "lanczos3" });
    if (map.haze)
        image = image.linear(
            255 / (255 - map.haze),
            (-255 * map.haze) / (255 - map.haze),
        );
    if (map.gain) image = image.linear(map.gain, 0);
    await image
        .webp(
            map.lossless
                ? { lossless: true, effort: 6 }
                : { quality: map.q, effort: 6, smartSubsample: true },
        )
        .toFile(target.pathname);
    const { size } = await stat(target);
    total += size;
    console.log(`${map.out}\t${(size / 1024).toFixed(1)} KB`);
}
console.log(`total\t${(total / 1024).toFixed(1)} KB`);
