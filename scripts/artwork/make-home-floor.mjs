import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * The crater floor at the scale of a boot: one square of ground that repeats
 * without a seam. Fractured slabs of bedrock stand a little proud of the
 * sand that fills their joints and drifts over them in rippled sheets, and
 * stones lie on both. Nothing here is measured. It is made the way the
 * rovers' cameras show such ground, to stand under the measured terrain.
 *
 * The homepage's sun never moves, so the shadow every slab edge and pebble
 * throws is worked out here as well, for that one sun.
 *
 *   node scripts/artwork/make-home-floor.mjs [directory]
 */
const SIZE = Number(process.env.FLOOR_SIZE ?? 2048);
/** Metres along one side of the square. */
const SPAN = 8;
/** Slopes are stored over this range either side of level. */
const STEEPEST = 2.5;
/** The scene's sun, as `HOME_SUN_DIRECTION` in src/scripts/home-lighting.ts. */
const SUN = [0.286, 0.2, -0.958];
const OUT = process.argv[2] ?? "public/terrain/floor-v1";

const TEXEL = SPAN / SIZE;
const count = SIZE * SIZE;
const wrap = (value, period) => ((value % period) + period) % period;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const smoothstep = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
};
const mix = (from, to, t) => from + (to - from) * t;

/** A repeatable number from 0 to 1 for a lattice point. */
const hash = (x, y, seed) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = (h + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
};
let state = 20261110;
const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
};

/** Smooth noise that repeats after `period` cells, -1 to 1. */
const noise = (x, y, period, seed) => {
    const x0 = Math.floor(x),
        y0 = Math.floor(y),
        fx = x - x0,
        fy = y - y0;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
        v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const at = (dx, dy) =>
        hash(wrap(x0 + dx, period), wrap(y0 + dy, period), seed);
    return (
        mix(mix(at(0, 0), at(1, 0), u), mix(at(0, 1), at(1, 1), u), v) * 2 - 1
    );
};
/** Layered noise over the square; `cells` is the count of its broadest layer. */
const cloud = (u, v, cells, layers, seed) => {
    let total = 0,
        weight = 0;
    for (let layer = 0; layer < layers; layer++) {
        const period = cells << layer,
            share = 0.5 ** layer;
        total += noise(u * period, v * period, period, seed + layer) * share;
        weight += share;
    }
    return total / weight;
};

/**
 * Cells grown from one scattered point each, `cells` to a side: for a place,
 * which cell holds it, the offset from that cell's point, and the distance
 * to the nearest wall between cells. Lengths are in cells.
 */
const cellsAt = (u, v, cells, seed, scatter = 0.86) => {
    const x = u * cells,
        y = v * cells,
        ix = Math.floor(x),
        iy = Math.floor(y);
    let best = Infinity,
        bx = 0,
        by = 0,
        cx = 0,
        cy = 0;
    for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
            const px = wrap(ix + dx, cells),
                py = wrap(iy + dy, cells);
            const ox = ix + dx + 0.5 + (hash(px, py, seed) - 0.5) * scatter - x,
                oy =
                    iy +
                    dy +
                    0.5 +
                    (hash(px, py, seed + 1) - 0.5) * scatter -
                    y;
            const apart = ox * ox + oy * oy;
            if (apart < best) {
                best = apart;
                bx = ox;
                by = oy;
                cx = ix + dx;
                cy = iy + dy;
            }
        }
    let wall = Infinity;
    for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
            const nx = cx + dx,
                ny = cy + dy;
            if (!dx && !dy) continue;
            const px = wrap(nx, cells),
                py = wrap(ny, cells);
            const ox = nx + 0.5 + (hash(px, py, seed) - 0.5) * scatter - x,
                oy = ny + 0.5 + (hash(px, py, seed + 1) - 0.5) * scatter - y;
            const along = Math.hypot(ox - bx, oy - by);
            if (along < 1e-6) continue;
            wall = Math.min(
                wall,
                ((ox + bx) * (ox - bx) + (oy + by) * (oy - by)) / (2 * along),
            );
        }
    return {
        x: wrap(cx, cells),
        y: wrap(cy, cells),
        offsetX: -bx,
        offsetY: -by,
        wall,
    };
};

const height = new Float32Array(count),
    sanded = new Float32Array(count),
    tone = new Float32Array(count),
    stone = new Float32Array(count),
    pale = new Float32Array(count);

// Slabs, their joints, and the sand that lies in and over them.
const SLABS = 11,
    CHIPS = 43,
    slab = SPAN / SLABS,
    chip = SPAN / CHIPS;
