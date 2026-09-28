import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { storeTheme } from "./support/theme";

/**
 * Theme and motion (plan §2.5.1): Void for every first visit, a stored
 * choice applied before the first paint, the toggle's choice kept across
 * reloads, pages and tabs, Auto following the OS, and Pause motion.
 */

const html = (page: Page) => page.locator("html");
const headerToggle = (page: Page) =>
    page.getByRole("banner").getByRole("group", { name: "Theme" });
const footerToggle = (page: Page) =>
    page.getByRole("contentinfo").getByRole("group", { name: "Theme" });

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

test("the toggle's choice persists across reloads and pages", async ({
    page,
}) => {
    await page.goto("/about");
    await headerToggle(page)
        .getByRole("radio", { name: /Manual/ })
        .check();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    // Every instance shows the same choice.
    await expect(
        footerToggle(page).getByRole("radio", { name: /Manual/ }),
    ).toBeChecked();

    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expect(
        headerToggle(page).getByRole("radio", { name: /Manual/ }),
    ).toBeChecked();

    await page
        .getByRole("banner")
        .getByRole("link", { name: /^Missions/ })
        .click();
    await expect(page).toHaveURL(/\/portfolio$/);
    await expect(html(page)).toHaveAttribute("data-theme", "manual");

    await headerToggle(page).getByRole("radio", { name: /Void/ }).check();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-theme", "void");
});

test("Auto follows the OS colour scheme as it changes", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await headerToggle(page).getByRole("radio", { name: /Auto/ }).check();
    await expect(html(page)).toHaveAttribute("data-theme", "void");
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expect(
        headerToggle(page).getByRole("radio", { name: /Auto/ }),
    ).toBeChecked();
});

test("a choice made in another tab applies here", async ({ page, context }) => {
    await page.goto("/");
    const other = await context.newPage();
    await other.goto("/about");
    await headerToggle(other)
        .getByRole("radio", { name: /Manual/ })
        .check();
    await expect(html(other)).toHaveAttribute("data-theme", "manual");
    await expect(html(page)).toHaveAttribute("data-theme", "manual");
    await expect(
        headerToggle(page).getByRole("radio", { name: /Manual/ }),
    ).toBeChecked();
});

test("Pause motion reduces motion and is remembered", async ({ page }) => {
    await page.goto("/");
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

test("the OS reduce-motion setting holds motion and says so", async ({
    page,
}) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(html(page)).toHaveAttribute("data-motion", "reduced");
    const footer = page.getByRole("contentinfo");
    await expect(
        footer.getByText("Motion reduced by system settings"),
    ).toBeVisible();
    await expect(footer.getByRole("button", { name: /motion/ })).toBeHidden();
});
