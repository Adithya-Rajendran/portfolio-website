import { expect, test, type Page } from "@playwright/test";

async function openHome(page: Page, reduced = false) {
    await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    await expect(stage).toHaveAttribute("data-reveal", "ready", {
        timeout: 60000,
    });
    await expect(stage).toHaveAttribute("data-artwork", "rover-3d");
    await expect(
        page.getByRole("group", { name: "Explore the frontier" }),
    ).toBeVisible();
    return stage;
}

test("frontier destinations are keyboard operable and interrupt camera movement", async ({
    page,
}) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const stage = await openHome(page);
    const group = page.getByRole("group", { name: "Explore the frontier" });
    const rover = group.getByRole("button", { name: "Rover" });
    const outpost = group.getByRole("button", { name: "Outpost" });
    const signal = group.getByRole("button", { name: "Signal" });
    await expect(rover).toHaveAttribute("aria-pressed", "true");
    const initialTarget = await stage.getAttribute("data-target");
    await rover.focus();
    await page.keyboard.press("Tab");
    await expect(outpost).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(outpost).toHaveAttribute("aria-pressed", "true");
    await expect(stage).toHaveAttribute("data-home-focus", "outpost");
    await expect
        .poll(() => stage.getAttribute("data-target"), { timeout: 30000 })
        .not.toBe(initialTarget);
    await page.keyboard.press("Tab");
    await expect(signal).toBeFocused();
    const beforeSignal = await stage.getAttribute("data-target");
    await page.keyboard.press("Space");
    await expect(signal).toHaveAttribute("aria-pressed", "true");
    await expect(outpost).toHaveAttribute("aria-pressed", "false");
    await expect(stage).toHaveAttribute("data-home-focus", "signal");
    await expect
        .poll(() => stage.getAttribute("data-target"), { timeout: 30000 })
        .not.toBe(beforeSignal);
    const signalTarget = await stage.getAttribute("data-target");
    await rover.focus();
    await page.keyboard.press("Enter");
    await expect(rover).toHaveAttribute("aria-pressed", "true");
    await expect(signal).toHaveAttribute("aria-pressed", "false");
    await expect(stage).toHaveAttribute("data-home-focus", "rover");
    await expect
        .poll(() => stage.getAttribute("data-target"), { timeout: 30000 })
        .not.toBe(signalTarget);
});

for (const reduced of [false, true]) {
    test(`frontier focus changes while ${reduced ? "reduced motion is active" : "manually paused"} without advancing time`, async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const stage = await openHome(page, reduced);
        if (!reduced) await page.locator("[data-home-motion]").click();
        await expect(stage).toHaveAttribute("data-state", "paused");
        const beforeTime = await stage.getAttribute("data-scene-time");
        const beforeCamera = await stage.getAttribute("data-camera");
        await page
            .getByRole("button", { name: "Outpost", exact: true })
            .click();
        await expect(stage).toHaveAttribute("data-home-focus", "outpost");
        await expect
            .poll(() => stage.getAttribute("data-camera"), { timeout: 30000 })
            .not.toBe(beforeCamera);
        const afterCamera = await stage.getAttribute("data-camera");
        await page.waitForTimeout(1000);
        expect(await stage.getAttribute("data-camera")).toBe(afterCamera);
        expect(await stage.getAttribute("data-scene-time")).toBe(beforeTime);
        await expect(stage).toHaveAttribute("data-state", "paused");
    });
}

test("offscreen and hidden frontier pauses and preserves manual pause on return", async ({
    page,
}) => {
    test.setTimeout(300_000);
    await page.addInitScript(() => {
        let draws = 0;
        const original = WebGL2RenderingContext.prototype.drawElements;
        WebGL2RenderingContext.prototype.drawElements = function (
            this: WebGL2RenderingContext,
            ...args: Parameters<WebGL2RenderingContext["drawElements"]>
        ) {
            draws++;
            return original.apply(this, args);
        };
        Object.defineProperty(window, "testGpuDraws", { get: () => draws });
    });
    const gpuDraws = () =>
        page.evaluate(
            () => (window as unknown as { testGpuDraws: number }).testGpuDraws,
        );
    await page.setViewportSize({ width: 960, height: 720 });
    const stage = await openHome(page);
    await expect
        .poll(async () => Number(await stage.getAttribute("data-scene-time")), {
            timeout: 30000,
        })
        .toBeGreaterThan(0);
    await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await expect(stage).toHaveAttribute("data-state", "paused", {
        timeout: 30000,
    });
    const offscreen = await stage.getAttribute("data-scene-time");
    const offscreenDraws = await gpuDraws();
    // A layout change must not render the hidden landscape just to resize it.
    await page.setViewportSize({ width: 961, height: 720 });
    await page.waitForTimeout(1000);
    expect(await stage.getAttribute("data-scene-time")).toBe(offscreen);
    expect(await gpuDraws()).toBe(offscreenDraws);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(stage).toHaveAttribute("data-state", "running", {
        timeout: 30000,
    });
    await page.locator("[data-home-motion]").click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    const hidden = await stage.getAttribute("data-scene-time");
    const hiddenDraws = await gpuDraws();
    await page.setViewportSize({ width: 960, height: 720 });
    await page.waitForTimeout(1000);
    expect(await stage.getAttribute("data-scene-time")).toBe(hidden);
    expect(await gpuDraws()).toBe(hiddenDraws);
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator("[data-home-motion]")).toHaveText(
        "Resume motion",
    );
    await expect(stage).toHaveAttribute("data-state", "paused");
    await expect(stage.locator("canvas")).toHaveCount(1);
});

test("contact shading is reused during ambient animation and refreshed for a new camera view", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 960, height: 720 });
    const stage = await openHome(page);
    await expect
        .poll(async () => Number(await stage.getAttribute("data-scene-time")), {
            timeout: 30000,
        })
        .toBeGreaterThan(0);
    const cached = Number(await stage.getAttribute("data-occlusion-updates"));
    expect(cached).toBeGreaterThan(0);
    const time = Number(await stage.getAttribute("data-scene-time"));
    await expect
        .poll(async () => Number(await stage.getAttribute("data-scene-time")), {
            timeout: 30000,
        })
        .toBeGreaterThan(time + 0.1);
    expect(Number(await stage.getAttribute("data-occlusion-updates"))).toBe(
        cached,
    );
    await page.locator("[data-home-motion]").click();
    await expect(stage).toHaveAttribute("data-state", "paused");
    const pausedCache = Number(
        await stage.getAttribute("data-occlusion-updates"),
    );
    await page.getByRole("button", { name: "Outpost", exact: true }).click();
    await expect
        .poll(
            async () =>
                Number(await stage.getAttribute("data-occlusion-updates")),
            { timeout: 30000 },
        )
        .toBeGreaterThan(pausedCache);
    await expect(stage).toHaveAttribute("data-state", "paused");
});

test("mobile frontier permits native touch scrolling", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await openHome(page, true);
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 350 }],
    });
    for (const y of [300, 250, 200, 150, 100]) {
        await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: 195, y }],
        });
    }
    await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
    });
    await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 30000 })
        .toBeGreaterThan(50);
    await context.close();
});