// Ripples cross the square a whole number of times each way, so they join.
const RIPPLES = [77, 44];
for (let row = 0; row < SIZE; row++) {
    const v = (row + 0.5) / SIZE;
    for (let column = 0; column < SIZE; column++) {
        const u = (column + 0.5) / SIZE,
            at = row * SIZE + column;
        const bent = cloud(u, v, 5, 3, 40) * 0.035,
            bentToo = cloud(u, v, 5, 3, 47) * 0.035;
        const cell = cellsAt(u + bent, v + bentToo, SLABS, 3);
        const id = (seed) => hash(cell.x, cell.y, seed);
        const joint = cell.wall * slab,
            gap = 0.02 + 0.05 * id(11) ** 2;
        // Each slab lies at its own height and tilt, worn round at its
        // edges, pitted, and sometimes broken again into smaller pieces.
        let rock =
            -0.018 +
            0.04 * id(12) ** 1.6 +
            (id(13) - 0.5) * 0.07 * cell.offsetX * slab +
            (id(14) - 0.5) * 0.07 * cell.offsetY * slab;
        rock -= 0.04 * (1 - smoothstep(0, gap, joint));
        rock -= 0.007 * (1 - smoothstep(gap, gap + 0.07, joint));
        rock += 0.0035 * cloud(u, v, 60, 4, 60);
        rock -= 0.005 * smoothstep(0.55, 0.8, cloud(u, v, 110, 2, 70));
        if (id(15) < 0.3) {
            const piece = cellsAt(u, v, CHIPS, 21);
            rock -= 0.005 * (1 - smoothstep(0, 0.008, piece.wall * chip));
        }
        // Sand lies deeper in broad hollows and thins to nothing between.
        const drift =
            -0.003 +
            0.045 * cloud(u, v, 3, 3, 80) +
            0.012 * cloud(u, v, 11, 2, 90);
        const depth = drift - rock;
        const wander = cloud(u, v, 6, 3, 100) * 0.9;
        const phase = (u * RIPPLES[0] + v * RIPPLES[1] + wander) * Math.PI * 2;
        const swell =
            smoothstep(0.006, 0.035, depth) *
            (0.45 + 0.55 * smoothstep(-0.3, 0.4, cloud(u, v, 4, 2, 110)));
        // A gentle windward slope and a short steep lee.
        const sand =
            drift + 0.005 * swell * Math.sin(phase + 0.55 * Math.sin(phase));
        const lap = 0.004,
            blend = clamp(0.5 + (sand - rock) / (2 * lap), 0, 1);
        height[at] = mix(rock, sand, blend) + lap * blend * (1 - blend);
        sanded[at] = blend;
        tone[at] = mix(
            0.86 + 0.3 * id(16) + 0.07 * cloud(u, v, 24, 3, 120),
            0.96 +
                0.1 * swell * Math.sin(phase + 1.2) +
                0.05 * cloud(u, v, 30, 2, 130),
            blend,
        );
    }
}

/** The ground between texels, at a place given in metres. */
const sample = (field, x, z) => {
    const fx = x / TEXEL - 0.5,
        fz = z / TEXEL - 0.5,
        x0 = Math.floor(fx),
        z0 = Math.floor(fz),
        tx = fx - x0,
        tz = fz - z0;
    const a = wrap(x0, SIZE),
        b = wrap(x0 + 1, SIZE),
        c = wrap(z0, SIZE) * SIZE,
        d = wrap(z0 + 1, SIZE) * SIZE;
    return mix(
        mix(field[c + a], field[c + b], tx),
        mix(field[d + a], field[d + b], tx),
        tz,
    );
};

