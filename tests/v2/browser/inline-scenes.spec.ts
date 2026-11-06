import { expect, test } from "@playwright/test";

async function supportsWebGL(page: import("@playwright/test").Page) {
    return page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
}

test("inline camera stays at the chosen angle while paused and after resizing", async ({
    page,
}) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto("/about");
    test.skip(!(await supportsWebGL(page)), "WebGL2 is unavailable");
    const figure = page.locator('[data-space-study="robotics"]');
    await expect(figure).toHaveAttribute("data-ready", "true", {
        timeout: 45000,
    });
    await figure.getByRole("button", { name: "Pause motion" }).click();
    const stage = figure.locator("[data-space-stage]");
    await stage.scrollIntoViewIfNeeded();
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.62, {
        steps: 3,
    });
    await page.mouse.up();
    await expect
        .poll(async () =>
            Math.abs(Number(await stage.getAttribute("data-view-yaw"))),
        )
        .toBeGreaterThan(0.4);
    await expect(stage).not.toHaveAttribute("data-dragging");
    const targetYaw = Math.min(
        1.35,
        ((box.width * 0.25) / Math.max(200, Math.min(box.width, box.height))) *
            Math.PI,
    );
    await expect
        .poll(async () => Number(await stage.getAttribute("data-view-yaw")), {
            timeout: 30000,
        })
        .toBeCloseTo(targetYaw, 2);
    const yaw = Number(await stage.getAttribute("data-view-yaw"));
    const sceneTime = await figure.getAttribute("data-scene-time");
    await page.setViewportSize({ width: 780, height: 900 });
    await expect
        .poll(async () => Number(await stage.getAttribute("data-view-yaw")))
        .toBeCloseTo(yaw, 2);
    await expect(figure).toHaveAttribute("data-scene-time", sceneTime!);
    await figure.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect
        .poll(async () => Number(await stage.getAttribute("data-view-zoom")), {
            timeout: 15000,
        })
        .toBeCloseTo(0.9, 2);
    await figure.getByRole("button", { name: "Reset view" }).click();
    await expect(stage).toHaveAttribute("data-view-yaw", "0.000", {
        timeout: 15000,
    });
    await expect(stage).toHaveAttribute("data-view-pitch", "0.000");
    await expect(stage).toHaveAttribute("data-view-zoom", "1.000");
    await expect(figure).toHaveAttribute("data-state", "paused");
});

test("touch can orbit horizontally and scroll vertically over the same scene", async ({
    browser,
}) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
        await page.goto("/about");
        test.skip(!(await supportsWebGL(page)), "WebGL2 is unavailable");
        const figure = page.locator('[data-space-study="robotics"]');
        await figure.scrollIntoViewIfNeeded();
        await expect(figure).toHaveAttribute("data-ready", "true", {
            timeout: 45000,
        });
        const stage = figure.locator("[data-space-stage]");
        const session = await context.newCDPSession(page);
        const swipe = async (dx: number, dy: number) => {
            const box = (await stage.boundingBox())!;
            const x = box.x + box.width / 2,
                y = box.y + box.height / 2;
            await session.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{ x, y }],
            });
            for (let step = 1; step <= 8; step++) {
                await session.send("Input.dispatchTouchEvent", {
                    type: "touchMove",
                    touchPoints: [
                        { x: x + (dx * step) / 8, y: y + (dy * step) / 8 },
                    ],
                });
                await page.waitForTimeout(30);
            }
            await session.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
            });
        };
        await swipe(100, 0);
        await expect
            .poll(async () =>
                Math.abs(Number(await stage.getAttribute("data-view-yaw"))),
            )
            .toBeGreaterThan(0.3);
        await figure.getByRole("button", { name: "Reset view" }).click();
        await stage.scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => scrollY);
        await swipe(0, -120);
        await expect
            .poll(() => page.evaluate(() => scrollY))
            .toBeGreaterThan(before + 30);
        await expect(stage).toHaveAttribute("data-view-yaw", "0.000");
        await expect(stage).not.toHaveAttribute("data-dragging");
    } finally {
        await context.close();
    }
});

test("a project model loads inline and remains inspectable with reduced motion", async ({
    page,
}) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/portfolio/fixture-flagship-mission");
    test.skip(!(await supportsWebGL(page)), "WebGL2 is unavailable");
    const viewer = page.locator("[data-project-viewer]");
    await viewer.scrollIntoViewIfNeeded();
    await expect(viewer).toHaveAttribute("data-ready", "true", {
        timeout: 30000,
    });
    await expect(viewer.locator("canvas")).toHaveCount(1);
    await expect(
        page.getByRole("button", { name: "Explore 3D model" }),
    ).toHaveCount(0);
    const stage = viewer.locator("[data-viewer-stage]");
    await stage.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    await expect(stage).toHaveAttribute("data-view-yaw", "0.120");
    await expect(stage).toHaveAttribute("data-view-pitch", "-0.120");
    await page.keyboard.press("Home");
    await expect(stage).toHaveAttribute("data-view-yaw", "0.000");
    await expect(
        viewer.getByRole("button", { name: "Still scene" }),
    ).toBeDisabled();
    await page.evaluate(() => {
        window.dispatchEvent(
            new PageTransitionEvent("pagehide", { persisted: true }),
        );
        window.dispatchEvent(
            new PageTransitionEvent("pageshow", { persisted: true }),
        );
    });
    await expect(viewer).toHaveAttribute("data-ready", "true", {
        timeout: 30000,
    });
    await expect(viewer.locator("canvas")).toHaveCount(1);
    await viewer
        .locator("canvas")
        .evaluate((canvas: HTMLCanvasElement) =>
            canvas.dispatchEvent(
                new Event("webglcontextlost", { cancelable: true }),
            ),
        );
    await expect(viewer).toHaveAttribute("data-state", "unavailable");
    await expect(viewer.getByRole("status")).toContainText(
        "read the project below",
    );
    await expect(viewer.locator("canvas")).toHaveCount(0);
    await viewer.getByRole("button", { name: "Try model again" }).click();
    await expect(viewer).toHaveAttribute("data-ready", "true", {
        timeout: 30000,
    });
    await expect(viewer.locator("canvas")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Fixture flagship mission",
    );
});
