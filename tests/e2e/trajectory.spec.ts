import type { Page } from "@playwright/test";
import { cvCopy, trajectoryCopy as copy } from "@/lib/copy";
import { expect, test } from "./support/test";
import { THEMES, storeTheme } from "./support/theme";

/**
 * The flight (components/trajectory/journey.tsx), /resume's Timeline view
 * and its default where motion runs (resume.spec has the views; a11y.spec
 * runs axe on the page as it opens, the flight). Pinned, the stage shows
 * its rail and Play. The record fits the pinned stage on short laptop
 * screens and never moves while the flight is scrubbed (a long burn label
 * included), with no card's words cut to fit; the card's one readout ticks; the scene names the worlds by
 * their organisation only, in the wide finale's map alone (at a hold the
 * card and the rail name the world); a still flight opens on the latest
 * chapter, and on a phone a still card's dates ("… · Expected 2028") wrap
 * clear of its Full entry. Play gives way to
 * any key, and a phone keeps each chapter's name and full entry (and the
 * plan's Contact under its openings). The 3D scene draws in both themes,
 * survives a lost WebGL context, and leaves one canvas and no errors
 * after the page is left and shown again.
 */
const PATH = "/resume";

// Every test here draws the 3D flight, which a GPU-less browser renders
// on the CPU: in order, in one worker, so this file never runs several
// at once and starves the rest of the suite.
test.describe.configure({ mode: "default" });

/** The card paragraphs whose words are cut (a line clamp, a clip). */
function cutWords(page: Page) {
    return page.evaluate(() =>
        [...document.querySelectorAll("[data-journey] [data-card] p")]
            .filter(
                (p) =>
                    getComputedStyle(p).overflowY !== "visible" &&
                    p.scrollHeight > p.clientHeight + 1,
            )
            .map((p) => p.textContent?.slice(0, 40)),
    );
}

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
        const record = box(section.querySelector("[data-record]")!);
        const play = box(section.querySelector("[data-play]")!);
        return {
            stageTop: stage.top,
            stageBottom: stage.bottom,
            recordTop: record.top,
            recordOffset: record.top - stage.top,
            recordHeight: record.height,
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
        // Every card says its words whole: none is cut to fit.
        expect(await cutWords(page)).toEqual([]);
        const frames = [];
        // 0.45 is inside the transfer that carries the burn's name.
        for (const p of [0, 0.45, 1]) {
            await seek(page, p);
            frames.push(await panel(page));
        }
        for (const f of frames) {
            expect(f.playBottom).toBeLessThanOrEqual(f.stageBottom - 16);
            expect(f.recordTop).toBeGreaterThanOrEqual(f.stageTop + 16);
            expect(
                Math.abs(f.recordOffset - frames[0].recordOffset),
            ).toBeLessThan(1.5);
            expect(
                Math.abs(f.recordHeight - frames[0].recordHeight),
            ).toBeLessThan(1.5);
        }
    });
}

test("pinned, the stage shows its rail and Play", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH);
    await page.waitForLoadState("networkidle");
    await seek(page, 0);
    const main = page.getByRole("main");
    await expect(
        main.getByRole("list", { name: copy.rail }).getByRole("button").last(),
    ).toBeInViewport();
    await expect(
        main.getByRole("button", { name: copy.play, exact: true }),
    ).toBeInViewport();
});

/** The scene's labels on show (opacity above zero), by their text. */
function labelsShown(page: Page) {
    return page.evaluate(() =>
        [
            ...document.querySelectorAll<HTMLElement>(
                "[data-journey] [data-scene] div[data-state]",
            ),
        ]
            .filter((el) => parseFloat(el.style.opacity || "0") > 0.01)
            .map((el) => el.textContent ?? ""),
    );
}

test("the readout ticks under the title; the scene names the worlds in the finale's map only", async ({
    page,
}) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH);
    await expect(page.locator("[data-journey] [data-scene]")).toHaveAttribute(
        "data-ready",
        "",
        { timeout: 20_000 },
    );
    let samples = 0;
    for (let p = 0.1; p < 0.8; p += 0.02) {
        await seek(page, p);
        const stamp = page.locator(
            "[data-journey] [data-card][data-on] [data-stamp]",
        );
        // The plan's card has no readout: the flown route is over.
        if (!(await stamp.count())) break;
        const readout = (await stamp.textContent()) ?? "";
        // "May 2024 · Transfer": the date, then the phase.
        expect(readout, `P ${p.toFixed(2)}`).toMatch(/^(\w{3} )?\d{4} · \S/);
        // At a hold and through a transfer alike, no world is named: the
        // card's organisation and the lit rail stop name it.
        expect(
            await labelsShown(page),
            `P ${p.toFixed(2)} (${readout})`,
        ).toEqual([]);
        samples += 1;
    }
    expect(samples).toBeGreaterThan(0);
    // The finale's map names the worlds flown, by organisation alone.
    await seek(page, 1);
    await page.waitForTimeout(600);
    const named = await labelsShown(page);
    expect(named.length).toBeGreaterThan(1);
    expect(named.join(" ")).not.toMatch(/\d/);
});

