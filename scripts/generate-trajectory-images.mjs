import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The photographs on /resume/trajectory (Option B, the voyage): four NASA
// full-disk planets, masked to their limbs (Saturn keeps its rings), and
// one deep-sky backdrop. All NASA public domain; the sources, credits and
// final sizes are listed in public/images/trajectory/README.md. Downloads
// each original once into the OS temp directory, then writes transparent
// WebP files to public/images/trajectory/. Uses the encoder installed with
// Next.js. Run from any directory with:
//   node scripts/generate-trajectory-images.mjs
// /public images are cached immutably: bump VERSION on every re-encode.
const VERSION = "v1";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const outDir = new URL("public/images/trajectory/", root);
const manifest = new URL("lib/trajectory-images.json", root);
const cache = join(tmpdir(), "trajectory-sources");

const asset = (id, ext = "jpg") =>
    `https://images-assets.nasa.gov/image/${id}/${id}~orig.${ext}`;

/**
 * `body` is the planet's limb in the original's pixels, an ellipse (Jupiter
 * and Saturn are oblate); `rings` is Saturn's outer ring edge. `size` is
 * the output width.
 */
const PLANETS = [
    {
        name: "earth",
        url: asset("as17-148-22727"),
        body: { cx: 2300, cy: 2327, rx: 1521, ry: 1521 },
        size: 520,
    },
    {
        name: "mars",
        url: asset("GSFC_20171208_Archive_e000332"),
        body: { cx: 998, cy: 979, rx: 681, ry: 681 },
        size: 400,
    },
    {
        name: "jupiter",
        url: asset("GSFC_20171208_Archive_e000103", "png"),
        body: { cx: 690, cy: 699, rx: 537, ry: 509 },
        size: 620,
    },
    {
        name: "saturn",
        url: asset("PIA06193"),
        body: { cx: 4400, cy: 2232, rx: 1620, ry: 1456 },
        rings: { cx: 4400, cy: 2232, rx: 3600, ry: 932 },
        size: 1000,
    },
];

const BACKDROP = {
    name: "backdrop",
    url: asset("carina_nebula", "png"),
    // The whole frame, graded down to sit behind line work.
    width: 2000,
    brightness: 0.62,
    saturation: 0.72,
};

async function original(url) {
    await mkdir(cache, { recursive: true });
    const file = join(cache, url.split("/").pop().replace("~", "-"));
    try {
        await stat(file);
    } catch {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
    }
    return readFile(file);
}

const ellipse = ({ cx, cy, rx, ry }, fill = "#fff") =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

/** A white-on-black mask the size of the output, feathered by `blur` px. */
async function mask(width, height, shapes, blur) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000"/>${shapes}</svg>`;
    return sharp(Buffer.from(svg)).blur(blur).greyscale().raw().toBuffer();
}

await mkdir(outDir, { recursive: true });
const report = [];

for (const planet of PLANETS) {
    const input = await original(planet.url);
    const extent = planet.rings ?? planet.body;
    // A little room around the limb (and the rings' ends).
    const pad = Math.round(Math.max(extent.rx, extent.ry) * 0.02);
    const left = Math.round(extent.cx - extent.rx - pad);
    const top = Math.round(
        Math.min(extent.cy - extent.ry, planet.body.cy - planet.body.ry) - pad,
    );
    const right = Math.round(extent.cx + extent.rx + pad);
    const bottom = Math.round(
        Math.max(extent.cy + extent.ry, planet.body.cy + planet.body.ry) + pad,
    );
    const scale = planet.size / (right - left);
    const width = planet.size;
    const height = Math.round((bottom - top) * scale);
    const at = (e) => ({
        cx: (e.cx - left) * scale,
        cy: (e.cy - top) * scale,
        rx: e.rx * scale,
        ry: e.ry * scale,
    });
    const body = at(planet.body);
    // Just inside the limb, so no black fringe survives the mask.
    const inset = { ...body, rx: body.rx - 0.8, ry: body.ry - 0.8 };

    const rgb = await sharp(input)
        .extract({ left, top, width: right - left, height: bottom - top })
        .resize(width, height, { kernel: "lanczos3" })
        .removeAlpha()
        .raw()
        .toBuffer();
    const disc = await mask(width, height, ellipse(inset), 0.6);
    const alpha = Buffer.alloc(width * height);
    for (let i = 0; i < width * height; i++) {
        let a = disc[i];
        if (planet.rings) {
            // The rings: keyed on brightness, so their gaps and the shadow
            // the planet casts on them stay open to the sky behind. The
            // disc itself stays opaque, night side included.
            const r = rgb[i * 3];
            const g = rgb[i * 3 + 1];
            const b = rgb[i * 3 + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const ring = Math.max(0, Math.min(255, (luma - 9) * (255 / 34)));
            a = Math.max(a, ring);
        }
        alpha[i] = a;
    }
    const file = `${planet.name}-${VERSION}.webp`;
    await sharp(rgb, { raw: { width, height, channels: 3 } })
        .joinChannel(alpha, { raw: { width, height, channels: 1 } })
        .webp({ quality: 86, alphaQuality: 90, effort: 6 })
        .toFile(new URL(file, outDir).pathname);
    const bytes = (await stat(new URL(file, outDir))).size;
    const round = (v) => Math.round(v * 10000) / 10000;
    report.push({
        name: planet.name,
        file,
        width,
        height,
        bytes,
        // The limb (and rings) as fractions of the image, for the scene.
        body: {
            cx: round(body.cx / width),
            cy: round(body.cy / height),
            rx: round(body.rx / width),
            ry: round(body.ry / height),
        },
        rings: planet.rings
            ? {
                  cx: round(at(planet.rings).cx / width),
                  cy: round(at(planet.rings).cy / height),
                  rx: round(at(planet.rings).rx / width),
                  ry: round(at(planet.rings).ry / height),
              }
            : undefined,
    });
}

{
    const input = await original(BACKDROP.url);
    const file = `${BACKDROP.name}-${VERSION}.webp`;
    const info = await sharp(input)
        .removeAlpha()
        .resize({ width: BACKDROP.width, withoutEnlargement: true })
        .modulate({
            brightness: BACKDROP.brightness,
            saturation: BACKDROP.saturation,
        })
        .webp({ quality: 68, effort: 6 })
        .toFile(new URL(file, outDir).pathname);
    const bytes = (await stat(new URL(file, outDir))).size;
    report.push({
        name: BACKDROP.name,
        file,
        width: info.width,
        height: info.height,
        bytes,
    });
}

const entries = Object.fromEntries(
    report.map(({ name, file, width, height, body, rings }) => [
        name,
        { src: `/images/trajectory/${file}`, width, height, body, rings },
    ]),
);
await writeFile(manifest, `${JSON.stringify(entries, null, 4)}\n`);
for (const { file, width, height, bytes } of report)
    console.log(`${file}  ${width}×${height}  ${(bytes / 1024).toFixed(1)} KB`);
console.log(
    `total  ${(report.reduce((sum, r) => sum + r.bytes, 0) / 1024).toFixed(1)} KB`,
);
