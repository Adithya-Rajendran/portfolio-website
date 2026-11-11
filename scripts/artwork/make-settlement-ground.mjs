import { mkdir, readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
import sharp from "sharp";

/**
 * The ground the Moon and Mars settlements stand on, as the Experience page
 * draws it: one map of each whole site (craters or ripple fields outside the
 * town, graded and rutted ground inside it, the shade the hardware keeps off
 * the soil) and, for the Moon, one square of regolith that repeats under it
 * at the scale of a wheel. Nothing here is measured. It is made the way the
 * landers' and rovers' cameras show such ground.
 *
 * The sun never moves over a settlement, so the shadow each crater rim and
 * ripple throws is worked out here too.
 *
 * Each site is described by the files the hardware build hands over, in
 * assets/scenes/settlements/<world>/: `site.json` (pads, vehicle lanes, blast
 * zones, labels), `ground-ao.png` (how much sky the hardware leaves each
 * ground point) and `ground-contact.png` (where hardware touches the ground).
 * The two pictures are optional; without them the ground is open and bare.
 * `heights.png`, from make-settlement-heights.mjs, is optional too: with it
 * the site names only the structures a view can see.
 *
 *   node scripts/artwork/make-settlement-ground.mjs [moon|mars]
 */
const SIZE = 2048;
/** Metres along a side of a site map, centred on the settlement's origin. */
const SPAN = 512;
const TEXEL = SPAN / SIZE;
/** Slopes are stored over this range either side of level. */
const STEEPEST = 1;
/** Metres to each step of heights.png (see make-settlement-heights.mjs). */
const HEIGHT_STEP = 0.25;
/** Beyond this distance from the origin a site map says nothing. */
const REACH = [222, 250];

const WORLDS = {
    moon: {
        // Toward the sun, in the settlement's own axes (see experience.ts).
        sun: [0.845, 0.506, 0.171],
        seed: 1969,
        relief: 1.5,
        craters: {
            count: 5200,
            smallest: 0.6,
            largest: 30,
            depth: 0.36,
            large: 46,
        },
        fine: 0.055,
        ripples: 0,
        // The town's compacted soil, vehicle lanes and blast zones, as a
        // change of tone. A descent engine leaves lunar soil brighter.
        tones: { town: -0.035, lane: -0.1, blast: 0.13, apron: -0.05 },
        tails: 0,
    },
    mars: {
        sun: [0.923, 0.342, 0.176],
        seed: 2031,
        relief: 1.2,
        craters: {
            count: 260,
            smallest: 1.2,
            largest: 22,
            depth: 0.14,
            large: 7,
        },
        fine: 0.05,
        ripples: 0.22,
        // On Mars an engine blows the bright dust off darker ground.
        tones: { town: -0.03, lane: -0.11, blast: -0.17, apron: -0.04 },
        tails: 0.07,
    },
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const smoothstep = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
};
const mix = (from, to, t) => from + (to - from) * t;
const wrap = (value, period) => ((value % period) + period) % period;

const hash = (x, y, seed) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = (h + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
};
const dice = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};
/** Smooth noise, -1 to 1; with a `period` it repeats after that many cells. */
const noise = (x, y, seed, period = 0) => {
    const x0 = Math.floor(x),
        y0 = Math.floor(y),
        fx = x - x0,
        fy = y - y0;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10),
        v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const at = (dx, dy) =>
        period
            ? hash(wrap(x0 + dx, period), wrap(y0 + dy, period), seed)
            : hash(x0 + dx, y0 + dy, seed);
    return (
        mix(mix(at(0, 0), at(1, 0), u), mix(at(0, 1), at(1, 1), u), v) * 2 - 1
    );
};
const cloud = (x, y, layers, seed, period = 0) => {
    let total = 0,
        weight = 0;
    for (let layer = 0; layer < layers; layer++) {
        const scale = 2 ** layer,
            share = 0.5 ** layer;
        total +=
            noise(x * scale, y * scale, seed + layer, period * scale) * share;
        weight += share;
    }
    return total / weight;
};

