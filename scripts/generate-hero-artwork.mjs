import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Use the encoder already installed with Next.js. Run from any directory with:
// node scripts/generate-hero-artwork.mjs
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const input = fileURLToPath(
    new URL("public/images/lunar-shared-horizon-v1.webp", root),
);
const original = fileURLToPath(
    new URL("assets/artwork/lunar-shared-horizon-original.png", root),
);
const output = new URL("public/images/lunar-horizon-v2/", root);
const largeOutput = new URL("public/images/lunar-horizon-v3/", root);
await mkdir(largeOutput, { recursive: true });
await mkdir(output, { recursive: true });
const { width, height } = await sharp(input).metadata();
const manifest = { landscape: [], mobile: [], preview: "" };

for (const [family, widths] of [
    ["landscape", [1280, 1920, 2560, 3840]],
    ["mobile", [640, 960, 1440, 1920]],
]) {
    for (const targetWidth of widths) {
        // Large displays get one encode directly from the lossless original,
        // preserving more texture and color than re-encoding the WebP master.
        const isLarge = family === "landscape" && targetWidth === 3840;
        const targetOutput = isLarge ? largeOutput : output;
        const version = isLarge ? "v3" : "v2";
        let pipeline = sharp(isLarge ? original : input);
        // Below 480px the hero is at least as tall as it is wide. This square
        // crop preserves the existing 58% focal point exactly, without sending
        // the off-screen sides of the panorama to phones.
        if (family === "mobile") {
            pipeline = pipeline.extract({
                left: Math.round((width - height) * 0.58),
                top: 0,
                width: height,
                height,
            });
        }
        pipeline = pipeline.resize({
            width: targetWidth,
            ...(isLarge ? { height: 2160 } : {}),
        });
        const avif = `${family}-${targetWidth}.avif`;
        const webp = `${family}-${targetWidth}.webp`;
        await Promise.all([
            pipeline
                .clone()
                .avif({
                    quality: family === "mobile" ? 60 : isLarge ? 85 : 65,
                    effort: 6,
                    chromaSubsampling: isLarge ? "4:4:4" : "4:2:0",
                })
                .toFile(fileURLToPath(new URL(avif, targetOutput))),
            pipeline
                .clone()
                .webp({ quality: isLarge ? 95 : 90, effort: 6 })
                .toFile(fileURLToPath(new URL(webp, targetOutput))),
        ]);
        manifest[family].push({
            width: targetWidth,
            avif: `/images/lunar-horizon-${version}/${avif}`,
            webp: `/images/lunar-horizon-${version}/${webp}`,
        });
        console.log(`${family}: ${targetWidth}px`);
    }
}
const preview = await sharp(input)
    .resize({ width: 64 })
    .webp({ quality: 35 })
    .toBuffer();
manifest.preview = `data:image/webp;base64,${preview.toString("base64")}`;
await writeFile(
    new URL("lib/hero-artwork.json", root),
    JSON.stringify(manifest, null, 4) + "\n",
);
