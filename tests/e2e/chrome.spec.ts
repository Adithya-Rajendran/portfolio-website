import { chromeCopy } from "@/lib/copy";
import { FIXTURE_PROFILE } from "@/lib/fixtures";
import { primaryNavigation } from "@/lib/navigation";
import { expect, test } from "./support/test";

/**
 * The header's menu sheet below 960px, with JavaScript: it opens from the
 * visible Menu button, moves focus in, keeps the page behind inert, closes
 * with Escape or a link, and gives focus back. Without JavaScript it is a
 * plain popover (nojs spec). Also: the current section is marked, the bar
 * carries Contact and CV only where the nav is in the sheet, every page
 * keeps one header hairline, and the footer is one strip (the name with
 * GitHub and LinkedIn, the colophon and Pause motion) that repeats nothing
 * the header carries.
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
    // The sheet's list carries Contact and Experience: the bar's Contact
    // and CV step aside while it is open, so neither shows twice.
    for (const link of await banner.locator(".header-cv").all()) {
        await expect(link).toBeHidden();
    }
    await expect(
        banner.getByRole("link", { name: "Contact", exact: true }),
    ).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("main")).toHaveJSProperty("inert", false);
    await expect(first).toBeHidden();
    await expect(banner.getByRole("link", { name: "CV" })).toBeVisible();

    await menu.click();
    await banner
        .getByRole("link", { name: primaryNavigation[3].plain, exact: true })
        .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(first).toBeHidden();
    await expect(page.getByRole("main")).toHaveJSProperty("inert", false);
});

test("Tab and Shift+Tab loop inside the open menu sheet", async ({ page }) => {
    await page.goto("/about");
    const banner = page.getByRole("banner");
    await banner.getByRole("button", { name: "Menu" }).click();
    await expect(
        banner.getByRole("link", {
            name: primaryNavigation[0].plain,
            exact: true,
        }),
    ).toBeFocused();
    const where = () =>
        page.evaluate(() => {
            const active = document.activeElement;
            if (!active || active === document.body) return "body";
            if (!active.closest("header")) return "outside";
            return active instanceof HTMLInputElement
                ? `radio:${active.value}`
                : (active.getAttribute("aria-label") ??
                      active.textContent?.trim() ??
                      "");
        });
    for (const key of ["Tab", "Shift+Tab"]) {
        const seen = new Set<string>();
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press(key);
            seen.add(await where());
        }
        expect(seen).not.toContain("body");
        expect(seen).not.toContain("outside");
        for (const link of primaryNavigation)
            expect(seen).toContain(link.plain);
        expect(seen).toContain("Close");
        expect([...seen].some((name) => name.startsWith("radio:"))).toBe(true);
    }
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

test("the nav names every section plainly, and the bar repeats none of it", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const banner = page.getByRole("banner");
    // From 960px Contact is the nav's own link and Experience the way to
    // the CV: neither is repeated in the bar.
    await expect(
        banner.getByRole("link", { name: "Contact", exact: true }),
    ).toHaveCount(1);
    await expect(
        banner.getByRole("link", { name: "CV", exact: true }),
    ).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText([
        "Projects",
        "Writing",
        "Experience",
        "About",
        "Contact",
    ]);
    // No fallback Menu link: the sheet opens without JavaScript.
    await expect(banner.locator('a[href^="#"]')).toHaveCount(0);
});

test("the header keeps one hairline on every page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const rules = new Set<string>();
    for (const path of ["/", "/blog", "/resume", "/about", "/contact"]) {
        await page.goto(path);
        rules.add(
            await page
                .getByRole("banner")
                .evaluate(
                    (header) => getComputedStyle(header).borderBottomColor,
                ),
        );
        await expect(page.locator("html")).not.toHaveAttribute(
            "data-header",
            /.*/,
        );
    }
    expect(rules.size).toBe(1);
});

test("the footer is one strip that names the owner once and repeats nothing the header carries", async ({
    page,
}) => {
    await page.goto("/about");
    const footer = page.getByRole("contentinfo");
    const name = FIXTURE_PROFILE.name!;
    await expect(footer.getByText(name)).toHaveCount(1);
    await expect(footer.getByText(name)).toHaveText(/^© \d{4} /);
    // GitHub and LinkedIn beside the name, the colophon's Source, and
    // nothing else to follow: no sections, CV, RSS, patch or Back to top.
    await expect(footer.getByRole("link")).toHaveText([
        "GitHub",
        "LinkedIn",
        "Source",
    ]);
    await expect(footer.getByRole("navigation")).toHaveCount(0);
    await expect(footer.locator("svg.patch")).toHaveCount(0);
    // The theme is the header's (the menu sheet's below 960px).
    for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(footer.getByRole("group", { name: "Theme" })).toHaveCount(
            0,
        );
        // Pause motion is the footer's one control.
        await expect(footer.getByRole("button")).toHaveCount(1);
        await expect(
            footer.getByRole("button", { name: chromeCopy.holdDrift }),
        ).toBeVisible();
    }
});

test("the footer's controls speak the controls' voice, its strip the labels'", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/about");
    const footer = page.getByRole("contentinfo");
    // Pause motion: Jost 500, 13px, caps, 0.10em.
    for (const control of [
        footer.getByRole("button", { name: chromeCopy.holdDrift }),
    ]) {
        const voice = await control.evaluate((element) => {
            const style = getComputedStyle(element);
            const size = parseFloat(style.fontSize);
            return [
                style.fontFamily.split(",")[0].replace(/["']/g, ""),
                style.fontWeight,
                size,
                style.textTransform,
                Math.round((parseFloat(style.letterSpacing) / size) * 100),
            ];
        });
        expect(voice).toEqual(["Jost", "500", 13, "uppercase", 10]);
    }
    // The copyright and the links are labels.
    for (const label of [
        footer.getByText(FIXTURE_PROFILE.name!),
        footer.getByRole("link", { name: "GitHub" }),
        footer.getByRole("link", { name: "Source" }),
    ]) {
        await expect(label).toHaveCSS("font-family", /DM Mono/);
        await expect(label).toHaveCSS("text-transform", "uppercase");
    }
    // The colophon is a sentence, in the strip's mono and its own case:
    // capitals are for labels of four words or fewer.
    const colophon = footer.getByText(chromeCopy.colophon, { exact: true });
    await expect(colophon).toHaveCSS("font-family", /DM Mono/);
    await expect(colophon).toHaveCSS("text-transform", "none");
});

for (const width of [390, 1440]) {
    test(`the footer's strip fits its width at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/about");
        const footer = page.getByRole("contentinfo");
        const box = (await footer.boundingBox())!;
        // One strip: at 1440 one line of 44px targets; at 390 a few lines.
        expect(box.height).toBeLessThan(width > 960 ? 120 : 280);
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
}
