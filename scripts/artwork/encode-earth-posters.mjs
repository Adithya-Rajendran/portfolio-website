import sharp from "sharp";
import { tmpdir } from "node:os";
import { join } from "node:path";
const output = new URL("../../public/images/trajectory/", import.meta.url);
for (const phase of ["dawn", "day", "dusk", "night"]) {
    await sharp(join(tmpdir(), "portfolio-earth-posters", `earth-${phase}.png`))
        .resize(880)
        .webp({ quality: 86, effort: 6 })
        .toFile(new URL(`earth-poster-v2-${phase}.webp`, output).pathname);
}
