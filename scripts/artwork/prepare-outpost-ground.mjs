import sharp from "sharp";
const root = new URL("../../", import.meta.url);
const { data, info } = await sharp(
    new URL("assets/scenes/textures/rock-color.jpg", root).pathname,
)
    .resize(2048)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
for (const [name, tint] of [
    ["moon", [0.8, 0.82, 0.84]],
    ["mars", [1.05, 0.58, 0.34]],
]) {
    const rgb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < data.length; i++)
        for (let c = 0; c < 3; c++)
            rgb[i * 3 + c] = Math.min(255, Math.round(data[i] * tint[c]));
    await sharp(rgb, {
        raw: { width: info.width, height: info.height, channels: 3 },
    })
        .jpeg({ quality: 86 })
        .toFile(
            new URL(`assets/scenes/textures/${name}-ground-v2.jpg`, root)
                .pathname,
        );
}
