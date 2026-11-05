import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// Capture native Three.js output, not an illustration of the intended result.
// Increment the version before replacing an already published poster.
const version = "v2";
const url = process.env.ARTWORK_URL || "http://127.0.0.1:4321";
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const captures = [];
try {
    for (const [name, width, height] of [
        ["desktop", 1440, 900],
        ["tablet", 768, 1024],
        ["mobile", 390, 844],
    ]) {
        if (process.env.ARTWORK_VIEW && process.env.ARTWORK_VIEW !== name)
            continue;
        const page = await browser.newPage({
            viewport: { width, height },
            deviceScaleFactor: 1.5,
            reducedMotion: "reduce",
        });
        page.setDefaultTimeout(120_000);
        // The destination poster may not exist on its first generation. Its
        // temporary loading image is hidden before capturing the native canvas.
        await page.route("**/images/scenes/horizon-3d-*.webp", (route) =>
            route.fulfill({
                path: "public/images/scenes/horizon-v1.webp",
                contentType: "image/webp",
            }),
        );
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
            if (message.type() === "error") errors.push(message.text());
        });
        await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(
            () =>
                document.querySelector("[data-home-stage]")?.dataset.artwork ===
                "rover-3d",
        );
        const overlays = await page.addStyleTag({
            content:
                ".home-hero__content,.home-hero__veil,.home-hero__caption,.frontier-console,.home-camera-tools{visibility:hidden!important} astro-dev-toolbar{display:none!important}",
        });
        const png = await page.locator("[data-home-stage] canvas").screenshot();
        if (errors.length) throw new Error(errors.join("\n"));
        const path = `public/images/scenes/horizon-3d-${name}-${version}.webp`;
        captures.push({ png, path, name });
        if (process.env.ARTWORK_REVIEW_DIR) {
            await mkdir(process.env.ARTWORK_REVIEW_DIR, { recursive: true });
            await overlays.evaluate((element) => element.remove());
            await page.addStyleTag({
                content: "astro-dev-toolbar{display:none!important}",
            });
            await page.screenshot({
                path: join(process.env.ARTWORK_REVIEW_DIR, `${name}.png`),
            });
        }
        await page.close();
    }
} finally {
    await browser.close();
}
// Publish the files only after closing the browser. Writing into public/ while
// it is open would let a development server reload the page mid-capture.
for (const { png, path, name } of captures) {
    await sharp(png).webp({ quality: 88, effort: 6 }).toFile(path);
    console.log(`Captured ${name}: ${path}`);
}
