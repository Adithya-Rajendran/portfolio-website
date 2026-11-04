import sharp from "sharp";
const root = new URL("../../", import.meta.url);
const { data, info } = await sharp(
    new URL("assets/scenes/textures/rock-color.jpg", root).pathname,
)
    .resize(2048)
    .greyscale()
    .blur(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
for (const [name, color] of [
    ["moon", [139, 143, 149]],
    ["mars", [177, 117, 82]],
]) {
    // Smooth dust with fine deterministic grain. The softened photographic
    // detail stays low contrast, so repeating stones do not read as jagged mesh.
    let seed = 71;
    const rgb = Buffer.alloc(info.width * info.height * 3);
    for (let i = 0; i < data.length; i++) {
        seed = (seed * 16807) % 2147483647;
        const grain = (seed / 2147483647 - 0.5) * 6;
        const detail = (data[i] - 128) * 0.12 + grain;
        for (let c = 0; c < 3; c++)
            rgb[i * 3 + c] = Math.min(
                255,
                Math.max(0, Math.round(color[c] + detail)),
            );
    }
    await sharp(rgb, {
        raw: { width: info.width, height: info.height, channels: 3 },
    })
        .jpeg({ quality: 86 })
        .toFile(
            new URL(`assets/scenes/textures/${name}-ground-v2.jpg`, root)
                .pathname,
        );
}
