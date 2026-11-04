import { expect, test } from "@playwright/test";

const pages = [
    ["/portfolio", "workshop"],
    ["/blog", "observatory"],
    ["/about", "robotics"],
    ["/contact", "relay"],
] as const;

for (const [path, kind] of pages) {
    test(`${kind} starts as a still accessible scene and fits mobile`, async ({
        page,
    }) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const supported = await page.evaluate(() =>
            Boolean(document.createElement("canvas").getContext("webgl2")),
        );
        test.skip(!supported, "WebGL2 is unavailable in this browser");
        const figure = page.locator(`figure[data-space-study="${kind}"]`);
        await figure.scrollIntoViewIfNeeded();
        await expect(figure).toHaveAttribute("data-ready", "true", {
            timeout: 45000,
        });
        await expect(figure).toHaveAttribute("data-state", "paused");
        const stage = figure.locator("[data-space-stage]");
        await expect(stage).toHaveAttribute("role", "img");
        await expect(stage).toHaveAttribute("aria-label", /.+/);
        await expect(stage.locator("canvas")).toHaveAttribute(
            "aria-hidden",
            "true",
        );
        await expect(
            figure.getByRole("button", { name: "Still scene" }),
        ).toBeDisabled();
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            const sizes = await page.evaluate(() => ({
                width: document.documentElement.clientWidth,
                scroll: document.documentElement.scrollWidth,
            }));
            expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
        }
    });
}

test("a space scene supports keyboard pause and retains content after context loss", async ({
    page,
}) => {
    test.setTimeout(90000);
    await page.goto("/about");
    const supported = await page.evaluate(() =>
        Boolean(document.createElement("canvas").getContext("webgl2")),
    );
    test.skip(!supported, "WebGL2 is unavailable in this browser");
    const figure = page.locator('figure[data-space-study="robotics"]');
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute("data-ready", "true", {
        timeout: 45000,
    });
    const motion = figure.locator("[data-space-motion]");
    await expect(motion).toHaveText("Pause motion");
    await motion.focus();
    await page.keyboard.press("Enter");
    await expect(motion).toHaveText("Resume motion");
    await expect(motion).toHaveAttribute("aria-pressed", "true");
    await expect(figure).toHaveAttribute("data-state", "paused");
    await page.keyboard.press("Enter");
    await expect(motion).toHaveText("Pause motion");
    const canvas = figure.locator("canvas");
    const canLose = await canvas.evaluate((element) => {
        const ext = (element as HTMLCanvasElement)
            .getContext("webgl2")
            ?.getExtension("WEBGL_lose_context");
        ext?.loseContext();
        return Boolean(ext);
    });
    test.skip(!canLose, "WEBGL_lose_context is unavailable in this browser");
    await expect(figure).toHaveAttribute("data-state", "unavailable");
    await expect(canvas).toHaveCount(0);
    await expect(motion).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the vignettes leave content readable without JavaScript", async ({
    browser,
}) => {
    const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 320, height: 844 },
    });
    const page = await context.newPage();
    for (const [path, kind] of pages) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const figure = page.locator(`figure[data-space-study="${kind}"]`);
        await expect(figure.locator("canvas")).toHaveCount(0);
        await expect(figure.locator("figcaption")).toBeVisible();
        const sizes = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
        }));
        expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    }
    await context.close();
});

test("a scene recovers when restored while its initial texture is still loading", async ({
    page,
}) => {
    test.setTimeout(90000);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requests = 0;
    await page.route(
        "**/images/trajectory/moon-surface-v2-*.webp",
        async (route) => {
            requests++;
            if (requests === 1) await pending;
            await route.continue();
        },
    );
    try {
        await page.goto("/portfolio");
        const supported = await page.evaluate(() =>
            Boolean(document.createElement("canvas").getContext("webgl2")),
        );
        test.skip(!supported, "WebGL2 is unavailable in this browser");
        const figure = page.locator('figure[data-space-study="workshop"]');
        await figure.scrollIntoViewIfNeeded();
        await expect
            .poll(() => requests, { timeout: 30000 })
            .toBeGreaterThan(0);
        await page.evaluate(() => {
            window.dispatchEvent(
                new PageTransitionEvent("pagehide", { persisted: true }),
            );
            window.dispatchEvent(
                new PageTransitionEvent("pageshow", { persisted: true }),
            );
        });
        release();
        await expect(figure).toHaveAttribute("data-ready", "true", {
            timeout: 45000,
        });
        await expect(figure.locator("canvas")).toHaveCount(1);
    } finally {
        release();
    }
});

test("mobile page scrolling remains available over the scene", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/portfolio");
    const figure = page.locator('figure[data-space-study="workshop"]');
    await figure.scrollIntoViewIfNeeded();
    const stage = figure.locator("[data-space-stage]");
    const bounds = await stage.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
        bounds!.x + bounds!.width / 2,
        bounds!.y + bounds!.height / 2,
    );
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 250);
    await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 20000 })
        .toBeGreaterThan(before);
});
