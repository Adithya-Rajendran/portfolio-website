import { expect, test } from "@playwright/test";

test("ordinary wheel scrolling reaches and keeps the Moon while reading", async ({
    page,
}) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/resume");
    const stage = page.locator("[data-experience-stage]");
    await expect(stage).toHaveAttribute("data-ready", "true", {
        timeout: 60000,
    });
    const moonKnot = await page.evaluate(() => {
        const entry = document.querySelector<HTMLElement>(
            '[data-journey-world="moon"]',
        )!;
        const markers = entry.querySelectorAll<HTMLElement>(
            "[data-journey-focus-end]",
        );
        const top = entry.getBoundingClientRect().top;
        const bottom =
            markers[markers.length - 1].getBoundingClientRect().bottom;
        return scrollY + (top + bottom) / 2 - innerHeight / 2;
    });
    expect(moonKnot).toBeGreaterThan(0);
    // Start short of the chapter marker, then overshoot it in normal wheel bursts.
    await page.mouse.move(950, 600);
    let scrolled = 0;
    while (scrolled < moonKnot * 0.8) {
        const delta = Math.min(240, moonKnot * 0.8 - scrolled);
        await page.mouse.wheel(0, delta);
        scrolled += delta;
    }
    await expect(stage).toHaveAttribute("data-world", "moon", {
        timeout: 90000,
    });
    await expect(stage).toHaveAttribute("data-view", "surface", {
        timeout: 90000,
    });
    await page.mouse.wheel(0, moonKnot * 0.3);
    await page.waitForTimeout(1000);
    await expect(stage).toHaveAttribute("data-world", "moon");
    await expect(stage).toHaveAttribute("data-view", "surface");
    await stage.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(stage).toHaveAttribute("data-camera-owner", "manual");
    await page.mouse.wheel(0, 35);
    await page.mouse.wheel(0, -25);
    await page.waitForTimeout(1000);
    await expect(stage).toHaveAttribute("data-world", "moon");
    await expect(stage).toHaveAttribute("data-camera-owner", "manual");
});
