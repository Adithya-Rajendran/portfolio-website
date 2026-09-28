import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The mission patch: a geometric monoline AR above a planet's limb, an
 * orange sun cresting the horizon, an inclined orbit knocked out behind the
 * letters, and ring lettering drawn as strokes (no font). Ported from the
 * mockup's _src/patchgen.py (design/explorations/d-deep-field-plus).
 *
 * Run from any directory after changing the drawing:
 *   node scripts/generate-patch.mjs
 *
 * It writes
 *   lib/patch.json        the <symbol id="ar-patch"> for the inline sprite
 *                         (components/chrome/svg-sprite.tsx): currentColor
 *                         strokes, the sun from --patch-sun, the lettered
 *                         band hidden by --patch-band: none
 *   app/icon.svg          the favicon: ring and emblem on a void disc
 *   app/apple-icon.png    180 × 180, the full patch on the void
 *   app/favicon.ico       16, 32 and 48 px PNGs of the favicon
 *
 * The ring reads the owner's name and his stated focus (Robotics · AI, the
 * profile's focus areas). It carries no "EST" year: the patch is static
 * art, so a launch year goes in only once the owner confirms one.
 */

const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const root = new URL("../", import.meta.url);

const VOID = "#050507";
const INK = "#ECE8DF";
const SUN = "#FF5A1F";

// Glyphs in a box of cap height 12: [width, path].
const GLYPHS = {
    A: [11, "M0 12L5.5 0L11 12M2.3 7.4H8.7"],
    B: [8.2, "M0 12V0H4.2A3 3 0 0 1 4.2 6H0M4.2 6H5.2A3 3 0 0 1 5.2 12H0"],
    C: [11, "M10.8 2.4A6 6 0 1 0 10.8 9.6"],
    D: [10, "M0 0H4A6 6 0 0 1 4 12H0Z"],
    E: [8, "M8 0H0V12H8M0 6H7"],
    H: [10, "M0 0V12M10 0V12M0 6H10"],
    I: [0.01, "M0 0V12"],
    J: [7, "M7 0V8.5A3.5 3.5 0 0 1 0 8.5"],
    N: [10, "M0 12V0L10 12V0"],
    O: [12, "M6 0A6 6 0 1 0 6 12A6 6 0 1 0 6 0Z"],
    R: [9, "M0 12V0H4.6A3.2 3.2 0 0 1 4.6 6.4H0M4 6.4L9 12"],
    S: [
        8.6,
        "M8 1.8C6.6 -0.3 1 -0.6 1 3.1C1 7 8.4 5 8.4 8.9C8.4 12.6 2.2 12.6 0.3 10.2",
    ],
    T: [9, "M0 0H9M4.5 0V12"],
    Y: [10, "M0 0L5 6L10 0M5 6V12"],
    "·": [2, "M1 5.4A0.6 0.6 0 1 0 1 6.6A0.6 0.6 0 1 0 1 5.4Z"],
    " ": [6, ""],
};
const TRACK = 4.2;
const SCALE = 0.54;
const RADIUS = 84.6;
const TOP = "ADITHYA RAJENDRAN";
const BOTTOM = "ROBOTICS · AI";

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const f2 = (n) => n.toFixed(2);

function arcText(text, centerDeg, bottom) {
    const glyphs = [...text].map((ch) => GLYPHS[ch] ?? GLYPHS[" "]);
    const widths = glyphs.map(([w]) => w * SCALE);
    const total =
        widths.reduce((a, b) => a + b, 0) + TRACK * SCALE * (glyphs.length - 1);
    const out = [];
    let pos = -total / 2;
    glyphs.forEach(([, d], i) => {
        const w = widths[i];
        const mid = pos + w / 2;
        pos += w + TRACK * SCALE;
        if (!d) return;
        const ang = bottom
            ? centerDeg - deg(mid / RADIUS)
            : centerDeg + deg(mid / RADIUS);
        const x = 100 + RADIUS * Math.cos(rad(ang));
        const y = 100 + RADIUS * Math.sin(rad(ang));
        const rot = bottom ? ang - 90 : ang + 90;
        const h = 12 * SCALE;
        out.push(
            `<path transform="translate(${f2(x)} ${f2(y)}) rotate(${f2(rot)}) translate(${f2(-w / 2)} ${f2(-h / 2)}) scale(${SCALE})" d="${d}"/>`,
        );
    });
    return { paths: out.join(""), half: deg(total / 2 / RADIUS) };
}

const top = arcText(TOP, 270, false);
const bottom = arcText(BOTTOM, 90, true);

// Bezel ticks between r 80.5/82.5 and 86, skipping the lettering (+7°).
let ticks = "";
for (let a = 0; a < 360; a += 6) {
    const off = (centre) =>
        Math.abs(((((a - centre + 180) % 360) + 360) % 360) - 180);
    if (off(270) <= top.half + 7 || off(90) <= bottom.half + 7) continue;
    const r1 = a % 30 === 0 ? 80.5 : 82.5;
    const c = Math.cos(rad(a));
    const s = Math.sin(rad(a));
    ticks += `M${f2(100 + r1 * c)} ${f2(100 + r1 * s)}L${f2(100 + 86 * c)} ${f2(100 + 86 * s)}`;
}

function star(x, y, r) {
    const n = (v) => Math.round(v * 1000) / 1000;
    return `M${x} ${n(y - r)}L${n(x + r * 0.22)} ${n(y - r * 0.22)}L${n(x + r)} ${y}L${n(x + r * 0.22)} ${n(y + r * 0.22)}L${x} ${n(y + r)}L${n(x - r * 0.22)} ${n(y + r * 0.22)}L${n(x - r)} ${y}L${n(x - r * 0.22)} ${n(y - r * 0.22)}Z`;
}