test("a phone's scene names no world, in flight or in the finale", async ({
    page,
}) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expect(page.locator("[data-journey] [data-scene]")).toHaveAttribute(
        "data-ready",
        "",
        { timeout: 20_000 },
    );
    for (const p of [0.3, 0.6, 1]) {
        await seek(page, p);
        await page.waitForTimeout(300);
        expect(await labelsShown(page), `P ${p}`).toEqual([]);
    }
});

test("a still flight opens on the latest chapter, the ask last on the rail", async ({
    page,
}) => {
    // Under reduced motion the list is the view; Timeline is the still.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(PATH);
    await expect(page.locator("[data-views]")).toHaveAttribute(
        "data-view",
        "list",
    );
    await page
        .getByRole("group", { name: cvCopy.views.legend })
        .getByRole("radio", { name: "Timeline", exact: true })
        .check();
    const rail = page.getByRole("list", { name: copy.rail });
    const buttons = rail.getByRole("button");
    const count = await buttons.count();
    // The last stop, when set, is the Future (what the owner is open to);
    // the latest chapter is the one before it.
    const asks = (await buttons.last().textContent())?.includes(copy.future);
    await expect(buttons.nth(asks ? count - 2 : count - 1)).toHaveAttribute(
        "aria-current",
        "step",
    );
    await expect(
        page.locator("[data-journey] [data-card][data-on] h3"),
    ).not.toHaveText(copy.openTo);
});

for (const width of [360, 390]) {
    test(`a still card's dates clear its Full entry at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(PATH);
        await expect(page.locator("[data-views]")).toHaveAttribute(
            "data-view",
            "list",
        );
        await page
            .getByRole("group", { name: cvCopy.views.legend })
            .getByRole("radio", { name: "Timeline", exact: true })
            .check();
        await expect(page.locator("[data-journey]")).toBeVisible();
        const buttons = page
            .getByRole("list", { name: copy.rail })
            .getByRole("button");
        // The chapters' cards (the plan's has no readout).
        const chapters = await page
            .locator("[data-journey] [data-card]:has([data-stamp])")
            .count();
        expect(chapters).toBeGreaterThan(0);
        // Each chapter's card, the latest ("… · Expected 2028") first.
        for (let i = chapters - 1; i >= 0; i--) {
            await buttons.nth(i).click();
            await expect(
                page.locator(`[data-journey] [data-card="${i}"]`),
            ).toHaveAttribute("data-on", "");
            const clash = await page.evaluate(
                ({ card, entry }) => {
                    const root = document.querySelector(
                        `[data-journey] [data-card="${card}"]`,
                    )!;
                    const link = [...root.querySelectorAll("a")].find((a) =>
                        a.textContent?.includes(entry),
                    )!;
                    const b = link.getBoundingClientRect();
                    // Every box the readout's line draws, its text included.
                    const range = document.createRange();
                    range.selectNodeContents(
                        root.querySelector("[data-stamp]")!.parentElement!,
                    );
                    return [...range.getClientRects()]
                        .filter((a) => a.width > 0)
                        .filter(
                            (a) =>
                                a.left < b.right &&
                                b.left < a.right &&
                                a.top < b.bottom &&
                                b.top < a.bottom,
                        ).length;
                },
                { card: i, entry: copy.entry },
            );
            expect(clash, `card ${i}`).toBe(0);
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

test("a phone keeps each chapter's name and full entry, the ask in order", async ({
    page,
}) => {
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
    // No sentence cut short: a phone's card has no line (Full entry
    // shows the row) and its note whole.
    expect(await cutWords(page)).toEqual([]);
    // The plan's card, when set, reads in order: its Contact sits under
    // the openings, not beside the title (Full entry's place).
    const plan = page
        .locator("[data-journey] [data-card]")
        .filter({ has: page.getByRole("heading", { name: copy.openTo }) });
    if (await plan.count()) {
        await seek(page, 1);
        const openings = await plan.locator(".open-to").boundingBox();
        const contact = await plan
            .getByRole("link", { name: copy.contact })
            .boundingBox();
        expect(contact!.y).toBeGreaterThanOrEqual(
            openings!.y + openings!.height - 1,
        );
    }
});

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
 *  the bare stage 0. Flight Manual's opening frame is the poster's own
 *  picture (the limb in ink under the ☉, no city lights on paper), so
 *  there the frames checked start once the chase has begun. */
const DRAWN = 10;
const FRAMES = { void: [0, 0.5, 1], manual: [0.15, 0.5, 1] } as const;

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
        for (const p of FRAMES[theme]) {
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
                .getByRole("link", { name: "About", exact: true })
                .click();
            await expect(page).toHaveURL(/\/about$/);
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
