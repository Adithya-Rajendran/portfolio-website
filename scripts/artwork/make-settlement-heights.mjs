import { readFile } from "node:fs/promises";
import sharp from "sharp";

/**
 * How tall the solid hardware of a settlement stands over each patch of its
 * ground, so the Experience page can tell which structures a view can see
 * and name only those. Read from the hardware build's plain (not
 * Draco-compressed) model, which is not kept in the repository:
 *
 *   node scripts/artwork/make-settlement-heights.mjs <moon|mars> <model.glb>
 *
 * Writes assets/scenes/settlements/<world>/heights.png, which
 * make-settlement-ground.mjs folds into the site's description. Each pixel
 * is one square of ground; its value times STEP is the height in metres.
 */
const SPAN = 512;
const CELLS = 128;
const SQUARE = SPAN / CELLS;
const STEP = 0.25;
/** Hardware is weighed in layers this deep, in metres. */
const LAYER = 2;
/**
 * A layer over a square hides what is behind it when it holds this much
 * surface, in square metres: a wall does, a lamp post or a lattice mast
 * does not.
 */
const SOLID = 6;
/** Surfaces are sampled at points no farther apart than this, in metres. */
const SAMPLE = 0.5;
/** Fixed hardware only, and nothing that can be seen through. */
const FIXED = "static";
const CLEAR = /_(glass|pane)$/;

const [world, file] = process.argv.slice(2);
if (!["moon", "mars"].includes(world) || !file) {
    console.error(
        "usage: make-settlement-heights.mjs <moon|mars> <plain model.glb>",
    );
    process.exit(1);
}

const glb = await readFile(file);
const described = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + described).toString("utf8"));
const binary = glb.subarray(20 + described + 8);

const placed = (node) => {
    if (node.matrix) return node.matrix;
    const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1],
        [sx, sy, sz] = node.scale ?? [1, 1, 1],
        [tx, ty, tz] = node.translation ?? [0, 0, 0];
    return [
        (1 - 2 * (y * y + z * z)) * sx,
        2 * (x * y + z * w) * sx,
        2 * (x * z - y * w) * sx,
        0,
        2 * (x * y - z * w) * sy,
        (1 - 2 * (x * x + z * z)) * sy,
        2 * (y * z + x * w) * sy,
        0,
        2 * (x * z + y * w) * sz,
        2 * (y * z - x * w) * sz,
        (1 - 2 * (x * x + y * y)) * sz,
        0,
        tx,
        ty,
        tz,
        1,
    ];
};
const times = (a, b) => {
    const out = new Array(16).fill(0);
    for (let column = 0; column < 4; column++)
        for (let row = 0; row < 4; row++)
            for (let k = 0; k < 4; k++)
                out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    return out;
};
const KINDS = {
    5126: [Float32Array, "getFloat32"],
    5125: [Uint32Array, "getUint32"],
    5123: [Uint16Array, "getUint16"],
    5121: [Uint8Array, "getUint8"],
};
const values = (index) => {
    const accessor = gltf.accessors[index],
        view = gltf.bufferViews[accessor.bufferView];
    if (view === undefined || gltf.bufferViews[accessor.bufferView].extensions)
        throw new Error("the model is compressed: pass the plain .glb");
    const size = { SCALAR: 1, VEC3: 3 }[accessor.type];
    const [Kind, get] = KINDS[accessor.componentType];
    const stride = view.byteStride ?? Kind.BYTES_PER_ELEMENT * size;
    const data = new DataView(
        binary.buffer,
        binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    );
    const out = new Kind(accessor.count * size);
    for (let i = 0; i < accessor.count; i++)
        for (let k = 0; k < size; k++)
            out[i * size + k] = data[get](
                i * stride + k * Kind.BYTES_PER_ELEMENT,
                true,
            );
    return out;
};

const layers = Math.ceil((255 * STEP) / LAYER);
/** Surface in each layer over each square, and the highest point in it. */
const surface = new Float32Array(CELLS * CELLS * layers),
    highest = new Float32Array(CELLS * CELLS * layers);
const weigh = (x, y, z, area) => {
    const column = Math.floor((x + SPAN / 2) / SQUARE),
        row = Math.floor((z + SPAN / 2) / SQUARE),
        layer = Math.floor(y / LAYER);
    if (column < 0 || row < 0 || column >= CELLS || row >= CELLS) return;
    if (layer < 0 || layer >= layers) return;
    const at = (row * CELLS + column) * layers + layer;
    surface[at] += area;
    highest[at] = Math.max(highest[at], y);
};
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

const walk = (index, parent, fixed) => {
    const node = gltf.nodes[index];
    const matrix = times(parent, placed(node));
    fixed ||= node.name === FIXED;
    if (fixed && node.mesh !== undefined && !CLEAR.test(node.name ?? ""))
        for (const primitive of gltf.meshes[node.mesh].primitives) {
            const position = values(primitive.attributes.POSITION);
            const order =
                primitive.indices === undefined
                    ? null
                    : values(primitive.indices);
            const corner = (i) => {
                const x = position[i * 3],
                    y = position[i * 3 + 1],
                    z = position[i * 3 + 2];
                return [
                    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
                    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
                    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
                ];
            };
            const total = order ? order.length : position.length / 3;
            for (let i = 0; i < total; i += 3) {
                const a = corner(order ? order[i] : i),
                    b = corner(order ? order[i + 1] : i + 1),
                    c = corner(order ? order[i + 2] : i + 2);
                const ab = length(a, b),
                    ac = length(a, c),
                    bc = length(b, c);
                const half = (ab + ac + bc) / 2;
                const area = Math.sqrt(
                    Math.max(0, half * (half - ab) * (half - ac) * (half - bc)),
                );
                const n = Math.max(1, Math.ceil(Math.max(ab, ac, bc) / SAMPLE));
                const share = area / (((n + 1) * (n + 2)) / 2);
                for (let u = 0; u <= n; u++)
                    for (let v = 0; v <= n - u; v++) {
                        const p = u / n,
                            q = v / n,
                            r = 1 - p - q;
                        weigh(
                            a[0] * r + b[0] * p + c[0] * q,
                            a[1] * r + b[1] * p + c[1] * q,
                            a[2] * r + b[2] * p + c[2] * q,
                            share,
                        );
                    }
            }
        }
    for (const child of node.children ?? []) walk(child, matrix, fixed);
};
const still = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) walk(root, still, false);

const pixels = Buffer.alloc(CELLS * CELLS);
let tallest = 0,
    built = 0;
for (let square = 0; square < CELLS * CELLS; square++)
    for (let layer = layers - 1; layer >= 0; layer--) {
        const at = square * layers + layer;
        if (surface[at] < SOLID) continue;
        pixels[square] = Math.min(255, Math.round(highest[at] / STEP));
        tallest = Math.max(tallest, highest[at]);
        if (highest[at] > 2) built++;
        break;
    }
const out = `assets/scenes/settlements/${world}/heights.png`;
await sharp(pixels, { raw: { width: CELLS, height: CELLS, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
console.log(
    `${world}: ${out} written; ${built} squares stand over 2 m, the tallest ${tallest.toFixed(1)} m`,
);