// Stones: broken, so each is a few flat faces under a worn top. Small ones
// collect where the sand has blown off; big ones lie anywhere.
const bare = Float32Array.from(height);
const stones = [];
for (const [per, least, most, shy] of [
    [190, 0.006, 0.014, 0.8],
    [26, 0.015, 0.036, 0.55],
    [1.9, 0.04, 0.09, 0.1],
]) {
    const wanted = Math.round(per * SPAN * SPAN);
    for (
        let tries = 0, made = 0;
        made < wanted && tries < wanted * 6;
        tries++
    ) {
        const x = random() * SPAN,
            z = random() * SPAN;
        // Stones gather in patches, as a lag left behind by the wind.
        const patch = smoothstep(
            -0.35,
            0.3,
            cloud(x / SPAN, z / SPAN, 7, 3, 200),
        );
        if (random() > (1 - shy * sample(sanded, x, z)) * (0.25 + 0.75 * patch))
            continue;
        made++;
        const radius = least + (most - least) * random() ** 2.2;
        const faces = [];
        const sides = 5 + Math.floor(random() * 4);
        for (let side = 0; side < sides; side++) {
            const turn = ((side + random() * 0.7) / sides) * Math.PI * 2;
            faces.push([
                Math.cos(turn),
                Math.sin(turn),
                radius * (0.62 + 0.38 * random()),
            ]);
        }
        stones.push({
            x,
            z,
            radius,
            faces,
            tall: radius * (0.5 + 0.55 * random()),
            sunk: 0.2 + 0.35 * random(),
            lean: [(random() - 0.5) * 0.5, (random() - 0.5) * 0.5],
            tone:
                random() < 0.16 ? 1.25 + 0.3 * random() : 0.5 + 0.4 * random(),
        });
    }
}
for (const rock of stones) {
    const base = sample(bare, rock.x, rock.z) - rock.tall * rock.sunk;
    const reach = Math.ceil(rock.radius / TEXEL) + 1,
        cx = Math.floor(rock.x / TEXEL),
        cz = Math.floor(rock.z / TEXEL);
    for (let dz = -reach; dz <= reach; dz++)
        for (let dx = -reach; dx <= reach; dx++) {
            const px = (cx + dx + 0.5) * TEXEL - rock.x,
                pz = (cz + dz + 0.5) * TEXEL - rock.z;
            let out = 0;
            for (const [nx, nz, far] of rock.faces)
                out = Math.max(out, (px * nx + pz * nz) / far);
            if (out >= 1) continue;
            const top =
                base +
                rock.tall *
                    (1 - out ** 3.2) ** 0.7 *
                    (1 + (px * rock.lean[0] + pz * rock.lean[1]) / rock.radius);
            const at = wrap(cz + dz, SIZE) * SIZE + wrap(cx + dx, SIZE);
            if (top <= height[at]) continue;
            height[at] = top;
            stone[at] = 1;
            pale[at] = rock.tone;
        }
}

/** A blur over `reach` texels each way, three passes, joining at the edges. */
const blurred = (field, reach) => {
    let from = Float32Array.from(field),
        to = new Float32Array(count);
    const width = reach * 2 + 1;
    for (let pass = 0; pass < 3; pass++) {
        // Along each row, then along each column.
        for (const stepX of [1, 0]) {
            for (let line = 0; line < SIZE; line++) {
                let sum = 0;
                const index = (along) =>
                    stepX
                        ? line * SIZE + wrap(along, SIZE)
                        : wrap(along, SIZE) * SIZE + line;
                for (let along = -reach; along <= reach; along++)
                    sum += from[index(along)];
                for (let along = 0; along < SIZE; along++) {
                    to[index(along)] = sum / width;
                    sum +=
                        from[index(along + reach + 1)] -
                        from[index(along - reach)];
                }
            }
            [from, to] = [to, from];
        }
    }
    return from;
};

// Slopes, the hollows that see less sky, and the sun's shadow.
const slopeX = new Uint8Array(count),
    slopeZ = new Uint8Array(count),
    sunlit = new Uint8Array(count),
    colour = new Uint8Array(count * 3);
const level = blurred(height, Math.round(0.035 / TEXEL));
const flat = Math.hypot(SUN[0], SUN[2]),
    toSun = [SUN[0] / flat, SUN[2] / flat],
    climb = SUN[1] / flat;
const strides = [];
for (
    let stride = 1;
    stride * TEXEL < 0.75;
    stride = Math.max(stride + 1, stride * 1.09)
)
    strides.push(stride);
const srgb = (linear) =>
    Math.round(
        255 *
            clamp(
                linear <= 0.0031308
                    ? linear * 12.92
                    : 1.055 * linear ** (1 / 2.4) - 0.055,
                0,
                1,
            ),
    );
const encode = (slope) =>
    Math.round(255 * clamp(0.5 + slope / (2 * STEEPEST), 0, 1));
