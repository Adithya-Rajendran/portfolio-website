import type { Locator, Page } from "@playwright/test";
import { axeViolations } from "./support/axe";
import { MISSING_PAGES } from "./support/routes";
import { expect, test } from "./support/test";
import { storeTheme } from "./support/theme";

/**
 * Theme and motion (plan §2.5.1, contract §6): Void for every first visit
 * except a post, which follows the OS until a theme is chosen (premium
 * D3), on a full load and after a client navigation alike; a stored choice
 * applied before the first paint and winning everywhere, the three-way
 * choice in the header switch's popover (from 960px) and the menu sheet
 * (below it) kept in step across reloads, pages and tabs, Auto following
 * the OS, and Pause motion (nothing at all under the OS reduce-motion
 * setting).
 */

const html = (page: Page) => page.locator("html");
const storedTheme = (page: Page) =>
    page.evaluate(() => window.localStorage.getItem("ar-theme"));

/** The header's switch, from 960px: it opens the three-way choice. */
const headerSwitch = (page: Page) =>
    page
        .getByRole("banner")
        .getByRole("button", { name: "Theme", exact: true });

/** The choice in the header switch's popover (the sheet's is hidden from
 *  960px). */
const headerChoice = (page: Page) =>
    page.getByRole("banner").getByRole("group", { name: "Theme" });

/** Picks `name` from the header's popover with a click: the popover
 *  closes and focus returns to the switch. */
async function pick(page: Page, name: string) {
    await headerSwitch(page).click();
    await headerChoice(page).getByRole("radio", { name }).click();
    await expect(headerChoice(page)).toBeHidden();
    await expect(headerSwitch(page)).toBeFocused();
}

/** The header's popover shows `name` as the preference in force. */
async function expectHeaderChoice(page: Page, name: string) {
    await headerSwitch(page).click();
    await expect(headerChoice(page).getByRole("radio", { name })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(headerChoice(page)).toBeHidden();
}

/**
 * The menu sheet carries the three-way choice below 960px, where the
 * header's switch is hidden (the footer repeats neither). Opens the sheet
 * at a phone's width, runs `act` on the choice, then closes it and gives
 * the page its width back.
 */
async function inSheet(page: Page, act: (choice: Locator) => Promise<void>) {
    const size = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    const banner = page.getByRole("banner");
    await banner.getByRole("button", { name: "Menu" }).click();
    await act(banner.getByRole("group", { name: "Theme" }));
    await page.keyboard.press("Escape");
    await expect(banner.getByRole("group", { name: "Theme" })).toBeHidden();
    if (size) await page.setViewportSize(size);
}

/** The sheet's choice shows `name` as the preference in force. */
const expectChoice = (page: Page, name: string) =>
    inSheet(page, (choice) =>
        expect(choice.getByRole("radio", { name })).toBeChecked(),
    );

/** Picks `name` in the sheet's choice. */
const choose = (page: Page, name: string) =>
    inSheet(page, (choice) => choice.getByRole("radio", { name }).check());

test("a first visit is Void, even when the OS prefers light", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await expect(html(page)).toHaveAttribute("data-motion", "full");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        "#050507",
    );
});

/** The first entry linked from /blog, opened by a click (a client
 *  navigation). */
async function openFirstPost(page: Page) {
    await page
        .getByRole("main")
        .locator('a[href^="/blog/"]:not([href^="/blog/tags/"])')
        .first()
        .click();
    await expect(page).toHaveURL(/\/blog\/(?!tags\/)[^/]+$/);
}

test("a post follows the OS until a theme is chosen, and the rest of the site stays Void", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/blog");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    // A client navigation to a post: Flight Manual on a light system,
    // and the choice says the post follows the system.
    await openFirstPost(page);
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        "content",
        "#F2EDE3",
    );
    await expectChoice(page, "System");
    // A full load of the post is the same, before the first paint.
    const post = new URL(page.url()).pathname;
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    // It follows the system as it changes.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    // Back to the index: Void again, with Dark checked.
    await page
        .getByRole("banner")
        .getByRole("link", { name: "Writing", exact: true })
        .click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await expectChoice(page, "Dark");

    // A stored choice wins on a post too.
    await page.goto(post);
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await choose(page, "Dark");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await expectChoice(page, "Dark");
});

test("a post stays Void on a dark system", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/blog");
    await openFirstPost(page);
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
});

test("a stored theme applies before the body is parsed", async ({ page }) => {
    await storeTheme(page, "manual");
    await page.addInitScript(() => {
        const record = (key: string) =>
            Object.defineProperty(window, key, {
                value: document.documentElement?.dataset.theme ?? "none",
            });
        // The moment <body> is inserted, nothing below it has painted.
        new MutationObserver((_, observer) => {
            if (!document.body) return;
            record("__themeAtBody");
            observer.disconnect();
        }).observe(document, { childList: true, subtree: true });
        document.addEventListener("DOMContentLoaded", () =>
            record("__themeAtDomContentLoaded"),
        );
    });
    await page.goto("/");
    const seen = await page.evaluate(() => {
        const w = window as unknown as Record<string, string>;
        return [w.__themeAtBody, w.__themeAtDomContentLoaded];
    });
    expect(seen).toEqual(["manual", "manual"]);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
        "content",
        "light",
    );
});

/** Dark · Light · System sit on one row, in order, inside the viewport:
 *  one joined Segmented control, not a column of boxes. */
