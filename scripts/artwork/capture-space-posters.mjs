import { chromium } from "@playwright/test";
import sharp from "sharp";
import { copyFile } from "node:fs/promises";

// These are transparent captures of the production scene, not generated mockups.
// Keep their framing and version paired with SpaceStudy and space-scene.
const base = process.env.ARTWORK_URL || "http://127.0.0.1:8804";
const shots = [];
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
try {
    for (const [kind, route] of [
        ["workshop", "/portfolio"],
        ["observatory", "/blog"],
        ["robotics", "/about"],
        ["relay", "/contact"],
    ]) {
        if (
            process.env.ARTWORK_KIND &&
            !process.env.ARTWORK_KIND.split(",").includes(kind)
        )
            continue;
        for (const phase of kind === "relay"
            ? ["day", "dawn", "dusk", "night"]
            : ["day"]) {
            for (const [view, width, height] of [
                ["desktop", 1440, 1000],
                ["mobile", 800, 1000],
            ]) {
                if (
                    process.env.ARTWORK_VIEW &&
                    process.env.ARTWORK_VIEW !== view
                )
                    continue;
                const page = await browser.newPage({
                    viewport: { width, height },
                    deviceScaleFactor: 1.5,
                    reducedMotion: "reduce",
                    timezoneId: "UTC",
                });
                page.setDefaultTimeout(120000);
                await page.clock.setFixedTime(
                    new Date(
                        `2026-11-04T${{ day: "12", dawn: "07", dusk: "18", night: "23" }[phase]}:00:00Z`,
                    ),
                );
                await page.routeWebSocket("**", (ws) => ws.close());
                // Posters are intentionally absent on their very first capture.
                await page.route("**/images/scenes/*.webp", (route) =>
                    /\/(workshop|observatory|robotics|relay)/.test(
                        route.request().url(),
                    )
                        ? route.fulfill({
                              path: "public/images/scenes/horizon-v1.webp",
                              contentType: "image/webp",
                          })
                        : route.continue(),
                );
                await page.goto(base + route, {
                    waitUntil: "domcontentloaded",
                });
                const figure = page.locator("[data-space-study]");
                // Capture a broad camera frame, then crop it by height in CSS.
                // Three.js keeps vertical FOV constant as the browser changes
                // width, so this also matches intermediate desktop/tablet sizes.
                if (view === "desktop") {
                    const artHeight = await figure
                        .locator(".space-study__art")
                        .evaluate((element) => element.clientHeight);
                    await page.addStyleTag({
                        content: `.space-study{position:fixed!important;width:1280px!important;left:80px!important;top:0!important;right:auto!important;height:auto!important;margin:0!important} .space-study__art{height:${artHeight}px!important}`,
                    });
                }
                await figure.scrollIntoViewIfNeeded();
                await page.waitForFunction(
                    () =>
                        document.querySelector("[data-space-study]")?.dataset
                            .ready === "true",
                );
                await page.addStyleTag({
                    content: `body *{visibility:hidden!important} .space-study,.space-study *{visibility:visible!important} body::before,body::after{display:none!important} :root,body,main{background:transparent!important} .site-cosmos,astro-dev-toolbar,.scene-hero__copy{visibility:hidden!important} .space-study__art{mask-image:none!important;background:none!important} .space-study__poster{display:none!important} .space-study__stage{opacity:1!important}`,
                });
                const png = await figure
                    .locator("canvas")
                    .screenshot({ omitBackground: true });
                const name = `${kind}${kind === "relay" ? `-${phase}` : ""}-${view}-v2.webp`;
                shots.push({ name, png });
                console.log(`Captured ${name}`);
                await page.close();
            }
        }
    }
} finally {
    await browser.close();
}
// Avoid development HMR interrupting an in-progress capture.
for (const { name, png } of shots)
    await sharp(png)
        .webp({ quality: 90, alphaQuality: 100, effort: 6 })
        .toFile(`public/images/scenes/${name}`);
for (const view of ["desktop", "mobile"]) {
    if (shots.some((s) => s.name === `relay-day-${view}-v2.webp`))
        await copyFile(
            `public/images/scenes/relay-day-${view}-v2.webp`,
            `public/images/scenes/relay-${view}-v2.webp`,
        );
}