for (let row = 0; row < SIZE; row++)
    for (let column = 0; column < SIZE; column++) {
        const at = row * SIZE + column;
        const left = row * SIZE + wrap(column - 1, SIZE),
            right = row * SIZE + wrap(column + 1, SIZE),
            back = wrap(row - 1, SIZE) * SIZE + column,
            front = wrap(row + 1, SIZE) * SIZE + column;
        const dx = (height[right] - height[left]) / (2 * TEXEL),
            dz = (height[front] - height[back]) / (2 * TEXEL);
        slopeX[at] = encode(dx);
        slopeZ[at] = encode(dz);
        // Toward the sun: does anything stand above its ray?
        const x = (column + 0.5) * TEXEL,
            z = (row + 0.5) * TEXEL,
            here = height[at];
        let over = -1;
        for (const stride of strides) {
            const reach = stride * TEXEL;
            const rise =
                (sample(height, x + toSun[0] * reach, z + toSun[1] * reach) -
                    here) /
                reach;
            if (rise > over) over = rise;
        }
        // Ground that leans from the sun is shaded by itself already; the
        // band here is only wide enough to keep the shadow's edge smooth.
        sunlit[at] = Math.round(
            255 * (1 - smoothstep(climb - 0.03, climb + 0.05, over)),
        );
        const hollow = clamp(1 + (here - level[at]) * 22, 0.5, 1.12);
        const steep = Math.hypot(dx, dz);
        // Dust settles on whatever lies level and is blown off the rest.
        const dusty = 0.35 * (1 - smoothstep(0.15, 0.7, steep));
        const rockTone = [0.34, 0.285, 0.225].map((part) => part * tone[at]),
            sandTone = [0.245, 0.178, 0.126].map((part) => part * tone[at]);
        let shade = rockTone.map((part, index) =>
            mix(part, sandTone[index], sanded[at]),
        );
        if (stone[at])
            shade =
                pale[at] > 1
                    ? [0.33, 0.29, 0.24].map((part) => part * (pale[at] - 0.25))
                    : [0.13, 0.115, 0.105].map(
                          (part) => part * (pale[at] + 0.5),
                      );
        const dust = [0.33, 0.24, 0.165];
        for (let part = 0; part < 3; part++)
            colour[at * 3 + part] = srgb(
                mix(shade[part], dust[part], dusty) * hollow,
            );
    }

await mkdir(OUT, { recursive: true });
const grey = (data, name, quality) =>
    sharp(data, { raw: { width: SIZE, height: SIZE, channels: 1 } })
        .webp({ quality, effort: 6 })
        .toFile(`${OUT}/${name}.webp`);
const written = await Promise.all([
    sharp(colour, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .webp({ quality: 84, effort: 6 })
        .toFile(`${OUT}/colour.webp`),
    grey(slopeX, "slope-x", 86),
    grey(slopeZ, "slope-z", 86),
    grey(sunlit, "sun", 80),
]);
await writeFile(
    `${OUT}/floor.json`,
    `${JSON.stringify(
        {
            metres: SPAN,
            size: SIZE,
            steepest: STEEPEST,
            sun: SUN,
            files: {
                colour: "colour.webp",
                slopeX: "slope-x.webp",
                slopeZ: "slope-z.webp",
                sun: "sun.webp",
            },
        },
        null,
        4,
    )
        // A short list on one line, as the repository's formatter keeps it.
        .replace(
            /\[\s+([^[\]{}]+?)\s+\]/g,
            (_list, items) => `[${items.split(/,\s+/).join(", ")}]`,
        )}\n`,
);
console.log(
    `floor ${SIZE} px over ${SPAN} m, ${stones.length} stones,`,
    written.map((file) => `${Math.round(file.size / 1024)} KB`).join(" + "),
);

// A picture of the square under its sun, for judging it without the site.
if (process.env.FLOOR_PREVIEW) {
    const lit = new Uint8Array(count * 3);
    const light = SUN.map((part) => part / Math.hypot(...SUN));
    for (let at = 0; at < count; at++) {
        const dx = (slopeX[at] / 255 - 0.5) * 2 * STEEPEST,
            dz = (slopeZ[at] / 255 - 0.5) * 2 * STEEPEST;
        const long = Math.hypot(dx, 1, dz);
        const facing =
            Math.max(0, (-dx * light[0] + light[1] - dz * light[2]) / long) *
            (sunlit[at] / 255);
        for (let part = 0; part < 3; part++) {
            const albedo = (colour[at * 3 + part] / 255) ** 2.2;
            lit[at * 3 + part] = srgb(
                albedo *
                    (facing * 9 * [1, 0.69, 0.42][part] +
                        0.22 * [0.6, 0.7, 1][part]),
            );
        }
    }
    await sharp(lit, { raw: { width: SIZE, height: SIZE, channels: 3 } })
        .png()
        .toFile(process.env.FLOOR_PREVIEW);
}
