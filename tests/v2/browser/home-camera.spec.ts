import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page, reduced = true) {
    await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    const button = page.getByRole("button", { name: "Explore scene" });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(stage).toHaveAttribute("data-camera-mode", "explore");
    await expect(page.getByRole("button", { name: "Done" })).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    const surface = page.getByRole("group", { name: "3D landscape camera" });
    await expect(surface).toBeVisible();
    return { stage, surface };
}

test("explore mode supports orbit, pan, bounded zoom, reset and Escape", async ({
    page,
}) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const { stage, surface } = await enter(page);
    const time = await stage.getAttribute("data-scene-time");
    const baselineCamera = await stage.getAttribute("data-camera");
    const baselineTarget = await stage.getAttribute("data-target");
    const baselineDistance = Number(
        await stage.getAttribute("data-camera-distance"),
    );
    await surface.focus();
    await page.keyboard.press("ArrowLeft");
    await expect
        .poll(() => stage.getAttribute("data-camera"), { timeout: 30000 })
        .not.toBe(baselineCamera);
    await page.keyboard.press("Shift+ArrowRight");
    await expect
        .poll(() => stage.getAttribute("data-target"), { timeout: 30000 })
        .not.toBe(baselineTarget);
    const beforeZoom = Number(await stage.getAttribute("data-camera-distance"));
    const zoomIn = page.getByRole("button", { name: "Zoom in" });
    await zoomIn.click();
    await expect(zoomIn).toBeFocused();
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeLessThan(beforeZoom);
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Camera surface has no bounds");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -10000);
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeLessThan(8);
    expect(
        Number(await stage.getAttribute("data-camera-distance")),
    ).toBeGreaterThanOrEqual(6.99);
    await page.mouse.wheel(0, 10000);
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeGreaterThan(60);
    expect(
        Number(await stage.getAttribute("data-camera-distance")),
    ).toBeLessThanOrEqual(65.1);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeCloseTo(baselineDistance, 1);
    await expect(stage).toHaveAttribute("data-camera", baselineCamera!);
    await expect(stage).toHaveAttribute("data-target", baselineTarget!);
    expect(await stage.getAttribute("data-scene-time")).toBe(time);
    await surface.focus();
    await page.keyboard.press("Escape");
    await expect(stage).toHaveAttribute("data-camera-mode", "composed");
    await expect(surface).toBeHidden();
    await expect(
        page.getByRole("button", { name: "Explore scene" }),
    ).toBeFocused();
});

test("pointer orbit, shift-drag pan and wheel change the camera in exploration", async ({
    page,
}) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const { stage, surface } = await enter(page);
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Camera surface has no bounds");
    const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
    const camera = await stage.getAttribute("data-camera");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 20, { steps: 5 });
    await page.mouse.up();
    await expect
        .poll(() => stage.getAttribute("data-camera"), { timeout: 30000 })
        .not.toBe(camera);
    const target = await stage.getAttribute("data-target");
    await page.keyboard.down("Shift");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 20, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect
        .poll(() => stage.getAttribute("data-target"), { timeout: 30000 })
        .not.toBe(target);
    const distance = Number(await stage.getAttribute("data-camera-distance"));
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, -200);
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeLessThan(distance);
});

test("drag interrupts a guided destination flight and Done returns to composition", async ({
    page,
}) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const { stage, surface } = await enter(page, false);
    await page.getByRole("button", { name: "Signal", exact: true }).click();
    await expect(stage).toHaveAttribute("data-camera-moving", "true", {
        timeout: 30000,
    });
    const box = await surface.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("Camera surface has no bounds");
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, {
        steps: 5,
    });
    await page.mouse.up();
    await expect(stage).toHaveAttribute("data-camera-moving", "false", {
        timeout: 30000,
    });
    await page.getByRole("button", { name: "Done" }).click();
    await expect(stage).toHaveAttribute("data-camera-mode", "composed");
    await expect(surface).toBeHidden();
    await expect(
        page.getByRole("button", { name: "Explore scene" }),
    ).toBeFocused();
});

test("manual controls remain usable while paused without advancing scene time", async ({
    page,
}) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const { stage, surface } = await enter(page, false);
    await page.locator("[data-home-motion]").click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const time = await stage.getAttribute("data-scene-time");
    const camera = await stage.getAttribute("data-camera");
    await surface.focus();
    await page.keyboard.press("ArrowRight");
    await expect
        .poll(() => stage.getAttribute("data-camera"), { timeout: 30000 })
        .not.toBe(camera);
    await page.waitForTimeout(700);
    expect(await stage.getAttribute("data-scene-time")).toBe(time);
    await expect(stage).toHaveAttribute("data-state", "paused");
});

test("mobile touch scroll is restored after exiting exploration", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const { stage, surface } = await enter(page);
    await expect(surface).toBeVisible();
    const session = await context.newCDPSession(page);
    const startScroll = await page.evaluate(() => scrollY);
    const camera = await stage.getAttribute("data-camera");
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 170, y: 300 }],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 230, y: 280 }],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(() => stage.getAttribute("data-camera"), { timeout: 30000 })
        .not.toBe(camera);
    expect(await page.evaluate(() => scrollY)).toBe(startScroll);
    const distance = Number(await stage.getAttribute("data-camera-distance"));
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
            { id: 0, x: 165, y: 300 },
            { id: 1, x: 225, y: 300 },
        ],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
            { id: 0, x: 135, y: 300 },
            { id: 1, x: 255, y: 300 },
        ],
    });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-camera-distance")),
            { timeout: 30000 },
        )
        .toBeLessThan(distance);
    await page.setViewportSize({ width: 960, height: 640 });
    await expect(stage).toHaveAttribute("data-camera-mode", "explore");
    await expect(page.locator(".home-hero__content")).toHaveAttribute(
        "inert",
        "",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(stage).toHaveAttribute("data-camera-mode", "explore");
    await expect(page.locator(".home-hero__content")).not.toHaveAttribute(
        "inert",
        "",
    );
    await page.getByRole("button", { name: "Done" }).click();
    await expect(stage).toHaveAttribute("data-camera-mode", "composed");
    await expect(surface).toBeHidden();
    const before = await page.evaluate(() => scrollY);
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 350 }],
    });
    for (const y of [300, 250, 200, 150, 100])
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: 195, y }],
        });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 30000 })
        .toBeGreaterThan(before + 50);
    await context.close();
});