/**
 * One crater pressed into `height` and its ejecta laid on `tone`. `fresh` is
 * how little it has worn, 0 to 1. Lengths are in texels; with `period` the
 * picture repeats and the crater wraps round its edges.
 */
function crater(height, tone, size, period, cx, cy, radius, depth, fresh) {
    const reach = Math.ceil(radius * 2.9);
    // Almost every crater here is old: slumped into a dish with no edge to
    // it. Only a young one keeps a lip, a bowl and its bright ejecta.
    const sharp = fresh ** 0.8,
        young = smoothstep(0.6, 0.95, fresh),
        rim = radius * 0.045 * sharp;
    // No crater is a circle.
    const lobes = 2 + Math.floor(hash(Math.round(cx), Math.round(cy), 5) * 4),
        skew = hash(Math.round(cx), Math.round(cy), 6) * 6.283,
        soft = 0.2 + 0.3 * (1 - fresh);
    for (let dy = -reach; dy <= reach; dy++) {
        let y = Math.round(cy) + dy;
        if (period) y = wrap(y, size);
        else if (y < 0 || y >= size) continue;
        for (let dx = -reach; dx <= reach; dx++) {
            let x = Math.round(cx) + dx;
            if (period) x = wrap(x, size);
            else if (x < 0 || x >= size) continue;
            const ox = Math.round(cx) + dx - cx,
                oy = Math.round(cy) + dy - cy,
                turn = Math.atan2(oy, ox);
            const d =
                Math.hypot(ox, oy) /
                (radius *
                    (1 +
                        0.045 * Math.sin(turn * lobes + skew) +
                        0.025 * Math.sin(turn * (lobes + 3) - skew * 2)));
            if (d > 2.6) continue;
            const at = y * size + x;
            // Every term meets its neighbour without a crease: a crease in
            // the ground is a line in the light.
            const bowl = d < 1 ? -((1 - d * d) ** 1.5) : 0,
                dish = -Math.exp(-((d / 0.74) ** 2));
            const lip =
                rim * Math.exp(-(((d - 1) / (d < 1 ? soft : soft * 2.4)) ** 2));
            height[at] +=
                depth *
                    radius *
                    (0.42 + 0.58 * fresh) *
                    mix(dish, bowl, sharp) +
                lip;
            if (tone && young > 0) {
                // Fresh soil thrown out in rays, brighter than what it fell on.
                const ray =
                    0.55 +
                    0.45 *
                        Math.sin(turn * (lobes * 3 + 5) + skew * 3) *
                        Math.sin(turn * (lobes + 4) - skew);
                tone[at] +=
                    young *
                    0.075 *
                    (d < 1
                        ? 0.3 + 0.5 * d * d
                        : 0.8 *
                          mix(1, ray, smoothstep(1, 1.6, d)) *
                          Math.exp(-(d - 1) / 0.7));
            }
        }
    }
}

/** Slopes of a height field, central differences; `period` wraps the edges. */
function slopes(height, size, texel, period) {
    const sx = new Float32Array(size * size),
        sz = new Float32Array(size * size);
    const at = (x, y) =>
        period
            ? height[wrap(y, size) * size + wrap(x, size)]
            : height[clamp(y, 0, size - 1) * size + clamp(x, 0, size - 1)];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            sx[y * size + x] = (at(x + 1, y) - at(x - 1, y)) / (2 * texel);
            sz[y * size + x] = (at(x, y + 1) - at(x, y - 1)) / (2 * texel);
        }
    return [sx, sz];
}

/** A cheap box blur, three passes, good enough for a gaussian. */
function blurred(field, size, radius, period) {
    let from = Float32Array.from(field),
        to = new Float32Array(field.length);
    const pick = (i) => (period ? wrap(i, size) : clamp(i, 0, size - 1));
    for (let pass = 0; pass < 3; pass++)
        for (const stepX of [1, 0]) {
            for (let y = 0; y < size; y++)
                for (let x = 0; x < size; x++) {
                    let total = 0;
                    for (let k = -radius; k <= radius; k++)
                        total += stepX
                            ? from[y * size + pick(x + k)]
                            : from[pick(y + k) * size + x];
                    to[y * size + x] = total / (2 * radius + 1);
                }
            [from, to] = [to, from];
        }
    return from;
}

