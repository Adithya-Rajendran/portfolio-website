import { expect, test, type Page } from "@playwright/test";

async function centeringError(page: Page) {
    return page.evaluate(() => {
        const entry = document.querySelector<HTMLElement>(
            '[data-journey-world="mars"]',
        )!;
        const markers = entry.querySelectorAll<HTMLElement>(
            "[data-journey-focus-end]",
        );
        const end = markers[markers.length - 1];
        const rect = entry.getBoundingClientRect();
        const header = document.querySelector<HTMLElement>("header");
        const aside = document.querySelector<HTMLElement>(".trajectory-orbit");
        let top = 0;
        for (const item of [header, aside]) {
            if (!item) continue;
            const box = item.getBoundingClientRect();
            const position = getComputedStyle(item).position;
            if (
                (position === "sticky" || position === "fixed") &&
                box.top <= 1 &&
                box.right > rect.left &&
                box.left < rect.right
            )
                top = Math.max(top, box.bottom + (item === aside ? 16 : 0));
        }
        const available = innerHeight - top;
        const contentBottom =
            entry.lastElementChild!.getBoundingClientRect().bottom;
        const bottom =
            contentBottom - rect.top > available - 32
                ? end.getBoundingClientRect().bottom
                : contentBottom;
        return Math.abs((rect.top + bottom) / 2 - (top + innerHeight) / 2);
    });
}

async function selectMars(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/resume");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("[data-experience-stage]")).toHaveAttribute(
        "data-ready",
        "true",
        { timeout: 60000 },
    );
    const entry = page.locator('[data-journey-world="mars"]');
    await expect(entry).toContainText(/TCR/i);
    await expect(entry.locator("h3")).toBeVisible();
    await expect(entry.locator(".trajectory-entry__org")).toBeVisible();
    await page.getByRole("button", { name: "Mars", exact: true }).click();
    await expect(entry).toHaveClass(/is-current/, { timeout: 60000 });
    await expect
        .poll(() => centeringError(page), { timeout: 30000 })
        .toBeLessThan(35);
}

for (const height of [700, 1000]) {
    test(`Mars centers the TCR entry on desktop at ${height}px`, async ({
        page,
    }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1440, height });
        await selectMars(page);
        await page.waitForTimeout(1000);
        expect(await centeringError(page)).toBeLessThan(35);
    });
}

test("Mars recenters after viewport resizing until a real wheel scroll cancels it", async ({
    page,
}) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 700 });
    await selectMars(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect
        .poll(() => centeringError(page), { timeout: 30000 })
        .toBeLessThan(35);
    await page.mouse.move(60, 500);
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 180);
    await expect
        .poll(() => page.evaluate(() => scrollY), { timeout: 30000 })
        .toBeGreaterThan(before + 50);
    const moved = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1500);
    expect(Math.abs((await page.evaluate(() => scrollY)) - moved)).toBeLessThan(
        3,
    );
});

test("Mars centers the TCR reading content on mobile", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await selectMars(page);
    await expect(page.locator(".experience-visual")).toHaveAttribute(
        "data-layout",
        "compact",
        { timeout: 30000 },
    );
    await expect
        .poll(() => centeringError(page), { timeout: 30000 })
        .toBeLessThan(35);
});