async function expectOneRow(page: Page) {
    const boxes = [];
    for (const name of ["Dark", "Light", "System"]) {
        const box = await headerChoice(page)
            .getByRole("radio", { name })
            .boundingBox();
        expect(box, name).not.toBeNull();
        if (box) boxes.push(box);
    }
    const [first, ...rest] = boxes;
    const width = page.viewportSize()?.width ?? 0;
    for (const [i, box] of rest.entries()) {
        expect(box.y).toBeCloseTo(first.y, 0);
        expect(box.x).toBeGreaterThan(boxes[i].x + boxes[i].width - 2);
    }
    expect(first.x).toBeGreaterThanOrEqual(0);
    const last = boxes[boxes.length - 1];
    expect(last.x + last.width).toBeLessThanOrEqual(width);
}

test("the header's popover opens on a click and closes on a pick, a click outside or Escape", async ({
    page,
}) => {
    await page.goto("/about");
    const button = headerSwitch(page);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(headerChoice(page)).toBeHidden();

    // A click opens it on the choice in force, its radio focused.
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const dark = headerChoice(page).getByRole("radio", { name: "Dark" });
    await expect(dark).toBeChecked();
    await expect(dark).toBeFocused();
    expect(await axeViolations(page, "/about"), "axe, popover open").toEqual(
        [],
    );
    await expectOneRow(page);
    // At the narrowest width the switch shows, it still fits on the right.
    await page.setViewportSize({ width: 960, height: 900 });
    await expectOneRow(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // A click outside closes it; so does the switch itself.
    await page.getByRole("heading", { level: 1 }).click();
    await expect(headerChoice(page)).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(headerChoice(page)).toBeVisible();
    await button.click();
    await expect(headerChoice(page)).toBeHidden();

    // Escape closes it and returns focus to the switch.
    await button.click();
    await page.keyboard.press("Escape");
    await expect(headerChoice(page)).toBeHidden();
    await expect(button).toBeFocused();

    // A click on an option picks it, closes it and returns focus.
    await pick(page, "Light");
    await expect(html(page)).toHaveAttribute("data-theme", "manual");

    // From the keyboard the arrows pick without closing it.
    await button.click();
    await page.keyboard.press("ArrowRight");
    await expect(
        headerChoice(page).getByRole("radio", { name: "System" }),
    ).toBeChecked();
    await expect(headerChoice(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(headerChoice(page)).toBeHidden();
});

test("from the header, System hands a post back to the OS", async ({
    page,
}) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/blog");
    await openFirstPost(page);
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expectHeaderChoice(page, "System");

    // Dark pins the post, through a reload.
    await pick(page, "Dark");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    expect(await storedTheme(page)).toBe("void");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await expectHeaderChoice(page, "Dark");

    // System hands it back: stored as `auto`, it follows the OS.
    await pick(page, "System");
    expect(await storedTheme(page)).toBe("auto");
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await expectHeaderChoice(page, "System");

    // And Dark again holds through a reload, whatever the OS does.
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await pick(page, "Dark");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    expect(await storedTheme(page)).toBe("void");
});

test("the header's choice persists across reloads and pages", async ({
    page,
}) => {
    await page.goto("/about");
    await pick(page, "Light");
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    // Both copies of the choice show it.
    await expectHeaderChoice(page, "Light");
    await expectChoice(page, "Light");

    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expectHeaderChoice(page, "Light");
    await expectChoice(page, "Light");

    await page
        .getByRole("banner")
        .getByRole("link", { name: "Projects", exact: true })
        .click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(html(page)).toHaveAttribute("data-theme", "manual");

    await pick(page, "Dark");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
});

test("Auto follows the OS colour scheme as it changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await choose(page, "System");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    // The header's popover shows the same choice.
    await expectHeaderChoice(page, "System");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expectChoice(page, "System");
});

test("a choice made in another tab applies here", async ({ page, context }) => {
    await page.goto("/");
    const other = await context.newPage();
    await other.goto("/about");
    await pick(other, "Light");
    await expect(html(other)).toHaveAttribute("data-theme", "manual");
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expectChoice(page, "Light");
});

test("an unknown post or project URL keeps the stored theme and controls", async ({
    page,
}) => {
    // Next.js answers these with a recovery document that only JavaScript
    // fills, so the head's boot script never runs there (ThemeBootFallback).
    await storeTheme(page, "manual");
    for (const path of [MISSING_PAGES.post, MISSING_PAGES.project]) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(404);
        await expect(html(page), path).toHaveAttribute("data-theme", "manual");
        await expect(html(page), path).toHaveAttribute("data-js", "");
        await expect(headerSwitch(page), path).toBeVisible();
        await expectChoice(page, "Light");
    }
});

test("Pause motion reduces motion and is remembered", async ({ page }) => {
    await page.goto("/about");
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("button", { name: "Pause motion" }).click();
    await expect(html(page)).toHaveAttribute("data-motion", "reduced");
    await expect(
        footer.getByRole("button", { name: "Resume motion" }),
    ).toBeVisible();
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-motion", "reduced");
    await footer.getByRole("button", { name: "Resume motion" }).click();
    await expect(html(page)).toHaveAttribute("data-motion", "full");
});

test("the OS reduce-motion setting holds motion and shows no control", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    await expect(html(page)).toHaveAttribute("data-motion", "reduced");
    // Nothing moves, so nothing offers to pause it or reads the setting
    // back.
    const footer = page.getByRole("contentinfo");
    await expect(footer.locator(".motion-ctl")).toBeHidden();
    await expect(footer.getByRole("button", { name: /motion/ })).toHaveCount(0);
});
