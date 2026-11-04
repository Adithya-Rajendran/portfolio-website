import sharp from "sharp";
import { mkdir, copyFile } from "node:fs/promises";

const input = "/tmp/portfolio-artwork";
const output = "public/images/scenes";
await mkdir(output, { recursive: true });
await mkdir("assets/scenes", { recursive: true });
const source = `${input}/horizon.png`;
const depth = `${input}/horizon-depth-0150.png`;
await sharp(source)
    .webp({ quality: 90, effort: 6 })
    .toFile(`${output}/horizon-v1.webp`);
await sharp(depth)
    .resize(1200, 675)
    .webp({ quality: 95, effort: 6 })
    .toFile(`${output}/horizon-depth-v1.webp`);
// Both the color and depth images use exactly the same mobile crop.
for (const [file, name] of [
    [source, "horizon-mobile-v1"],
    [depth, "horizon-depth-mobile-v1"],
]) {
    await sharp(file)
        .extract({ left: 1000, top: 0, width: 1350, height: 1350 })
        .resize(1000, 1000)
        .webp({ quality: 88, effort: 6 })
        .toFile(`${output}/${name}.webp`);
}
for (const name of ["optics-study", "signal-study"]) {
    await sharp(`${input}/${name}.png`)
        .webp({ quality: 88, effort: 6 })
        .toFile(`${output}/${name}-v1.webp`);
}
for (const name of ["horizon", "optics-study", "signal-study"]) {
    await copyFile(`${input}/${name}.blend`, `assets/scenes/${name}.blend`);
}