/** How much of the sun reaches each texel past the relief around it. */
function sunlit(height, size, texel, sun, reach, period) {
    const flat = Math.hypot(sun[0], sun[2]),
        climb = sun[1] / flat,
        stepX = sun[0] / flat,
        stepZ = sun[2] / flat;
    const lit = new Float32Array(size * size);
    const at = (x, y) => {
        const x0 = Math.floor(x),
            y0 = Math.floor(y),
            fx = x - x0,
            fy = y - y0;
        const h = (ix, iy) =>
            period
                ? height[wrap(iy, size) * size + wrap(ix, size)]
                : height[
                      clamp(iy, 0, size - 1) * size + clamp(ix, 0, size - 1)
                  ];
        return mix(
            mix(h(x0, y0), h(x0 + 1, y0), fx),
            mix(h(x0, y0 + 1), h(x0 + 1, y0 + 1), fx),
            fy,
        );
    };
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const here = height[y * size + x];
            let over = 0;
            for (let t = 1.5; t < reach; t *= 1.22) {
                const rise =
                    at(x + stepX * t, y + stepZ * t) -
                    (here + climb * t * texel);
                // A soft edge that widens with distance, as a real one does.
                over = Math.max(over, rise / (0.02 + 0.012 * t * texel));
                if (over >= 1) break;
            }
            lit[y * size + x] = 1 - smoothstep(0, 1, over);
        }
    return lit;
}

const grey = (field, size, scale, offset = 0) => {
    const bytes = Buffer.alloc(size * size);
    for (let i = 0; i < bytes.length; i++)
        bytes[i] = clamp(Math.round(offset + field[i] * scale), 0, 255);
    return bytes;
};
const picture = (channels, size, file, quality) => {
    const bytes = Buffer.alloc(size * size * channels.length);
    for (let i = 0; i < size * size; i++)
        for (let c = 0; c < channels.length; c++)
            bytes[i * channels.length + c] = channels[c][i];
    return sharp(bytes, {
        raw: { width: size, height: size, channels: channels.length },
    })
        .webp({ quality, smartSubsample: true, effort: 5 })
        .toFile(file);
};
const half = (file, to, size, quality) =>
    sharp(file)
        .resize(size / 2, size / 2, { kernel: "lanczos3" })
        .webp({ quality, smartSubsample: true, effort: 5 })
        .toFile(to);
// Written as the repository's formatter would leave them, so a fresh run
// never fails the formatting check.
const manifest = (value) =>
    format(JSON.stringify(value), { parser: "json", tabWidth: 4 });

