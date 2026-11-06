import sharp from "sharp";
import { readFile } from "node:fs/promises";

// NASA/JPL-Caltech/MSSS, PIA20840. The source remains unchanged upstream;
// this masked derivative is an artistic backdrop, not a scientific data product.
const source = process.argv[2]
    ? await readFile(process.argv[2])
    : Buffer.from(
          await (
              await fetch(
                  "https://d2pn8kiwq2w21t.cloudfront.net/original_images/jpegPIA20840.jpg",
              )
          ).arrayBuffer(),
      );
const width = 8192,
    cropHeight = 1000;
const { data } = await sharp(source)
    .resize({ width })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
// Trace the actual skyline in a 2048px-wide preview. A global brightness
// threshold confuses pale distant rock with sky and exposes rectangular gaps
// in this stitched panorama when the camera turns. Refine this narrow guide
// against the image edge instead of guessing across the whole panorama.
const outline = [
    [0, 174],
    [26, 174],
    [68, 154],
    [120, 154],
    [146, 146],
    [178, 141],
    [212, 135],
    [260, 138],
    [310, 149],
    [334, 141],
    [350, 116],
    [374, 99],
    [409, 87],
    [435, 65],
    [465, 56],
    [505, 51],
    [528, 57],
    [554, 75],
    [576, 84],
    [600, 96],
    [620, 96],
    [657, 101],
    [682, 104],
    [730, 107],
    [780, 110],
    [850, 114],
    [934, 120],
    [980, 119],
    [1006, 110],
    [1027, 100],
    [1043, 77],
    [1073, 74],
    [1103, 77],
    [1161, 83],
    [1229, 91],
    [1278, 114],
    [1331, 130],
    [1375, 141],
    [1437, 154],
    [1480, 151],
    [1538, 151],
    [1588, 153],
    [1640, 157],
    [1675, 159],
    [1735, 153],
    [1780, 161],
    [1792, 175],
    [1821, 180],
    [1907, 181],
    [1954, 177],
    [1994, 182],
    [2048, 180],
];
const previewWidth = 2048,
    previewHeight = 250;
const preview = await sharp(data, {
    raw: { width, height: Math.round(data.length / width / 3), channels: 3 },
})
    .resize({ width: previewWidth })
    .raw()
    .toBuffer();
const luminance = (x, y) => {
    const p =
        (Math.max(0, y) * previewWidth +
            Math.max(0, Math.min(previewWidth - 1, x))) *
        3;
    return (
        preview[p] * 0.2126 + preview[p + 1] * 0.7152 + preview[p + 2] * 0.0722
    );
};
// A continuous, guided edge avoids noisy per-column jumps on the skyline.
// Work at 2K; interpolate the final mask at 8K.
const previous = new Uint16Array(previewWidth * previewHeight);
let cost = new Float32Array(previewHeight).fill(Infinity);
let segment = 0;
for (let x = 0; x < previewWidth; x++) {
    while (outline[segment + 1][0] < x) segment++;
    const [a, b] = [outline[segment], outline[segment + 1]];
    const guide = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    const next = new Float32Array(previewHeight).fill(Infinity);
    for (
        let y = Math.max(4, Math.round(guide - 24));
        y < Math.min(previewHeight - 4, guide + 24);
        y++
    ) {
        let above = 0,
            below = 0;
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = 1; dy <= 3; dy++) {
                above += luminance(x + dx, y - dy) / 9;
                below += luminance(x + dx, y + dy) / 9;
            }
        const edgeCost =
            -Math.max(0, above - below) + Math.abs(y - guide) * 0.22;
        if (x === 0) next[y] = edgeCost;
        else
            for (
                let py = Math.max(0, y - 3);
                py <= Math.min(previewHeight - 1, y + 3);
                py++
            ) {
                const candidate = cost[py] + edgeCost + Math.abs(py - y) * 2;
                if (candidate < next[y]) {
                    next[y] = candidate;
                    previous[x * previewHeight + y] = py;
                }
            }
    }
    cost = next;
}
const skyline = new Float32Array(previewWidth);
let y = cost.indexOf(Math.min(...cost));
for (let x = previewWidth - 1; x >= 0; x--) {
    skyline[x] = y + 2;
    y = previous[x * previewHeight + y];
}
// The hazy ridge between the two buttes has no strong photographic edge.
// Keep that section gently continuous instead of snapping to rock shadows.
segment = 0;
for (let x = 580; x < 1000; x++) {
    while (outline[segment + 1][0] < x) segment++;
    const [a, b] = [outline[segment], outline[segment + 1]];
    const guide = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]) + 3;
    const blend = Math.min(1, (x - 580) / 40, (1000 - x) / 40);
    skyline[x] += (guide - skyline[x]) * blend;
}
const rgba = Buffer.alloc(width * cropHeight * 4);
for (let x = 0; x < width; x++) {
    const px = (x * previewWidth) / width;
    const left = Math.floor(px),
        right = Math.min(previewWidth - 1, left + 1);
    const boundary =
        ((skyline[left] + (skyline[right] - skyline[left]) * (px - left)) *
            width) /
        previewWidth;
    for (let y = 0; y < cropHeight; y++) {
        const p = (y * width + x) * 3,
            out = (y * width + x) * 4;
        rgba[out] = data[p];
        rgba[out + 1] = data[p + 1];
        rgba[out + 2] = data[p + 2];
        let skyFade = Math.max(0, Math.min(1, (y - boundary) / 6));
        // Remove pale sky contamination along the resampled rock silhouette.
        // Limit this to the edge so sunlit detail within the terrain survives.
        if (y < boundary + 24) {
            const brightness =
                data[p] * 0.2126 + data[p + 1] * 0.7152 + data[p + 2] * 0.0722;
            skyFade *= Math.max(0, Math.min(1, (145 - brightness) / 30));
        }
        const groundFade = Math.max(0, Math.min(1, (cropHeight - y) / 160));
        const valid = data[p] + data[p + 1] + data[p + 2] > 20;
        rgba[out + 3] = valid ? Math.round(255 * skyFade * groundFade) : 0;
    }
}
for (const [size, name] of [
    [8192, "mars-lab-panorama-8k-v1.webp"],
    [4096, "mars-lab-panorama-v1.webp"],
])
    await sharp(rgba, { raw: { width, height: cropHeight, channels: 4 } })
        .resize(size)
        .webp({ quality: 91, alphaQuality: 100, effort: 4 })
        .toFile(`public/images/scenes/${name}`);
