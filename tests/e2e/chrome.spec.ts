import { primaryNavigation } from "@/lib/navigation";
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
    // Contact is in the bar too, so the form is one tap away on a phone.
    await expect(
        banner.getByRole("link", { name: "Contact", exact: true }),
    ).toHaveAttribute("href", "/contact");
    await menu.click();

    const close = banner.getByRole("button", { name: "Close" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    const first = banner.getByRole("link", {
        name: primaryNavigation[0].plain,
        exact: true,
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
        .getByRole("link", { name: primaryNavigation[3].plain, exact: true })
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
        nav.getByRole("link", { name: "Writing", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        nav.getByRole("link", { name: "Projects", exact: true }),
    ).not.toHaveAttribute("aria-current", /.*/);
});

test("the nav names every section plainly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    // From 960px Contact is the nav's own link, not repeated in the bar.
    await expect(
        page
            .getByRole("banner")
            .getByRole("link", { name: "Contact", exact: true }),
    ).toHaveCount(1);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText([
        "Projects",
        "Writing",
        "Experience",
        "About",
        "Contact",
    ]);
    const footer = page.getByRole("navigation", { name: "Footer" });
    await expect(footer.getByRole("link")).toHaveText([
        "Projects",
        "Writing",
        "Experience",
        "About",
        "Contact",
    ]);
});
