import type { Page } from "@playwright/test";
import { axeViolations } from "./support/axe";
import { expect, test } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * /resume/trajectory's record panel (components/trajectory/journey.tsx):
 * it fits the pinned stage on short laptop screens, it never moves while
 * the flight is scrubbed (a long burn label included), Play gives way to
 * any key, a phone keeps each chapter's name and full entry, and axe finds
 * nothing in either theme (the route is not in the sitemap, so a11y.spec's
 * page list does not reach it).
 */
const PATH = "/resume/trajectory";

/** Scrolls to progress `p` through the pinned flight. */
async function seek(page: Page, p: number) {
    await page.evaluate((to) => {
        const section = document.querySelector<HTMLElement>("[data-journey]")!;
        const stage = section.querySelector<HTMLElement>("[data-stage]")!;
        const pin = parseFloat(getComputedStyle(stage).top) || 0;
        const top = section.getBoundingClientRect().top + scrollY - pin;
        const span = section.offsetHeight - stage.offsetHeight;
        scrollTo({ top: top + to * span, behavior: "instant" });
    }, p);
    await page.waitForTimeout(300);
}

async function panel(page: Page) {
    return page.evaluate(() => {
        const box = (el: Element) => el.getBoundingClientRect();
        const section = document.querySelector("[data-journey]")!;
        const stage = box(section.querySelector("[data-stage]")!);
        const hud = box(section.querySelector("[data-date]")!.parentElement!);
        const play = box(section.querySelector("[data-play]")!);
        return {
            stageTop: stage.top,
            stageBottom: stage.bottom,
            hudTop: hud.top,
            hudOffset: hud.top - stage.top,
            hudHeight: hud.height,
            playBottom: play.bottom,
        };
    });
}

for (const [width, height] of [
    [1280, 720],
    [1366, 657],
    [1440, 900],
]) {
    test(`the record fits the stage at ${width}×${height} and holds still`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height });
        await page.goto(PATH);
        await page.waitForLoadState("networkidle");
        const frames = [];
        // 0.45 is inside the transfer that carries the burn's name.
        for (const p of [0, 0.45, 1]) {
            await seek(page, p);
            frames.push(await panel(page));
        }
        for (const f of frames) {
            expect(f.playBottom).toBeLessThanOrEqual(f.stageBottom - 16);
            expect(f.hudTop).toBeGreaterThanOrEqual(f.stageTop + 16);
            expect(Math.abs(f.hudOffset - frames[0].hudOffset)).toBeLessThan(
                1.5,
            );
            expect(Math.abs(f.hudHeight - frames[0].hudHeight)).toBeLessThan(
                1.5,
            );
        }
    });
}

test("any key but Play's own press stops Play", async ({ page }) => {
    await page.goto(PATH);
    await page.waitForLoadState("networkidle");
    await seek(page, 0);
    const play = page.getByRole("button", { name: "Play", exact: true });
    await play.click();
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    await expect(pause).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(play).toBeVisible();
});

test("a phone keeps each chapter's name and full entry", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await page.waitForLoadState("networkidle");
    // "2024 Canonical": the year shows, the name is read.
    const buttons = page
        .getByRole("list", { name: "Chapters" })
        .getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(1);
    for (const button of await buttons.all())
        await expect(button).toHaveAccessibleName(/^\S+ \S/);
    await expect(
        page.getByRole("link", { name: "Full entry" }).first(),
    ).toBeVisible();
});

for (const theme of THEMES) {
    for (const width of [390, 1440]) {
        test(`axe finds nothing in ${theme} at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({
                width,
                height: width < 600 ? 844 : 900,
            });
            await storeTheme(page, theme);
            await page.goto(PATH);
            await page.waitForLoadState("networkidle");
            await expect(page.locator("html")).toHaveAttribute(
                "data-theme",
                theme,
            );
            expect(await axeViolations(page, PATH)).toEqual([]);
        });
    }
}