// The AR monogram: a pointed A with its crossbar; R with a round bowl.
const MONO_A = "M72 116L84 76L96 116M75.9 103H92.1";
const MONO_R = "M106 116V76H114A10 10 0 0 1 114 96H106M114 96L128 116";

const ca = Math.cos(Math.PI * 0.08);
const sa = Math.sin(Math.PI * 0.08);
const ci = Math.cos(rad(-16));
const si = Math.sin(rad(-16));
const sat = [
    100 + 70 * ca * ci - 19 * sa * si,
    103 + 70 * ca * si + 19 * sa * ci,
];
const stars =
    star(56, 66, 4.2) +
    star(146, 58, 3) +
    star(141, 124, 2.4) +
    star(60, 126, 1.8);

/** The drawing. `p` prefixes the ids; `band` false leaves the lettering out. */
function body(p, sunFill, band = true) {
    const bandGroup = band
        ? `<g class="patch__band" style="display:var(--patch-band, inline)"><path d="${ticks}" stroke-width="1"/><g stroke-width="${(1.5 / SCALE).toFixed(2)}" stroke-linecap="butt" stroke-linejoin="miter">${top.paths}${bottom.paths}</g></g>`
        : "";
    return `<defs><clipPath id="${p}field"><circle cx="100" cy="100" r="74"/></clipPath><clipPath id="${p}sky"><rect x="0" y="0" width="200" height="143.2"/></clipPath><mask id="${p}knock" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/><path d="${MONO_A}${MONO_R}" fill="none" stroke="#000" stroke-width="10"/></mask></defs><g fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter"><circle class="patch__ring" cx="100" cy="100" r="96.5" stroke-width="3"/><circle class="patch__band-edge" cx="100" cy="100" r="76.5" stroke-width="1"/>${bandGroup}<g clip-path="url(#${p}field)"><g clip-path="url(#${p}sky)"><circle class="patch__halo" cx="100" cy="143.5" r="17" stroke-width="0.75" stroke-dasharray="1.2 2.4"/><circle class="patch__sun" cx="100" cy="143.5" r="10.5" ${sunFill} stroke="none"/></g><circle cx="100" cy="263" r="120" stroke-width="1.75"/><path class="patch__lat" d="M20 170Q100 150 180 170M10 190Q100 166 190 190" stroke-width="0.75"/><g mask="url(#${p}knock)"><ellipse class="patch__orbit" cx="100" cy="103" rx="70" ry="19" transform="rotate(-16 100 103)" stroke-width="0.9"/></g><circle cx="${f2(sat[0])}" cy="${f2(sat[1])}" r="3" fill="currentColor" stroke="none"/><path d="${stars}" fill="currentColor" stroke="none"/></g><g class="patch__mono" stroke-width="3.2"><path d="${MONO_A}"/><path d="${MONO_R}"/></g></g>`;
}

const symbol = `<symbol id="ar-patch" viewBox="0 0 200 200">${body("arp-", 'style="fill:var(--patch-sun,#FF5A1F)"')}</symbol>`;

/** A standalone file on a void disc, so it reads on light and dark tabs. */
function standalone(p, { band, disc }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" color="${INK}">${disc ? `<circle cx="100" cy="100" r="99" fill="${VOID}"/>` : `<rect width="200" height="200" fill="${VOID}"/>`}${body(p, `fill="${SUN}"`, band)}</svg>\n`;
}

const icon = standalone("i-", { band: false, disc: true });
const apple = standalone("a-", { band: true, disc: false });

/** PNG-in-ICO: a 6-byte header, a 16-byte entry per image, then the PNGs. */
function ico(pngs) {
    const header = Buffer.alloc(6 + 16 * pngs.length);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    let offset = header.length;
    pngs.forEach(({ size, data }, i) => {
        const at = 6 + 16 * i;
        header.writeUInt8(size >= 256 ? 0 : size, at);
        header.writeUInt8(size >= 256 ? 0 : size, at + 1);
        header.writeUInt8(0, at + 2);
        header.writeUInt8(0, at + 3);
        header.writeUInt16LE(1, at + 4);
        header.writeUInt16LE(32, at + 6);
        header.writeUInt32LE(data.length, at + 8);
        header.writeUInt32LE(offset, at + 12);
        offset += data.length;
    });
    return Buffer.concat([header, ...pngs.map(({ data }) => data)]);
}

const png = (svg, size) =>
    sharp(Buffer.from(svg), { density: 72 * (size / 200) * 4 })
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toBuffer();

// The favicon drops the lettering and thickens nothing: at 16 px the
// ring, limb, sun and monogram still read.
const icoPngs = [];
for (const size of [16, 32, 48]) {
    icoPngs.push({ size, data: await png(icon, size) });
}

await writeFile(
    fileURLToPath(new URL("lib/patch.json", root)),
    `${JSON.stringify({ symbol }, null, 4)}\n`,
);
await writeFile(fileURLToPath(new URL("app/icon.svg", root)), icon);
await writeFile(
    fileURLToPath(new URL("app/apple-icon.png", root)),
    await png(apple, 180),
);
await writeFile(fileURLToPath(new URL("app/favicon.ico", root)), ico(icoPngs));

console.log(
    `patch: symbol ${symbol.length} B · icon.svg ${icon.length} B · top arc ±${top.half.toFixed(1)}° · bottom arc ±${bottom.half.toFixed(1)}°`,
);
