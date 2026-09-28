import type { Page } from "@playwright/test";
import { expect, test } from "./support/test";
import { axeViolations } from "./support/axe";
import { isLegacyRoute } from "./support/legacy-routes";
import { MISSING_PAGES, STATIC_PAGES, contentPages } from "./support/routes";
import { THEMES, storeTheme, type SiteTheme } from "./support/theme";

/**
 * axe finds no violations on any page at 390 and 1440 px, in Void and in
 * Flight Manual (plan §7.2), apart from the documented allowances in
 * support/axe.ts. A page still on the legacy layout (support/
 * legacy-routes.ts) is checked in full in Void; in Flight Manual only its
 * chrome is, because the legacy styles are dark-only.
 */
const CHROME = ["header.site-header", "footer.site-footer"];

async function expectNoViolations(
    page: Page,
    theme: SiteTheme,
    path: string,
    status = 200,
) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBe(status);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const include = theme === "manual" && isLegacyRoute(path) ? CHROME : [];
    expect(
        await axeViolations(page, path, include),
        `${path} axe (${theme}${include.length ? ", chrome only" : ""})`,
    ).toEqual([]);
}

for (const theme of THEMES) {
    for (const width of [390, 1440]) {
        test.describe(`axe in ${theme} at ${width}px`, () => {
            test.use({ viewport: { width, height: width < 600 ? 844 : 900 } });
            test.beforeEach(async ({ page }) => {
                await storeTheme(page, theme);
            });

            for (const path of STATIC_PAGES) {
                test(`${path} has no violations`, async ({ page }) => {
                    await expectNoViolations(page, theme, path);
                });
            }

            test("every post, tag and project page has no violations", async ({
                page,
                request,
            }, testInfo) => {
                const paths = await contentPages(request, testInfo);
                test.setTimeout(30_000 + paths.length * 15_000);
                for (const path of paths) {
                    await test.step(path, () =>
                        expectNoViolations(page, theme, path),
                    );
                }
            });

            test("the 404 page has no violations", async ({ page }) => {
                await expectNoViolations(
                    page,
                    theme,
                    MISSING_PAGES.unmatched,
                    404,
                );
            });
        });
    }
}