async function site(world) {
    const look = WORLDS[world],
        random = dice(look.seed);
    const source = `assets/scenes/settlements/${world}/`,
        out = `public/terrain/${world}-site-v1/`;
    const plan = JSON.parse(await readFile(`${source}site.json`, "utf8"));
    const given = async (name) => {
        try {
            const { data, info } = await sharp(`${source}${name}`)
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });
            if (info.width !== SIZE || info.height !== SIZE)
                throw new Error(`${name} is not ${SIZE} px square`);
            return data;
        } catch (error) {
            if (error.message.includes("square")) throw error;
            return undefined;
        }
    };
    const occluded = await given("ground-ao.png"),
        touched = await given("ground-contact.png");
    // How tall the solid hardware stands over each square of the site.
    let heights;
    try {
        const { data, info } = await sharp(`${source}heights.png`)
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
        if (info.width !== info.height)
            throw new Error("heights.png is not square");
        heights = {
            cells: info.width,
            step: HEIGHT_STEP,
            data: data.toString("base64"),
        };
    } catch (error) {
        if (error.message.includes("square")) throw error;
    }
    const count = SIZE * SIZE;
    const metres = (texel) => -SPAN / 2 + (texel + 0.5) * TEXEL;
    const texels = (metre) => (metre + SPAN / 2) / TEXEL - 0.5;

    // Where the ground has been worked: under hardware, on pads, along lanes.
    const lane = new Float32Array(count).fill(Infinity);
    for (const { points, width = 5 } of plan.lanes ?? [])
        for (let i = 0; i + 1 < points.length; i++) {
            const [ax, az] = points[i],
                [bx, bz] = points[i + 1];
            const margin = width / 2 + 8;
            const x0 = Math.max(
                    0,
                    Math.floor(texels(Math.min(ax, bx) - margin)),
                ),
                x1 = Math.min(
                    SIZE - 1,
                    Math.ceil(texels(Math.max(ax, bx) + margin)),
                ),
                y0 = Math.max(0, Math.floor(texels(Math.min(az, bz) - margin))),
                y1 = Math.min(
                    SIZE - 1,
                    Math.ceil(texels(Math.max(az, bz) + margin)),
                );
            const lx = bx - ax,
                lz = bz - az,
                length = lx * lx + lz * lz || 1;
            for (let y = y0; y <= y1; y++)
                for (let x = x0; x <= x1; x++) {
                    const px = metres(x) - ax,
                        pz = metres(y) - az;
                    const along = clamp((px * lx + pz * lz) / length, 0, 1);
                    // Distance from the lane's edge, negative inside it.
                    const off =
                        Math.hypot(px - lx * along, pz - lz * along) -
                        width / 2;
                    const at = y * SIZE + x;
                    if (off < lane[at]) lane[at] = off;
                }
        }
    const worked = new Uint8Array(count);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const at = y * SIZE + x;
            // A lane is only a track: nobody graded the ground beside it.
            if (touched && touched[at] > 127) worked[at] = 1;
            else
                for (const pad of plan.pads ?? [])
                    if (
                        Math.hypot(metres(x) - pad.x, metres(y) - pad.z) <
                        pad.radius
                    ) {
                        worked[at] = 1;
                        break;
                    }
        }
    // Distance to worked ground, two sweeps (texels, then metres).
    const far = new Float32Array(count);
    for (let i = 0; i < count; i++) far[i] = worked[i] ? 0 : 1e6;
    const sweep = (from, to, step) => {
        for (let y = from; y !== to; y += step)
            for (let x = from; x !== to; x += step) {
                const at = y * SIZE + x;
                let best = far[at];
                const px = x - step,
                    py = y - step,
                    nx = x + step;
                if (px >= 0 && px < SIZE)
                    best = Math.min(best, far[at - step] + 1);
                if (py >= 0 && py < SIZE) {
                    best = Math.min(best, far[at - step * SIZE] + 1);
                    if (px >= 0 && px < SIZE)
                        best = Math.min(
                            best,
                            far[at - step * SIZE - step] + 1.414,
                        );
                    if (nx >= 0 && nx < SIZE)
                        best = Math.min(
                            best,
                            far[at - step * SIZE + step] + 1.414,
                        );
                }
                far[at] = best;
            }
    };
    sweep(0, SIZE, 1);
    sweep(SIZE - 1, -1, -1);

    const town = new Float32Array(count),
        edge = new Float32Array(count);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const at = y * SIZE + x;
            // Graded round everything built, with a ragged outer limit.
            const ragged =
                cloud(metres(x) / 38, metres(y) / 38, 3, look.seed + 40) * 10;
            town[at] = 1 - smoothstep(5, 30, far[at] * TEXEL + ragged);
            edge[at] =
                1 -
                smoothstep(
                    REACH[0],
                    REACH[1],
                    Math.hypot(metres(x), metres(y)),
                );
        }

    // Natural ground first: swells, craters, ripple fields.
    const height = new Float32Array(count),
        tone = new Float32Array(count);
    for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
            const at = y * SIZE + x,
                mx = metres(x),
                mz = metres(y);
            height[at] =
                cloud(mx / 70, mz / 70, 4, look.seed) * look.relief +
                cloud(mx / 13, mz / 13, 3, look.seed + 5) * look.relief * 0.22 +
                // The soil's own lumps, each one of a kind: at a distance
                // the repeating square cannot be shown without its repeats.
                cloud(mx / 2.6, mz / 2.6, 3, look.seed + 7) * look.fine;
            tone[at] =
                cloud(mx / 55, mz / 55, 5, look.seed + 11) * 0.1 +
                cloud(mx / 3.3, mz / 3.3, 3, look.seed + 12) * 0.03;
            if (look.ripples) {
                // Ridges across the wind, gathered into fields.
                const field = smoothstep(
                    0.05,
                    0.4,
                    cloud(mx / 90, mz / 90, 3, look.seed + 21),
                );
                const bend = cloud(mx / 30, mz / 30, 2, look.seed + 22) * 5;
                const wave =
                    0.5 +
                    0.5 *
                        Math.sin(
                            ((mx * 0.94 + mz * 0.34 + bend) / 4.6) *
                                Math.PI *
                                2,
                        );
                height[at] += look.ripples * field * wave ** 1.6;
                tone[at] += 0.05 * field * (wave - 0.5);
                // Darker, stonier ground between the fields.
                tone[at] -=
                    0.09 *
                    smoothstep(
                        0.1,
                        0.45,
                        cloud(mx / 48, mz / 48, 4, look.seed + 23),
                    ) *
                    (1 - field);
            }
        }
    const { smallest, largest, depth, large } = look.craters;
    for (let i = 0; i < look.craters.count + large; i++) {
        // Many small, few large; then the handful a visitor will remember.
        const radius =
            i < look.craters.count
                ? smallest *
                  (1 - random() * (1 - (smallest / largest) ** 2)) ** -0.5
                : 7 + (largest - 7) * random() ** 1.6;
        const cx = random() * SIZE,
            cy = random() * SIZE,
            fresh = random() ** 3.5;
        const at =
            clamp(Math.round(cy), 0, SIZE - 1) * SIZE +
            clamp(Math.round(cx), 0, SIZE - 1);
        // The town filled in what it was built over; large old craters
        // remain as shallow dishes at its edges.
        if (town[at] > 0.55 && radius < 9) continue;
        if (i >= look.craters.count && town[at] > 0.2) continue;
        // The large ones are old enough to have lost their bright ejecta.
        crater(
            height,
            i < look.craters.count ? tone : undefined,
            SIZE,
            0,
            cx,
            cy,
            radius / TEXEL,
            depth * TEXEL,
            fresh,
        );
    }

    // Then what the settlement did to it.
    const { tones } = look;
    const blast = new Float32Array(count);
    for (const { x: bx, z: bz, radius } of plan.blast ?? [])
        for (let y = 0; y < SIZE; y++)
            for (let x = 0; x < SIZE; x++) {
                const dx = metres(x) - bx,
                    dz = metres(y) - bz,
                    d = Math.hypot(dx, dz) / radius;
                if (d > 1.6) continue;
                // Streaks thrown outward from the middle.
                const turn = Math.atan2(dz, dx);
                const streak =
                    0.6 +
                    0.4 *
                        cloud(
                            (turn / Math.PI) * 14,
                            d * 2.2,
                            3,
                            look.seed + 60,
                            28,
                        );
                const at = y * SIZE + x;
                blast[at] = Math.max(
                    blast[at],
                    (1 - smoothstep(0.25, 1.6, d)) * (d < 0.5 ? 1 : streak),
                );
            }
    for (let i = 0; i < count; i++) {
        const natural = 1 - 0.93 * town[i];
        height[i] *= natural * (1 - 0.7 * blast[i]);
        tone[i] = tone[i] * (1 - 0.5 * town[i]) + tones.town * town[i];
        tone[i] += tones.blast * blast[i];
        const near = far[i] * TEXEL;
        tone[i] += tones.apron * (1 - smoothstep(0.5, 6, near));
        if (lane[i] < 6) {
            // Traffic wanders: no lane keeps a straight edge.
            const x = i % SIZE,
                y = (i - x) / SIZE;
            const wander =
                cloud(metres(x) / 9, metres(y) / 9, 3, look.seed + 70) * 1.1;
            const inside = 1 - smoothstep(-1.3, 1.5, lane[i] + wander);
            tone[i] += tones.lane * inside;
            // Wheel ruts either side of the middle, and a soft shoulder.
            const fromEdge = -lane[i];
            const rut =
                Math.exp(-(((fromEdge - 0.9) / 0.32) ** 2)) +
                0.6 * Math.exp(-(((fromEdge - 1.9) / 0.4) ** 2));
            height[i] -= 0.07 * rut * inside;
            height[i] += 0.05 * Math.exp(-((lane[i] / 0.7) ** 2));
        }
    }
    if (look.tails && touched) {
        // Bright dust gathers in the lee of anything that stands in the wind.
        const lee = [-0.62, 0.78];
        for (let y = 0; y < SIZE; y++)
            for (let x = 0; x < SIZE; x++) {
                let tail = 0;
                for (let t = 2; t < 26; t += 2) {
                    const sx = Math.round(x - (lee[0] * t) / TEXEL),
                        sy = Math.round(y - (lee[1] * t) / TEXEL);
                    if (sx < 0 || sy < 0 || sx >= SIZE || sy >= SIZE) break;
                    if (touched[sy * SIZE + sx] > 127)
                        tail = Math.max(tail, 1 - t / 26);
                }
                tone[y * SIZE + x] +=
                    look.tails * tail * (worked[y * SIZE + x] ? 0 : 1);
            }
    }
    for (let i = 0; i < count; i++) {
        height[i] *= edge[i];
        tone[i] *= edge[i];
    }

    const [sx, sz] = slopes(height, SIZE, TEXEL, false);
    const smooth = blurred(height, SIZE, 10, false);
    const lit = sunlit(height, SIZE, TEXEL, look.sun, 70 / TEXEL, false);
    const open = new Float32Array(count),
        ground = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const hollow = clamp((smooth[i] - height[i]) * 0.6, 0, 0.4);
        open[i] = (1 - hollow) * (occluded ? occluded[i] / 255 : 1);
        ground[i] = Math.max(
            town[i] * 0.55,
            lane[i] < 1 ? 1 - smoothstep(-0.5, 1, lane[i]) : 0,
            1 - smoothstep(0, 5, far[i] * TEXEL),
        );
        ground[i] *= edge[i];
    }

    await mkdir(`${out}half`, { recursive: true });
    // Red: open sky. Green: worked ground. Blue: sun past the relief.
    await picture(
        [grey(open, SIZE, 255), grey(ground, SIZE, 255), grey(lit, SIZE, 255)],
        SIZE,
        `${out}site.webp`,
        88,
    );
    // Red and green: slope along x and z. Blue: lighter or darker soil.
    await picture(
        [
            grey(sx, SIZE, 127 / STEEPEST, 128),
            grey(sz, SIZE, 127 / STEEPEST, 128),
            grey(tone, SIZE, 255, 128),
        ],
        SIZE,
        `${out}relief.webp`,
        90,
    );
    await half(`${out}site.webp`, `${out}half/site.webp`, SIZE, 88);
    await half(`${out}relief.webp`, `${out}half/relief.webp`, SIZE, 90);
    const record = {
        world,
        metres: SPAN,
        steepest: STEEPEST,
        reach: REACH,
        sun: look.sun,
        labels: plan.labels ?? [],
        // The top of each named structure, where the site hangs its name.
        landmarks: (plan.landmarks ?? []).map(({ name, x, y, z }) => ({
            name,
            x: Math.round(x * 10) / 10,
            y: Math.round((y ?? 0) * 10) / 10,
            z: Math.round(z * 10) / 10,
        })),
        ...(heights ? { heights } : {}),
    };
    await writeFile(`${out}site.json`, await manifest(record));
    await writeFile(`${out}half/site.json`, await manifest(record));
    console.log(
        `${world}: site maps written to ${out}${occluded ? "" : " (no hardware shade given)"}`,
    );
}

