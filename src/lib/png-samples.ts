/**
 * Exact pixel values from a PNG, without a canvas.
 *
 * Elevation is stored in PNG because every tool can open it and it compresses
 * terrain well, but a canvas is the wrong way to read it back: browsers that
 * resist fingerprinting add noise to canvas reads, and one flipped high byte
 * is a metre of height. This reads the file's own bytes instead.
 *
 * Supports what the terrain files use: 8-bit or 16-bit, greyscale or RGB, no
 * interlacing, no palette.
 */
export interface PngSamples {
    width: number;
    height: number;
    /** Samples per pixel: 1 for greyscale, 3 for RGB. */
    channels: number;
    /** Row-major samples; 16-bit files are already combined to one number. */
    samples: Uint8Array | Uint16Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function inflate(parts: Uint8Array[]) {
    const stream = new Blob(parts as BlobPart[])
        .stream()
        .pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readPngSamples(file: ArrayBuffer): Promise<PngSamples> {
    const bytes = new Uint8Array(file);
    const view = new DataView(file);
    if (SIGNATURE.some((value, i) => bytes[i] !== value))
        throw new Error("Not a PNG file");
    let width = 0,
        height = 0,
        depth = 0,
        channels = 0;
    const data: Uint8Array[] = [];
    for (let at = 8; at + 12 <= bytes.length;) {
        const length = view.getUint32(at);
        const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
        const body = at + 8;
        if (type === "IHDR") {
            width = view.getUint32(body);
            height = view.getUint32(body + 4);
            depth = bytes[body + 8];
            const colour = bytes[body + 9];
            channels = colour === 0 ? 1 : colour === 2 ? 3 : 0;
            if (
                !channels ||
                (depth !== 8 && depth !== 16) ||
                bytes[body + 12] !== 0
            )
                throw new Error("Unsupported PNG layout");
        } else if (type === "IDAT")
            data.push(bytes.subarray(body, body + length));
        else if (type === "IEND") break;
        at = body + length + 4;
    }
    if (!width || !height || !data.length) throw new Error("Incomplete PNG");
    const raw = await inflate(data);
    const pixel = (channels * depth) / 8;
    const stride = width * pixel;
    if (raw.length < (stride + 1) * height) throw new Error("Truncated PNG");
    // Undo each row's filter in place; `previous` is the row above.
    const rows = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const from = y * (stride + 1) + 1;
        const to = y * stride;
        const above = to - stride;
        for (let x = 0; x < stride; x++) {
            const left = x >= pixel ? rows[to + x - pixel] : 0;
            const up = y ? rows[above + x] : 0;
            const corner = y && x >= pixel ? rows[above + x - pixel] : 0;
            let predicted = 0;
            if (filter === 1) predicted = left;
            else if (filter === 2) predicted = up;
            else if (filter === 3) predicted = (left + up) >> 1;
            else if (filter === 4) {
                const estimate = left + up - corner;
                const byLeft = Math.abs(estimate - left),
                    byUp = Math.abs(estimate - up),
                    byCorner = Math.abs(estimate - corner);
                predicted =
                    byLeft <= byUp && byLeft <= byCorner
                        ? left
                        : byUp <= byCorner
                          ? up
                          : corner;
            } else if (filter !== 0) throw new Error("Unknown PNG filter");
            rows[to + x] = (raw[from + x] + predicted) & 255;
        }
    }
    if (depth === 8) return { width, height, channels, samples: rows };
    const samples = new Uint16Array(width * height * channels);
    for (let i = 0; i < samples.length; i++)
        samples[i] = (rows[i * 2] << 8) | rows[i * 2 + 1];
    return { width, height, channels, samples };
}
