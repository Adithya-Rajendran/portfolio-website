import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// The home hero photograph (plan §2.8): NASA ISS072-E-30246, public domain.
// Reads only assets/artwork/hero-sunrise.json and the original it names,
// and writes public/images/hero-sunrise-v1/ (a 21:9 desktop crop and a
// 9:16 mobile crop, AVIF and WebP, each carrying the credit in its XMP)
// plus lib/hero-sunrise.json (the sources, a tiny preview per crop, the
// credit and the limb geometry in each crop's pixels). Uses the encoder
// installed with Next.js. Run from any directory with:
//   node scripts/generate-hero-sunrise.mjs
// /public images are cached immutably: bump VERSION on every re-encode.
const VERSION = "v1";

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);
const spec = JSON.parse(
    await readFile(new URL("assets/artwork/hero-sunrise.json", root), "utf8"),
);
const input = fileURLToPath(new URL(`assets/artwork/${spec.file}`, root));
const outDir = new URL(`public/images/hero-sunrise-${VERSION}/`, root);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const escapeXml = (value) =>
    value.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(spec.title)}</rdf:li></rdf:Alt></dc:title>
<dc:creator><rdf:Seq><rdf:li>${escapeXml(spec.creator)}</rdf:li></rdf:Seq></dc:creator>
<dc:source>${escapeXml(spec.source)}</dc:source>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(spec.license)}</rdf:li></rdf:Alt></dc:rights>
<photoshop:Credit>${escapeXml(`${spec.creator} (${spec.id})`)}</photoshop:Credit>
<xmpRights:WebStatement>${escapeXml(spec.terms)}</xmpRights:WebStatement>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;

/**
 * A seeded grain layer (mulberry32, like lib/sky/stars.ts): mid-grey with
 * a little noise, laid over the photograph in soft light. Soft light
 * leaves pure black black, so only the glow gains grain, which breaks the
 * banding in the sun's halo; seeded, so a re-run writes the same pixels.
 */
function grain(width, height, seed = 72) {
    let a = seed | 0;
    const random = () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const data = Buffer.alloc(width * height);
    for (let i = 0; i < data.length; i++) {
        // Sum of three uniforms: a cheap, bounded bell around 128.
        data[i] = Math.round(128 + (random() + random() + random() - 1.5) * 9);
    }
    return sharp(data, { raw: { width, height, channels: 1 } })
        .toColourspace("srgb")
        .png()
        .toBuffer();
}

const round = (value) => Math.round(value * 10) / 10;
const manifest = {
    credit: spec.credit,
    source: spec.source,
    title: spec.title,
};

for (const [family, crop] of Object.entries(spec.crops)) {
    const [x0, y0, x1, y1] = crop.box;
    const boxWidth = x1 - x0;
    const boxHeight = y1 - y0;
    const largest = Math.max(...crop.widths);
    const scale = largest / boxWidth;
    const sources = [];
    for (const width of crop.widths) {
        const height = Math.round((width * boxHeight) / boxWidth);
        // Crop, then scale down (never up), then grain at the output size.
        const pipeline = sharp(input)
            .extract({ left: x0, top: y0, width: boxWidth, height: boxHeight })
            .resize({ width, height, kernel: "lanczos3" })
            .composite([
                { input: await grain(width, height), blend: "soft-light" },
            ])
            .withXmp(xmp);
        const name = `${family}-${width}`;
        await Promise.all([
            pipeline
                .clone()
                .avif({ quality: 58, effort: 6, chromaSubsampling: "4:2:0" })
                .toFile(fileURLToPath(new URL(`${name}.avif`, outDir))),
            pipeline
                .clone()
                .webp({ quality: 84, effort: 6 })
                .toFile(fileURLToPath(new URL(`${name}.webp`, outDir))),
        ]);
        sources.push({
            width,
            height,
            avif: `/images/hero-sunrise-${VERSION}/${name}.avif`,
            webp: `/images/hero-sunrise-${VERSION}/${name}.webp`,
        });
        console.log(`${family}: ${width}×${height}`);
    }
    // In the largest encode's pixels, so an SVG with that viewBox and the
    // same cover crop lies exactly on the photograph.
    const point = (x, y) => ({
        x: round((x - x0) * scale),
        y: round((y - y0) * scale),
    });
    const circle = ({ cx, cy, r }) => {
        const centre = point(cx, cy);
        return { cx: centre.x, cy: centre.y, r: round(r * scale) };
    };
    const preview = await sharp(input)
        .extract({ left: x0, top: y0, width: boxWidth, height: boxHeight })
        .resize({ width: 48 })
        .webp({ quality: 40 })
        .toBuffer();
    manifest[family] = {
        width: largest,
        height: Math.round(largest * (boxHeight / boxWidth)),
        sources,
        preview: `data:image/webp;base64,${preview.toString("base64")}`,
        limb: circle(spec.geometry.limb),
        surface: circle(spec.geometry.surface),
        sun: point(spec.geometry.sun.x, spec.geometry.sun.y),
    };
}

await writeFile(
    new URL("lib/hero-sunrise.json", root),
    JSON.stringify(manifest, null, 4) + "\n",
);