/**
 * Lunar regolith at the scale of a wheel, in the same four pictures as the
 * homepage's floor (see home-floor.ts): fine soil, the small craters that
 * cover every metre of it, and scattered stones.
 */
async function regolith() {
    const size = 1024,
        span = 12,
        texel = span / size,
        steepest = 2.5;
    const random = dice(7211);
    const height = new Float32Array(size * size),
        tone = new Float32Array(size * size);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const u = x / size,
                v = y / size;
            height[y * size + x] =
                cloud(u * 5, v * 5, 5, 31, 5) * 0.035 +
                cloud(u * 48, v * 48, 3, 37, 48) * 0.004;
            tone[y * size + x] =
                cloud(u * 4, v * 4, 4, 41, 4) * 0.05 +
                cloud(u * 80, v * 80, 2, 43, 80) * 0.03;
        }
    for (let i = 0; i < 150; i++) {
        const radius = 0.07 * (1 - random() * (1 - (0.07 / 1.3) ** 2)) ** -0.5;
        crater(
            height,
            tone,
            size,
            size,
            random() * size,
            random() * size,
            radius / texel,
            0.15 * texel,
            random() ** 2.5,
        );
    }
    for (let i = 0; i < 520; i++) {
        // Stones: a low dome, half sunk, a little darker or lighter.
        const radius = (0.02 + 0.09 * random() ** 3) / texel,
            cx = random() * size,
            cy = random() * size,
            shade = (random() - 0.6) * 0.16,
            squash = 0.6 + random() * 0.5;
        const reach = Math.ceil(radius);
        for (let dy = -reach; dy <= reach; dy++)
            for (let dx = -reach; dx <= reach; dx++) {
                const d =
                    Math.hypot(
                        Math.round(cx) + dx - cx,
                        (Math.round(cy) + dy - cy) / squash,
                    ) / radius;
                if (d >= 1) continue;
                const at =
                    wrap(Math.round(cy) + dy, size) * size +
                    wrap(Math.round(cx) + dx, size);
                height[at] += radius * texel * 0.7 * Math.sqrt(1 - d * d);
                tone[at] += shade * (1 - d * d);
            }
    }
    const [sx, sz] = slopes(height, size, texel, true);
    const smooth = blurred(height, size, 6, true);
    const lit = sunlit(height, size, texel, WORLDS.moon.sun, 2.5 / texel, true);
    const colour = new Float32Array(size * size);
    for (let i = 0; i < colour.length; i++) {
        const hollow = clamp((smooth[i] - height[i]) * 5, 0, 0.2);
        colour[i] = 0.58 * (1 + tone[i]) * (1 - hollow);
    }
    const out = "public/terrain/regolith-v1/";
    await mkdir(`${out}half`, { recursive: true });
    const one = (field, name, scale, offset) =>
        sharp(grey(field, size, scale, offset), {
            raw: { width: size, height: size, channels: 1 },
        })
            .webp({ quality: 90, effort: 5 })
            .toFile(`${out}${name}.webp`);
    await one(sx, "slope-x", 127 / steepest, 128);
    await one(sz, "slope-z", 127 / steepest, 128);
    await one(lit, "sun", 255, 0);
    await one(colour, "colour", 255, 0);
    for (const name of ["slope-x", "slope-z", "sun", "colour"])
        await sharp(`${out}${name}.webp`)
            .resize(size / 2, size / 2, { kernel: "lanczos3" })
            .webp({ quality: 90, effort: 5 })
            .toFile(`${out}half/${name}.webp`);
    const record = { metres: span, steepest, sun: WORLDS.moon.sun };
    await writeFile(`${out}floor.json`, await manifest({ ...record, size }));
    await writeFile(
        `${out}half/floor.json`,
        await manifest({ ...record, size: size / 2 }),
    );
    console.log(`regolith square written to ${out}`);
}

const only = process.argv[2];
if (!only || only === "moon") {
    await site("moon");
    await regolith();
}
if (!only || only === "mars") await site("mars");
