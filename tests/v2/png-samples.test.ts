import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { readPngSamples } from "../../src/lib/png-samples";

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const chunk = (type: string, body: Uint8Array | number[]) => {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set(
        [...type].map((c) => c.charCodeAt(0)),
        4,
    );
    out.set(body, 8);
    // The reader does not verify CRCs; they stay zero.
    return out;
};

const header = (
    width: number,
    height: number,
    depth: number,
    colour: number,
    interlace = 0,
) => {
    const body = new Uint8Array(13);
    const view = new DataView(body.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    body.set([depth, colour, 0, 0, interlace], 8);
    return chunk("IHDR", body);
};

const join = (parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
};

const toBuffer = (bytes: Uint8Array) =>
    bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

/** The forward PNG filter of one row; `pixel` is bytes per pixel. */
const filterRow = (
    type: number,
    row: Uint8Array,
    above: Uint8Array,
    pixel: number,
) =>
    row.map((value, x) => {
        const left = x >= pixel ? row[x - pixel] : 0;
        const up = above[x];
        const corner = x >= pixel ? above[x - pixel] : 0;
        let predicted = 0;
        if (type === 1) predicted = left;
        else if (type === 2) predicted = up;
        else if (type === 3) predicted = Math.floor((left + up) / 2);
        else if (type === 4) {
            const estimate = left + up - corner;
            const a = Math.abs(estimate - left),
                b = Math.abs(estimate - up),
                c = Math.abs(estimate - corner);
            predicted = a <= b && a <= c ? left : b <= c ? up : corner;
        }
        return (value - predicted) & 255;
    });

/** Scanline bytes (filter byte plus filtered row) for raw rows. */
const scanlines = (
    rows: Uint8Array[],
    pixel: number,
    filters: number[],
    filterOverride?: number[],
) =>
    join(
        rows.map((row, y) => {
            const type = filters[y % filters.length];
            const above = y ? rows[y - 1] : new Uint8Array(row.length);
            return join([
                Uint8Array.of(filterOverride ? filterOverride[y] : type),
                filterRow(type, row, above, pixel),
            ]);
        }),
    );

const png = (
    ihdr: Uint8Array,
    compressed: Uint8Array,
    split: number[] = [],
) => {
    const parts: Uint8Array[] = [];
    let from = 0;
    for (const end of [...split, compressed.length]) {
        parts.push(chunk("IDAT", compressed.subarray(from, end)));
        from = end;
    }
    return toBuffer(
        join([Uint8Array.from(SIGNATURE), ihdr, ...parts, chunk("IEND", [])]),
    );
};

const deflate = (raw: Uint8Array) => new Uint8Array(deflateSync(raw));

const WIDTH = 6,
    HEIGHT = 5;
/** Non-trivial RGB values with both smooth and abrupt changes. */
const rgbRows = () =>
    Array.from({ length: HEIGHT }, (_, y) =>
        Uint8Array.from({ length: WIDTH * 3 }, (_, i) =>
            i % 7 === 0
                ? (i * 53 + y * 97) % 256
                : (i * 11 + y * 29 + (y % 2 ? 200 : 0)) % 256,
        ),
    );

describe("readPngSamples", () => {
    describe("8-bit RGB", () => {
        const rows = rgbRows();
        const expected = join(rows);
        it.each([0, 1, 2, 3, 4])("decodes filter type %i", async (filter) => {
            const file = png(
                header(WIDTH, HEIGHT, 8, 2),
                deflate(scanlines(rows, 3, [filter])),
            );
            const result = await readPngSamples(file);
            expect(result.width).toBe(WIDTH);
            expect(result.height).toBe(HEIGHT);
            expect(result.channels).toBe(3);
            expect(result.samples).toBeInstanceOf(Uint8Array);
            expect(Array.from(result.samples)).toEqual(Array.from(expected));
        });

        it("decodes an image with a different filter on each row", async () => {
            const file = png(
                header(WIDTH, HEIGHT, 8, 2),
                deflate(scanlines(rows, 3, [0, 1, 2, 3, 4])),
            );
            const result = await readPngSamples(file);
            expect(Array.from(result.samples)).toEqual(Array.from(expected));
        });
    });

    it("decodes 16-bit greyscale to exact Uint16 values", async () => {
        const values = [
            [0, 255, 0xff00, 0x1234, 65535, 1],
            [65535, 0x00ff, 0, 0x8000, 0x7fff, 0x1234],
            [0x1234, 0xff00, 0x00ff, 65535, 0, 42],
            [1, 2, 3, 65534, 65535, 0xff00],
        ];
        const rows = values.map((row) =>
            Uint8Array.from(row.flatMap((v) => [v >> 8, v & 255])),
        );
        const file = png(
            header(6, 4, 16, 0),
            deflate(scanlines(rows, 2, [0, 4, 4, 1])),
        );
        const result = await readPngSamples(file);
        expect(result.channels).toBe(1);
        expect(result.samples).toBeInstanceOf(Uint16Array);
        expect(Array.from(result.samples)).toEqual(values.flat());
    });

    it("decodes 8-bit greyscale", async () => {
        const rows = [
            Uint8Array.of(0, 10, 200, 255, 7),
            Uint8Array.of(255, 128, 3, 0, 99),
            Uint8Array.of(50, 51, 52, 250, 1),
        ];
        const file = png(
            header(5, 3, 8, 0),
            deflate(scanlines(rows, 1, [1, 2, 4])),
        );
        const result = await readPngSamples(file);
        expect(result.channels).toBe(1);
        expect(result.samples).toBeInstanceOf(Uint8Array);
        expect(Array.from(result.samples)).toEqual(Array.from(join(rows)));
    });

    it("joins an IDAT stream split across several chunks", async () => {
        const rows = rgbRows();
        const compressed = deflate(scanlines(rows, 3, [4, 3, 2, 1, 0]));
        // One byte, then an uneven middle, leaving a two-byte last chunk.
        const split = [1, 2, 11, compressed.length - 2];
        expect(split.every((at) => at < compressed.length)).toBe(true);
        const result = await readPngSamples(
            png(header(WIDTH, HEIGHT, 8, 2), compressed, split),
        );
        expect(Array.from(result.samples)).toEqual(Array.from(join(rows)));
    });

    describe("rejections", () => {
        const rows = rgbRows();
        const data = deflate(scanlines(rows, 3, [0]));

        it("rejects a wrong signature", async () => {
            const bytes = new Uint8Array(
                png(header(WIDTH, HEIGHT, 8, 2), data),
            );
            bytes[1] = 0x41;
            await expect(readPngSamples(toBuffer(bytes))).rejects.toThrow();
        });

        it("rejects interlaced images", async () => {
            await expect(
                readPngSamples(png(header(WIDTH, HEIGHT, 8, 2, 1), data)),
            ).rejects.toThrow();
        });

        it("rejects palette colour", async () => {
            await expect(
                readPngSamples(png(header(WIDTH, HEIGHT, 8, 3), data)),
            ).rejects.toThrow();
        });

        it("rejects a bit depth of 4", async () => {
            await expect(
                readPngSamples(png(header(WIDTH, HEIGHT, 4, 2), data)),
            ).rejects.toThrow();
        });

        it("rejects truncated pixel data", async () => {
            const short = deflate(scanlines(rows.slice(0, HEIGHT - 1), 3, [0]));
            await expect(
                readPngSamples(png(header(WIDTH, HEIGHT, 8, 2), short)),
            ).rejects.toThrow();
        });

        it("rejects an unknown filter byte", async () => {
            const bad = deflate(scanlines(rows, 3, [0], [0, 0, 5, 0, 0]));
            await expect(
                readPngSamples(png(header(WIDTH, HEIGHT, 8, 2), bad)),
            ).rejects.toThrow();
        });
    });
});
