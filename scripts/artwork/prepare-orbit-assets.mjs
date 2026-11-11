import sharp from "sharp";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Source credits and adaptations: public/images/trajectory/README.md.
// Versioned filenames: the Worker serves /images with immutable caching.
const root = new URL("../../", import.meta.url);
const output = new URL("public/images/trajectory/", root);
const cache = join(tmpdir(), "portfolio-orbit-sources");
const solar = "https://www.solarsystemscope.com/textures/download/";
const maps = [
    ["moon-surface-v2-4k", "8k_moon.jpg", 4096, 90],
    ["moon-surface-v2-2k", "8k_moon.jpg", 2048, 90],
    ["mars-surface-v2-4k", "8k_mars.jpg", 4096, 90],
    ["mars-surface-v2-2k", "8k_mars.jpg", 2048, 90],
    ["earth-surface-v2-8k", "8k_earth_daymap.jpg", 8192, 91],
    ["earth-surface-v2-2k", "8k_earth_daymap.jpg", 2048, 88],
    ["earth-clouds-v2-4k", "8k_earth_clouds.jpg", 4096, 89],
    ["earth-clouds-v2-2k", "8k_earth_clouds.jpg", 2048, 85],
    ["earth-lights-v2-4k", "8k_earth_nightmap.jpg", 4096, 88],
    ["earth-lights-v2-2k", "8k_earth_nightmap.jpg", 2048, 85],
    ["earth-normal-v2-2k", "2k_earth_normal_map.tif", 2048, 90],
    ["earth-water-v2-2k", "2k_earth_specular_map.tif", 2048, 90],
];
await mkdir(output, { recursive: true });
await mkdir(cache, { recursive: true });
const requests = new Map();
function source(url) {
    if (!requests.has(url))
        requests.set(
            url,
            (async () => {
                const path = join(cache, url.split("/").at(-1));
                try {
                    return await readFile(path);
                } catch {
                    const response = await fetch(url);
                    if (!response.ok)
                        throw new Error(`${url}: ${response.status}`);
                    const bytes = Buffer.from(await response.arrayBuffer());
                    await writeFile(path, bytes);
                    return bytes;
                }
            })(),
        );
    return requests.get(url);
}
for (const [name, file, width, quality] of maps) {
    await sharp(await source(solar + file))
        .resize(width, width / 2, { fit: "fill", kernel: "lanczos3" })
        .webp({ quality, effort: 6, smartSubsample: true })
        .toFile(new URL(`${name}.webp`, output).pathname);
    const { size } = await stat(new URL(`${name}.webp`, output));
    console.log(`${name}: ${Math.round(size / 1024)} KB`);
}

// Perspective projection from the photographic celestial sphere. A rotated
// flat rectangle leaves visible black corners; ray sampling has no such edges.
async function projectSky(input, width, height) {
    const { data, info } = await sharp(input)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const pixels = Buffer.alloc(width * height * 3);
    const scale = Math.tan((104 * Math.PI) / 360),
        aspect = width / height;
    const angle = (-32 * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const px = ((2 * (x + 0.5)) / width - 1) * scale;
            const py = ((1 - (2 * (y + 0.5)) / height) * scale) / aspect;
            const rx = c * px - s * py,
                ry = s * px + c * py;
            const length = Math.sqrt(rx * rx + ry * ry + 1);
            const u = (((Math.atan2(rx, 1) / (2 * Math.PI) + 0.5) % 1) + 1) % 1;
            const v = 0.5 - Math.asin(ry / length) / Math.PI;
            const fx = u * (info.width - 1),
                fy = v * (info.height - 1);
            const x0 = Math.floor(fx),
                y0 = Math.floor(fy),
                dx = fx - x0,
                dy = fy - y0;
            for (let k = 0; k < 3; k++) {
                const at = (xx, yy) =>
                    data[
                        (Math.min(info.height - 1, yy) * info.width +
                            (xx % info.width)) *
                            info.channels +
                            k
                    ];
                pixels[(y * width + x) * 3 + k] = Math.round(
                    (at(x0, y0) * (1 - dx) + at(x0 + 1, y0) * dx) * (1 - dy) +
                        (at(x0, y0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1) * dx) *
                            dy,
                );
            }
        }
    }
    return sharp(pixels, { raw: { width, height, channels: 3 } });
}
const sky = await source("https://cdn.eso.org/images/large/eso0932a.jpg");
for (const [name, width] of [
    ["milky-way-v2-4k", 3840],
    ["milky-way-v2-2k", 1920],
]) {
    await (
        await projectSky(sky, width, Math.round(width * 0.625))
    )
        .modulate({ saturation: 0.66, brightness: 0.92 })
        .webp({ quality: 87, effort: 6, smartSubsample: true })
        .toFile(new URL(`${name}.webp`, output).pathname);
    const { size } = await stat(new URL(`${name}.webp`, output));
    console.log(`${name}: ${Math.round(size / 1024)} KB`);
}
// Small-screen backdrop: the 2k sky resized to 1024 px (WebP quality 80),
// served to narrow viewports by src/styles/space.css.
{
    const name = "milky-way-v2-1k";
    await sharp(new URL("milky-way-v2-2k.webp", output).pathname)
        .resize({ width: 1024 })
        .webp({ quality: 80, effort: 6, smartSubsample: true })
        .toFile(new URL(`${name}.webp`, output).pathname);
    const { size } = await stat(new URL(`${name}.webp`, output));
    console.log(`${name}: ${Math.round(size / 1024)} KB`);
}
