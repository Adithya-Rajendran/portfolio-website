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
 * page list does not reach it). The 3D scene draws in both themes,
 * survives a lost WebGL context, and leaves one canvas and no errors
 * after the route is left and shown again.
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

/** The luminance spread (standard deviation, of 255) of the stage right of
 *  the record, clear of the caption: a drawn scene has worlds, lines and
 *  stars; the bare paper or black has none. Read in the page from a
 *  screenshot, so the compositor's frame is what counts. */
async function sceneSpread(page: Page) {
    const clip = await page.evaluate(() => {
        const stage = document
            .querySelector("[data-journey] [data-stage]")!
            .getBoundingClientRect();
        return {
            x: stage.left + stage.width * 0.55,
            y: stage.top + 24,
            width: stage.width * 0.45 - 16,
            height: stage.height - 88,
        };
    });
    const png = (await page.screenshot({ clip })).toString("base64");
    return page.evaluate(async (data) => {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(
            new Blob([bytes], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const px = context.getImageData(0, 0, image.width, image.height).data;
        let sum = 0;
        let squares = 0;
        for (let i = 0; i < px.length; i += 4) {
            const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
            sum += y;
            squares += y * y;
        }
        const n = px.length / 4;
        return Math.sqrt(Math.max(0, squares / n - (sum / n) ** 2));
    }, png);
}

/** A drawn scene's spread is above this in every frame and theme
 *  (15–41 at 1440×900 on SwiftShader); the poster alone is about 7 and
 *  the bare stage 0. */
const DRAWN = 10;

for (const theme of THEMES) {
    test(`the flight draws in ${theme}, survives a lost context and a return`, async ({
        page,
        pageErrors,
    }) => {
        test.setTimeout(90_000);
        await storeTheme(page, theme);
        await page.goto(PATH);
        const scene = page.locator("[data-journey] [data-scene]");
        await expect(scene).toHaveAttribute("data-ready", "", {
            timeout: 20_000,
        });
        // The canvas's fade in.
        await page.waitForTimeout(900);
        for (const p of [0, 0.5, 1]) {
            await seek(page, p);
            expect(await sceneSpread(page), `P ${p}`).toBeGreaterThan(DRAWN);
        }

        // A lost context hides the canvas and the labels (the poster
        // shows); restored, the scene is back without a scroll.
        await page.evaluate(() => {
            const canvas = document.querySelector<HTMLCanvasElement>(
                "[data-scene] > canvas",
            )!;
            const lose = canvas
                .getContext("webgl2")!
                .getExtension("WEBGL_lose_context")!;
            Object.assign(window, { lose });
            lose.loseContext();
        });
        await expect(scene).not.toHaveAttribute("data-ready");
        await page.evaluate(() =>
            (
                window as unknown as { lose: WEBGL_lose_context }
            ).lose.restoreContext(),
        );
        await expect(scene).toHaveAttribute("data-ready", "");
        await page.waitForTimeout(900);
        expect(await sceneSpread(page), "restored").toBeGreaterThan(DRAWN);

        // Away and back, twice: one canvas, drawn again.
        for (let i = 0; i < 2; i++) {
            await page
                .getByRole("banner")
                .getByRole("link", { name: "Experience", exact: true })
                .click();
            await expect(page).toHaveURL(/\/resume$/);
            await page.goBack();
            await expect(page).toHaveURL(new RegExp(`${PATH}$`));
            await expect(scene).toHaveAttribute("data-ready", "", {
                timeout: 20_000,
            });
        }
        expect(await page.locator("[data-scene] > canvas").count()).toBe(1);
        await seek(page, 0.5);
        await page.waitForTimeout(900);
        expect(await sceneSpread(page), "returned").toBeGreaterThan(DRAWN);
        expect(await pageErrors.drain(page)).toEqual([]);
    });
}
