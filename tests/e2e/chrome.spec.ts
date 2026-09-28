import { pairName, primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";

/**
 * The header's menu sheet below 960px, with JavaScript: it opens from the
 * visible Menu button, moves focus in, keeps the page behind inert, closes
 * with Escape or a link, and gives focus back. Without JavaScript it is a
 * plain popover (nojs spec). Also: the current section is marked.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("the menu sheet opens, traps nothing behind it and closes", async ({
    page,
}) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    const menu = banner.getByRole("button", { name: "Menu" });
    await expect(banner.getByRole("link", { name: "CV" })).toBeVisible();
    await menu.click();

    const close = banner.getByRole("button", { name: "Close" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    const first = banner.getByRole("link", {
        name: pairName(primaryNavigation[0]),
    });
    await expect(first).toBeFocused();
    await expect(page.getByRole("main")).toHaveJSProperty("inert", true);
    await expect(banner.getByRole("group", { name: "Theme" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("main")).toHaveJSProperty("inert", false);
    await expect(first).toBeHidden();

    await menu.click();
    await banner
        .getByRole("link", { name: pairName(primaryNavigation[3]) })
        .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(first).toBeHidden();
    await expect(page.getByRole("main")).toHaveJSProperty("inert", false);
});

test("the current section is marked in the nav", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/blog");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(
        nav.getByRole("link", { name: pairName(primaryNavigation[0]) }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        nav.getByRole("link", { name: pairName(primaryNavigation[1]) }),
    ).not.toHaveAttribute("aria-current", /.*/);
});
